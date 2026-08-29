import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import {
  clearPhantomSecureStore,
  startNativeSign,
  handleNativeConnectRedirect,
  handleNativeSignRedirect,
  WALLET_PUBKEY_KEY,
} from "./phantom";
import { supabase, walletAuth, warmWalletAuth } from "./supabase";
import { connectWithPrivy, consumePrivyHostResult, isPrivyConfigured } from "./privyConnect";
import { isInsideWalletBrowser, isMobileDevice, openWalletInAppBrowser } from "./walletOpen";
import {
  connectBrowserWallet,
  isSolanaPubkey,
  isSolanaSignature,
  isWalletInjected,
  prepareWalletStandard,
  signBrowserWallet,
  waitForWallet,
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
  userId: string | null;
  loading: boolean;
  error: string | null;
  connecting: boolean;
  connect: (walletId?: WalletId, options?: { injectedOnly?: boolean }) => Promise<void>;
  requestSignInMessage: (pubkey: string) => Promise<string>;
  signInWithSignature: (pubkey: string, signature: string) => Promise<void>;
  completeNativeConnect: (url: string) => Promise<void>;
  completeNativeSign: (url: string) => Promise<void>;
  clearError: () => void;
  disconnect: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
    lower.includes("invalid account") ||
    (lower.includes("cannot read properties of undefined") &&
      lower.includes("publickey")) ||
    lower.includes("reading 'publickey'")
  ) {
    return "Wallet could not sign with that account. Pick the wallet again and approve the request.";
  }
  if (
    lower.includes("declined") ||
    lower.includes("rejected") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return "Wallet request was cancelled.";
  }
  if (lower.includes("wallet not found") || lower.includes("no wallet found")) {
    return "Install Phantom or Jupiter, then try Connect Wallet again.";
  }
  if (lower.includes("not installed") || lower.includes("jupiter_siws_required")) {
    return "Opening your wallet. Approve the connection, then sign. This is not a transaction.";
  }
  if (lower.includes("could not log in with wallet")) {
    return "Wallet did not finish connect. Pick Phantom or Jupiter again and approve. This is not a transaction.";
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

    try {
      const resolvedWallet = await resolveWalletForUser(nextSession.user.id);
      setWallet(resolvedWallet);
      setError(null);
    } catch (resolveError) {
      setError(publicAuthError(resolveError, "Failed to resolve wallet for session."));
    }
  }, []);

  const finishVerification = useCallback(
    async (pubkey: string, signature: string) => {
      const verifyData = parseVerifyResponse(
        await walletAuth("verify", { pubkey, signature }),
      );

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
      });

      if (setSessionError) {
        throw new Error(setSessionError.message);
      }

      setPendingPubkey(null);
    },
    [],
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

    void (async () => {
      try {
        const hosted = consumePrivyHostResult();
        if (hosted) {
          await finishVerification(hosted.pubkey, hosted.signature);
          setWallet(hosted.pubkey);
          setLoading(false);
          return;
        }
      } catch (hostedError) {
        if (!mounted) {
          return;
        }
        setError(publicAuthError(hostedError, "Wallet sign-in failed."));
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
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, [applySession, finishVerification]);

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
    async (walletId: WalletId = "phantom", options?: { injectedOnly?: boolean }) => {
      setConnecting(true);
      setError(null);

      try {
        const insideWallet = isInsideWalletBrowser(walletId);
        if (options?.injectedOnly || insideWallet) {
          await waitForWallet(walletId, 5000);
        }

        if (isWalletInjected(walletId) || options?.injectedOnly || insideWallet) {
          const linked = await connectBrowserWallet(walletId);
          setPendingPubkey(linked.pubkey);
          setWallet(linked.pubkey);
          const nonceData = parseNonceResponse(
            await walletAuth("nonce", { pubkey: linked.pubkey }),
          );
          const signature = await signBrowserWallet(walletId, nonceData.message);
          if (!isSolanaSignature(signature)) {
            throw new Error("Wallet did not return a valid signature.");
          }
          await finishVerification(linked.pubkey, signature);
          return;
        }

        if (isMobileDevice() && walletId === "phantom" && !isWalletInjected(walletId)) {
          await openWalletInAppBrowser(walletId);
          return;
        }

        if (isPrivyConfigured()) {
          const linked = await connectWithPrivy(walletId);
          setPendingPubkey(linked.pubkey);
          setWallet(linked.pubkey);
          await finishVerification(linked.pubkey, linked.signature);
          return;
        }

        if (isMobileDevice()) {
          await openWalletInAppBrowser(walletId);
          return;
        }

        throw new Error(
          "OrbitX is missing the Privy App ID on this build. Set PRIVY_APP_ID or EXPO_PUBLIC_PRIVY_APP_ID on Vercel.",
        );
      } catch (connectError) {
        const message = publicAuthError(connectError, "Wallet connection failed.");
        if (!message) {
          return;
        }
        setError(message);
        throw new Error(message);
      } finally {
        setConnecting(false);
      }
    },
    [finishVerification],
  );

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

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw new Error(signOutError.message);
    }

    await clearPhantomSecureStore();
    setWallet(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      wallet,
      userId: session?.user.id ?? null,
      loading,
      error,
      connecting,
      connect,
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
