import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import {
  clearPhantomSecureStore,
  connectInjected,
  isPhantomInjected,
  signInjected,
  startNativeConnect,
  startNativeSign,
  handleNativeConnectRedirect,
  handleNativeSignRedirect,
  WALLET_PUBKEY_KEY,
} from "./phantom";
import { supabase, walletAuth } from "./supabase";

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
  connect: () => Promise<void>;
  completeNativeConnect: (url: string) => Promise<void>;
  completeNativeSign: (url: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
      const message =
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve wallet for session.";
      setError(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
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
      subscription.unsubscribe();
    };
  }, [applySession]);

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

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);

    try {
      if (Platform.OS === "web") {
        if (!isPhantomInjected()) {
          throw new Error(
            "Phantom not found. Install Phantom and try again.",
          );
        }

        const { pubkey } = await connectInjected();
        setPendingPubkey(pubkey);
        setWallet(pubkey);

        const nonceData = parseNonceResponse(
          await walletAuth("nonce", { pubkey }),
        );
        const signature = await signInjected(nonceData.message);
        await finishVerification(pubkey, signature);
        return;
      }

      await startNativeConnect();
    } catch (connectError) {
      const message =
        connectError instanceof Error
          ? connectError.message
          : "Wallet connection failed.";
      setError(message);
      throw connectError;
    } finally {
      if (Platform.OS === "web") {
        setConnecting(false);
      }
    }
  }, [finishVerification]);

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
      const message =
        nativeConnectError instanceof Error
          ? nativeConnectError.message
          : "Phantom connect failed.";
      setError(message);
      setConnecting(false);
      throw nativeConnectError;
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
        const message =
          nativeSignError instanceof Error
            ? nativeSignError.message
            : "Phantom sign-in failed.";
        setError(message);
        throw nativeSignError;
      } finally {
        setConnecting(false);
      }
    },
    [finishVerification, pendingPubkey],
  );

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
      completeNativeConnect,
      completeNativeSign,
      disconnect,
    }),
    [
      session,
      wallet,
      loading,
      error,
      connecting,
      connect,
      completeNativeConnect,
      completeNativeSign,
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
