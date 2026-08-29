import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { useAuth } from "../../src/lib/auth";
import { type WalletId } from "../../src/lib/wallets";
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

const WALLETS: { id: WalletId; label: string; hint: string }[] = [
  { id: "jupiter", label: "Jupiter", hint: "Opens Jupiter via Mobile Wallet Adapter" },
  { id: "phantom", label: "Phantom", hint: "Opens Phantom via Mobile Wallet Adapter" },
];

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ wallet?: string | string[] }>();
  const { connect, connecting, error, clearError } = useAuth();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const handleConnect = useCallback(
    async (walletId: WalletId) => {
      setLocalError(null);
      clearError();
      setPickerOpen(false);
      setStatus(
        walletId === "jupiter"
          ? "Opening Jupiter through Mobile Wallet Adapter… approve, then sign."
          : "Opening Phantom through Mobile Wallet Adapter… approve, then sign.",
      );
      try {
        await connect(walletId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Wallet connection failed.";
        setLocalError(message);
        setStatus(null);
      }
    },
    [clearError, connect],
  );

  useEffect(() => {
    const raw = params.wallet;
    const hinted = Array.isArray(raw) ? raw[0] : raw;
    if (autoStarted.current) {
      return;
    }
    if (hinted === "jupiter" || hinted === "phantom") {
      autoStarted.current = true;
      void (async () => {
        setLocalError(null);
        clearError();
        setStatus(
          hinted === "jupiter"
            ? "Jupiter is open. Approve Mobile Wallet Adapter, then sign."
            : "Phantom is open. Approve Mobile Wallet Adapter, then sign.",
        );
        try {
          await connect(hinted, { injectedOnly: true });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Wallet connection failed.";
          setLocalError(message);
          setStatus(null);
        }
      })();
    }
  }, [clearError, connect, params.wallet]);

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
        <Text style={styles.title}>Connect wallet</Text>
        <Text style={styles.subtitle}>
          Tap connect and pick Jupiter or Phantom. OrbitX uses Mobile Wallet
          Adapter to open the wallet — approve connect, then sign. That
          sign-in is not a transaction.
        </Text>

        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
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
          onPress={() => {
            setLocalError(null);
            clearError();
            setPickerOpen(true);
          }}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Connect wallet"
        >
          {connecting ? (
            <ActivityIndicator color={colors.frost} />
          ) : (
            <Text style={styles.primaryButtonText}>Connect Wallet</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>Choose a wallet</Text>
            {WALLETS.map((wallet) => (
              <Pressable
                key={wallet.id}
                style={({ pressed }) => [
                  styles.walletRow,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={() => void handleConnect(wallet.id)}
                disabled={connecting}
              >
                <Text style={styles.walletName}>{wallet.label}</Text>
                <Text style={styles.walletHint}>{wallet.hint}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPickerOpen(false)}>
              <Text style={styles.back}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sheetTitle: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 6,
  },
  walletRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.composer,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  walletName: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  walletHint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  back: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 8,
  },
});
