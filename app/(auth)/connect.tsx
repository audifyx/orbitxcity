import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { useAuth } from "../../src/lib/auth";
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
  const { connect, connecting, error } = useAuth();

  const handleConnect = useCallback(async () => {
    await connect();
  }, [connect]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.content}>
        <OrbitMark />
        <Text style={styles.title}>Connect your Solana wallet</Text>
        <Text style={styles.subtitle}>
          Wallet is your account. No email. No password.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            connecting && styles.primaryButtonDisabled,
          ]}
          onPress={handleConnect}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Connect Phantom wallet"
        >
          {connecting ? (
            <ActivityIndicator color={colors.frost} />
          ) : (
            <Text style={styles.primaryButtonText}>Connect Phantom</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
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
  primaryButton: {
    width: "100%",
    marginTop: 12,
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
