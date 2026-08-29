import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

export default function OnConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const url = Linking.useURL();
  const { session, completeNativeConnect, error, connecting } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const href = url ?? (await Linking.getInitialURL());
    if (!href) {
      return;
    }
    try {
      await completeNativeConnect(href);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Phantom connect failed.");
    }
  }, [url, completeNativeConnect]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [session, router]);

  const displayError = localError ?? error;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {displayError ? (
        <>
          <Text style={styles.title}>Wallet connect failed</Text>
          <Text style={styles.message}>{displayError}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.signal} size="large" />
          <Text style={styles.title}>
            {connecting ? "Opening Phantom…" : "Connecting wallet"}
          </Text>
          <Text style={styles.message}>
            Completing Sign-In with Solana. You will be asked to sign a nonce
            message — this is not a transaction.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 20,
    marginTop: 16,
    textAlign: "center",
  },
  message: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
});
