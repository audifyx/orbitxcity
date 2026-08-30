import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { useAuth } from "../../src/lib/auth";
import { privyAppId } from "../../src/lib/env";
import {
  PRIVY_DOMAINS_DASHBOARD_URL,
  readPrivyDashboardStatus,
} from "../../src/lib/privyDashboard";
import { colors } from "../../src/theme";

function OrbitMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle
        cx="28"
        cy="28"
        r="20"
        fill="none"
        stroke={colors.ring}
        strokeWidth="1.2"
      />
      <Line
        x1="16"
        y1="16"
        x2="40"
        y2="40"
        stroke={colors.frost}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Line
        x1="40"
        y1="16"
        x2="16"
        y2="40"
        stroke={colors.frost}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Circle cx="28" cy="28" r="3" fill={colors.core} />
    </Svg>
  );
}

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connect, connecting, error, clearError, session } = useAuth();

  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    void readPrivyDashboardStatus(privyAppId, origin)
      .then((result) => {
        if (result?.message) {
          setLocalError(result.message);
          setStatus(null);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleSignIn = useCallback(async () => {
    setLocalError(null);
    clearError();
    setStatus("Opening email or phone sign-in. OrbitX will create your wallet.");
    try {
      const result = await connect();
      if (result) {
        router.replace("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      setLocalError(message);
      setStatus(null);
    }
  }, [clearError, connect, router]);

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [router, session]);

  const displayError = localError ?? error;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <OrbitMark />
        <Text style={styles.title}>Sign in to OrbitX</Text>
        <Text style={styles.subtitle}>
          Use your email or phone. Privy creates your in-app wallet and account.
          You stay signed in until you log out.
        </Text>

        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
            {displayError.includes("Allowed origins") ? (
              <Pressable
                onPress={() => void Linking.openURL(PRIVY_DOMAINS_DASHBOARD_URL)}
                accessibilityRole="link"
                accessibilityLabel="Open Privy Domains"
              >
                <Text style={styles.dashboardLink}>Open Privy Domains</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {status && !displayError ? (
          <Text style={styles.status}>{status}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            connecting && styles.primaryButtonDisabled,
          ]}
          onPress={() => void handleSignIn()}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Continue with email or phone"
        >
          {connecting ? (
            <ActivityIndicator color={colors.frost} />
          ) : (
            <Text style={styles.primaryButtonText}>
              Continue with email or phone
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.void,
  },
  root: {
    flexGrow: 1,
    backgroundColor: colors.void,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 16,
    maxWidth: 360,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    letterSpacing: -0.4,
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  status: {
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorBox: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 90, 90, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 120, 120, 0.25)",
  },
  errorText: {
    color: "#FF9A9A",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  dashboardLink: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
});
