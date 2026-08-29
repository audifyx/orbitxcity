import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/lib/auth";
import {
  appendAuthResult,
  isSafeAppReturn,
  parseAuthCallback,
  privyHostUrl,
} from "../src/lib/hostedAuth";
import { isWalletInjected, type WalletId } from "../src/lib/wallets";
import { colors } from "../src/theme";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    pubkey?: string | string[];
    signature?: string | string[];
    wallet?: string | string[];
    return?: string | string[];
  }>();
  const { requestWalletSignature, signInWithSignature, session, connecting, error } =
    useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing OrbitX sign-in…");
  const started = useRef(false);

  const pubkey = firstParam(params.pubkey);
  const signature = firstParam(params.signature);
  const walletHint = firstParam(params.wallet);
  const returnTo = firstParam(params.return);
  const callback = parseAuthCallback(
    `https://orbitx.local/auth?pubkey=${encodeURIComponent(pubkey)}&signature=${encodeURIComponent(signature)}`,
  );

  const finishInApp = useCallback(
    async (nextPubkey: string, nextSignature: string) => {
      await signInWithSignature(nextPubkey, nextSignature);
    },
    [signInWithSignature],
  );

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [router, session]);

  useEffect(() => {
    if (!callback) {
      return;
    }
    setStatus("Connecting your wallet to OrbitX…");
    if (Platform.OS !== "web" || started.current) {
      return;
    }
    started.current = true;
    void finishInApp(callback.pubkey, callback.signature).catch((err) => {
      setLocalError(err instanceof Error ? err.message : "Wallet sign-in failed.");
      setStatus("");
    });
  }, [callback, finishInApp]);

  useEffect(() => {
    if (callback || started.current || Platform.OS !== "web") {
      return;
    }
    const hinted: WalletId | null =
      walletHint === "jupiter" || walletHint === "phantom" ? walletHint : null;
    if (!hinted) {
      setStatus("Choose Phantom or Jupiter, then sign a message to log in.");
      return;
    }

    started.current = true;
    const nativeReturn = returnTo && isSafeAppReturn(returnTo) ? returnTo : "";

    void (async () => {
      try {
        if (isWalletInjected(hinted)) {
          setStatus("Approve the sign-in in your wallet. This is not a transaction.");
          const linked = await requestWalletSignature(hinted);
          if (nativeReturn) {
            window.location.replace(appendAuthResult(nativeReturn, linked));
            return;
          }
          await finishInApp(linked.pubkey, linked.signature);
          router.replace("/");
          return;
        }

        setStatus(
          hinted === "jupiter"
            ? "Opening Privy… pick Jupiter, then sign. You will return to the app."
            : "Opening Privy… pick Phantom, then sign. You will return to the app.",
        );
        window.location.assign(privyHostUrl(hinted, nativeReturn || undefined));
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Wallet sign-in failed.");
        setStatus("");
        started.current = false;
      }
    })();
  }, [callback, finishInApp, requestWalletSignature, returnTo, router, walletHint]);

  const displayError = localError ?? error;
  const showPicker = Platform.OS === "web" && !callback && !connecting;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.kicker}>OrbitX</Text>
      <Text style={styles.title}>
        {displayError ? "Sign-in failed" : "Sign in to OrbitX"}
      </Text>
      {displayError ? (
        <Text style={styles.message}>{displayError}</Text>
      ) : (
        <Text style={styles.message}>
          {status ||
            "Connect your wallet and sign a message. This connects the account to the app. It is not a transaction."}
        </Text>
      )}

      {!displayError && (connecting || Boolean(callback)) ? (
        <ActivityIndicator color={colors.signal} size="large" />
      ) : null}

      {showPicker ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => {
              started.current = false;
              router.setParams({ wallet: "phantom" });
            }}
          >
            <Text style={styles.buttonText}>Continue with Phantom</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => {
              started.current = false;
              router.setParams({ wallet: "jupiter" });
            }}
          >
            <Text style={styles.buttonText}>Continue with Jupiter</Text>
          </Pressable>
        </View>
      ) : null}

      {displayError ? (
        <Pressable onPress={() => router.replace("/connect")}>
          <Text style={styles.back}>Back to connect</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    textAlign: "center",
  },
  message: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 360,
  },
  actions: {
    width: "100%",
    maxWidth: 360,
    gap: 10,
    marginTop: 8,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  back: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 8,
  },
});
