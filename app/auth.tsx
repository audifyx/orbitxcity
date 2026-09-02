import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

export default function AuthScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      router.replace(session ? "/" : "/connect");
    }
  }, [loading, router, session]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.signal} />
      <Text style={styles.message}>Restoring your OrbitX session…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: colors.void,
  },
  message: {
    color: colors.mute,
    fontSize: 14,
  },
});
