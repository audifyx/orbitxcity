import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { parseAuthCallback } from "./hostedAuth";
import {
  clearPhantomSecureStore,
  startNativeSign,
  handleNativeConnectRedirect,
  handleNativeSignRedirect,
  WALLET_PUBKEY_KEY,
} from "./phantom";
import { supabase, walletAuth, warmWalletAuth } from "./supabase";
import { consumePrivyHostResult } from "./privyConnect";
import { logoutPrivySession } from "./privyProvider";
import {
  connectBrowserWallet,
  isSolanaPubkey,
  isSolanaSignature,
  prepareWalletStandard,
  signBrowserWallet,
  type WalletId,
} from "./wallets";

interface WalletAuthNonceResponse {
  nonce: string;
  message: string;
}

interface WalletAuthVerifyResponse {
  access_token: string;
  refresh_token: string;
  isNew: boolean;
}

interface AuthContextValue {
  session: Session | null;
  wallet: string | null;
  signedIn: boolean;
  userId: string | null;
  loading: boolean;
  error: string | null;
  connecting: boolean;
  connect: (
    walletId?: WalletId,
    options?: { injectedOnly?: boolean; hostedOnly?: boolean },
  ) => Promise<{ pubkey: string; signature: string } | void>;
  requestWalletSignature: (
    walletId: WalletId,
  ) => Promise<{ pubkey: string; signature: string }>;
  requestSignInMessage: (pubkey: string) => Promise<string>;
  signInWithSignature: (pubkey: string, signature: string) => Promise<void>;
  completeNativeConnect: (url: string) => Promise<void>;
  completeNativeSign: (url: string) => Promise<void>;
  clearError: () => void;
  disconnect: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const WALLET_STORAGE_KEY = "orbitx-wallet";
const MANUAL_LOGOUT_KEY = "orbitx-manual-logout";

let skipPrivyResume = false;

export function shouldSkipPrivyResume(): boolean {
  return skipPrivyResume;
}

export function markManualLogout(): void {
  skipPrivyResume = true;
  void AsyncStorage.setItem(MANUAL_LOGOUT_KEY, "1").catch(() => undefined);
}

export function clearManualLogout(): void {
  skipPrivyResume = false;
  void AsyncStorage.removeItem(MANUAL_LOGOUT_KEY).catch(() => undefined);
}

function persistWallet(pubkey: string | null): void {
  if (typeof window !== "undefined") {
    try {
      if (pubkey) {
        window.localStorage.setItem(WALLET_STORAGE_KEY, pubkey);
      } else {
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    } catch {
      // Private mode / quota — session tokens still persist via Supabase storage.
    }
  }

  void (async () => {
    try {
      if (pubkey) {
        await SecureStore.setItemAsync(WALLET_PUBKEY_KEY, pubkey);
      } else {
        await SecureStore.deleteItemAsync(WALLET_PUBKEY_KEY);
      }
    } catch {
      // SecureStore is optional on web.
    }
  })();
}

async function readPersistedWallet(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(WALLET_PUBKEY_KEY);
    if (stored && isSolanaPubkey(stored)) {
      return stored;
    }
  } catch {
    // SecureStore is optional on web.
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(WALLET_STORAGE_KEY);
      if (stored && isSolanaPubkey(stored)) {
        return stored;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function publicAuthError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lower = message.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  ) {
    return "Can't reach OrbitX sign-in. Check your connection and try again.";
  }
  if (
    lower.includes("declined") ||
    lower.includes("rejected") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return "Sign-in was cancelled. Use your email or phone and try again.";
  }
  if (
    lower.includes("could not log in with wallet") ||
    lower.includes("can't connect") ||
    lower.includes("cannot connect") ||
    lower.includes("could not connect")
  ) {
    return "Sign-in did not finish. Use your email or phone. OrbitX creates your wallet.";
  }
  return message;
}

function parseNonceResponse(data: Record<string, unknown>): WalletAuthNonceResponse {
  const nonce = data.nonce;
  const message = data.message;

  if (typeof nonce !== "string" || typeof message !== "string") {
    throw new Error("wallet-auth nonce response is invalid.");
  }

  return { nonce, message };
}

function parseVerifyResponse(
  data: Record<string, unknown>,
): WalletAuthVerifyResponse {
  const access_token = data.access_token;
  const refresh_token = data.refresh_token;
  const isNew = data.isNew;

  if (typeof access_token !== "string" || typeof refresh_token !== "string") {
    throw new Error("wallet-auth verify response is invalid.");
  }

  return {
    access_token,
    refresh_token,
    isNew: typeof isNew === "boolean" ? isNew : false,
  };
}

async function resolveWalletForUser(userId: string): Promise<string | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message);
  }

  const metadataWallet = userData.user?.user_metadata?.wallet;
  if (typeof metadataWallet === "string" && metadataWallet.length > 0) {
    return metadataWallet;
  }

  const { data, error } = await supabase
    .from("wallet_identities")
    .select("wallet")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.wallet === "string" ? data.wallet : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pendingPubkey, setPendingPubkey] = useState<string | null>(null);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user.id) {
      setWallet(null);
      return;
    }

    const persisted = await readPersistedWallet();
    try {
      const resolvedWallet = await resolveWalletForUser(nextSession.user.id);
      const nextWallet =
        resolvedWallet && isSolanaPubkey(resolvedWallet)
          ? resolvedWallet
          : persisted;
      setWallet(nextWallet);
      persistWallet(nextWallet);
      setError(null);
    } catch (resolveError) {
      if (persisted) {
        setWallet(persisted);
        setError(null);
        return;
      }
      setWallet(null);
      setError(publicAuthError(resolveError, "Failed to resolve wallet for session."));
    }
  }, []);

  const finishVerification = useCallback(
    async (pubkey: string, signature: string) => {
      const verifyData = parseVerifyResponse(
        await walletAuth("verify", { pubkey, signature }),
      );

      const { data, error: setSessionError } = await supabase.auth.setSession({
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
      });

      if (setSessionError) {
        throw new Error(setSessionError.message);
      }

      const nextSession =
        data.session ?? (await supabase.auth.getSession()).data.session;

      setPendingPubkey(null);
      clearManualLogout();
      persistWallet(pubkey);
      setWallet(pubkey);
      if (nextSession) {
        await applySession(nextSession);
        setWallet(pubkey);
        persistWallet(pubkey);
      }
    },
    [applySession],
  );

  useEffect(() => {
    prepareWalletStandard();
    void warmWalletAuth();
  }, []);

  useEffect(() => {
    let mounted = true;

    const failsafe = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }
      void applySession(nextSession);
    });

    void (async () => {
      try {
        const hosted = consumePrivyHostResult();
        if (hosted) {
          await finishVerification(hosted.pubkey, hosted.signature);
        }
      } catch (hostedError) {
        if (mounted) {
          setError(publicAuthError(hostedError, "Wallet sign-in failed."));
        }
      }

      if (!mounted) {
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (sessionError) {
        setError(publicAuthError(sessionError, "Session restore failed."));
        setLoading(false);
        return;
      }

      await applySession(data.session);
      if (data.session) {
        const stored = await readPersistedWallet();
        if (stored) {
          setWallet(stored);
        }
      }
      const loggedOut = await AsyncStorage.getItem(MANUAL_LOGOUT_KEY);
      skipPrivyResume = loggedOut === "1";
      setLoading(false);
    })();

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, [applySession, finishVerification]);

  const requestWalletSignature = useCallback(async (walletId: WalletId) => {
    const linked = await connectBrowserWallet(walletId);
    const nonceData = parseNonceResponse(
      await walletAuth("nonce", { pubkey: linked.pubkey }),
    );
    const signature = await signBrowserWallet(walletId, nonceData.message);
    if (!isSolanaSignature(signature)) {
      throw new Error("Wallet did not return a valid signature.");
    }
    return { pubkey: linked.pubkey, signature };
  }, []);

  const requestSignInMessage = useCallback(async (pubkey: string) => {
    const trimmed = pubkey.trim();
    if (!isSolanaPubkey(trimmed)) {
      throw new Error("Enter a valid Solana wallet address.");
    }

    const nonceData = parseNonceResponse(
      await walletAuth("nonce", { pubkey: trimmed }),
    );
    setPendingPubkey(trimmed);
    await SecureStore.setItemAsync(WALLET_PUBKEY_KEY, trimmed).catch(
      () => undefined,
    );
    return nonceData.message;
  }, []);

  const signInWithSignature = useCallback(
    async (pubkey: string, signature: string) => {
      setConnecting(true);
      setError(null);
      try {
        const trimmedPubkey = pubkey.trim();
        const trimmedSignature = signature.trim();
        if (!isSolanaPubkey(trimmedPubkey)) {
          throw new Error("Enter a valid Solana wallet address.");
        }
        if (!isSolanaSignature(trimmedSignature)) {
          throw new Error("Paste the base58 signature from your wallet.");
        }
        await finishVerification(trimmedPubkey, trimmedSignature);
      } catch (verifyError) {
        const message = publicAuthError(verifyError, "Wallet sign-in failed.");
        setError(message);
        throw new Error(message);
      } finally {
        setConnecting(false);
      }
    },
    [finishVerification],
  );

  const connect = useCallback(
    async (
      _walletId?: WalletId,
      _options?: { injectedOnly?: boolean; hostedOnly?: boolean },
    ) => {
      setConnecting(true);
      setError(null);

      try {
        throw new Error(
          "Use email or phone on this screen. OrbitX signs you in inside the app.",
        );
      } catch (connectError) {
        const message = publicAuthError(connectError, "Sign-in failed.");
        if (!message) {
          return;
        }
        setError(message);
        throw new Error(message);
      } finally {
        setConnecting(false);
      }
    },
    [],
  );

  const consumedAuthUrl = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const consume = (url: string | null) => {
      if (!url || consumedAuthUrl.current === url) {
        return;
      }
      const parsed = parseAuthCallback(url);
      if (!parsed) {
        return;
      }
      consumedAuthUrl.current = url;
      void signInWithSignature(parsed.pubkey, parsed.signature).catch(
        () => undefined,
      );
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      consume(url);
    });
    void Linking.getInitialURL().then(consume);

    return () => {
      subscription.remove();
    };
  }, [signInWithSignature]);

  const completeNativeConnect = useCallback(async (url: string) => {
    setConnecting(true);
    setError(null);

    try {
      const { pubkey } = await handleNativeConnectRedirect(url);
      setPendingPubkey(pubkey);
      setWallet(pubkey);

      const nonceData = parseNonceResponse(
        await walletAuth("nonce", { pubkey }),
      );
      await startNativeSign(nonceData.message);
    } catch (nativeConnectError) {
      const message = publicAuthError(nativeConnectError, "Phantom connect failed.");
      setError(message);
      setConnecting(false);
      throw new Error(message);
    }
  }, []);

  const completeNativeSign = useCallback(
    async (url: string) => {
      setConnecting(true);
      setError(null);

      try {
        const { signature } = await handleNativeSignRedirect(url);
        const pubkey =
          pendingPubkey ??
          (await SecureStore.getItemAsync(WALLET_PUBKEY_KEY));

        if (!pubkey) {
          throw new Error("Wallet public key is missing. Connect again.");
        }

        await finishVerification(pubkey, signature);
      } catch (nativeSignError) {
        const message = publicAuthError(nativeSignError, "Phantom sign-in failed.");
        setError(message);
        throw new Error(message);
      } finally {
        setConnecting(false);
      }
    },
    [finishVerification, pendingPubkey],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    setPendingPubkey(null);
    markManualLogout();
    persistWallet(null);
    setWallet(null);
    setSession(null);

    const { error: signOutError } = await supabase.auth.signOut();
    try {
      await clearPhantomSecureStore();
    } catch {
      // Local session is already cleared.
    }
    try {
      await logoutPrivySession();
    } catch {
      // Stay on the login page even if Privy logout is slow.
    }
    if (signOutError) {
      setError(signOutError.message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      wallet,
      signedIn: Boolean(session && wallet && isSolanaPubkey(wallet)),
      userId: session?.user.id ?? null,
      loading,
      error,
      connecting,
      connect,
      requestWalletSignature,
      requestSignInMessage,
      signInWithSignature,
      completeNativeConnect,
      completeNativeSign,
      clearError,
      disconnect,
    }),
    [
      session,
      wallet,
      loading,
      error,
      connecting,
      connect,
      requestWalletSignature,
      requestSignInMessage,
      signInWithSignature,
      completeNativeConnect,
      completeNativeSign,
      clearError,
      disconnect,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
