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
    return?: string | string[];
  }>();
  const { signInWithSignature, session, connecting, error } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing OrbitX sign-in…");
  const started = useRef(false);

  const pubkey = firstParam(params.pubkey);
  const signature = firstParam(params.signature);
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
      if (Platform.OS === "web" && returnTo && isSafeAppReturn(returnTo) && callback) {
        window.location.replace(appendAuthResult(returnTo, callback));
        return;
      }
      router.replace("/");
    }
  }, [callback, returnTo, router, session]);

  useEffect(() => {
    if (!callback) {
      return;
    }
    setStatus("Connecting your OrbitX wallet…");
    if (Platform.OS !== "web" || started.current) {
      return;
    }
    started.current = true;
    void finishInApp(callback.pubkey, callback.signature).catch((err) => {
      setLocalError(err instanceof Error ? err.message : "Sign-in failed.");
      setStatus("");
    });
  }, [callback, finishInApp]);

  useEffect(() => {
    if (callback || started.current || Platform.OS !== "web") {
      return;
    }
    started.current = true;
    const nativeReturn = returnTo && isSafeAppReturn(returnTo) ? returnTo : "";
    setStatus("Opening email or phone sign-in. OrbitX will create your wallet.");
    window.location.assign(privyHostUrl(nativeReturn || undefined));
  }, [callback, returnTo]);

  const displayError = localError ?? error;

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
            "Use your email or phone. OrbitX creates an in-app wallet for this account."}
        </Text>
      )}

      {!displayError && (connecting || Boolean(callback)) ? (
        <ActivityIndicator color={colors.signal} size="large" />
      ) : null}

      {displayError ? (
        <Pressable onPress={() => router.replace("/connect")}>
          <Text style={styles.back}>Back to sign in</Text>
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
  back: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 8,
  },
});
