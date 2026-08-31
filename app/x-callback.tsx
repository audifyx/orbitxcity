import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { completeXOAuthFromUrl } from "../src/lib/xConnect";
import { colors } from "../src/theme";

export default function XCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const url = (await Linking.getInitialURL()) ?? "";
        if (!url.includes("code=")) {
          throw new Error("No authorization code in callback URL.");
        }
        await completeXOAuthFromUrl(url);
        if (!cancelled) {
          router.replace("/social");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "X connection failed.",
          );
          setTimeout(() => router.replace("/social"), 2400);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.root}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.signal} size="large" />
      )}
      <Text style={styles.label}>
        {error ? "Returning to Social…" : "Finishing X connection…"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  label: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
