import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { useAuth } from "../../src/lib/auth";
import {
  openJupiterMobile,
  walletNeedsManualSiws,
  type WalletId,
} from "../../src/lib/wallets";
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
  const {
    connect,
    connecting,
    error,
    requestSignInMessage,
    signInWithSignature,
    clearError,
  } = useAuth();

  const [jupiterStep, setJupiterStep] = useState(false);
  const [pubkey, setPubkey] = useState("");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConnect = useCallback(
    async (walletId: WalletId) => {
      setLocalError(null);
      clearError();
      if (walletNeedsManualSiws(walletId)) {
        setJupiterStep(true);
        return;
      }
      try {
        await connect(walletId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Wallet connection failed.";
        if (!message || /invalid account|not installed|jupiter_siws_required/i.test(message)) {
          if (walletId === "jupiter") {
            setJupiterStep(true);
          }
          return;
        }
        setLocalError(message);
      }
    },
    [clearError, connect],
  );

  const handleRequestMessage = useCallback(async () => {
    setLocalError(null);
    try {
      const next = await requestSignInMessage(pubkey);
      setMessage(next);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not request a sign-in nonce.",
      );
    }
  }, [pubkey, requestSignInMessage]);

  const handleVerify = useCallback(async () => {
    setLocalError(null);
    try {
      await signInWithSignature(pubkey, signature);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }, [pubkey, signature, signInWithSignature]);

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
        <Text style={styles.title}>Connect your Solana wallet</Text>
        <Text style={styles.subtitle}>
          Wallet is your account. Jupiter or Phantom. No email. No password.
        </Text>

        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        {jupiterStep ? (
          <View style={styles.siws}>
            <Text style={styles.siwsTitle}>Sign in with Jupiter</Text>
            <Text style={styles.siwsBody}>
              No Jupiter extension needed. Paste your Jupiter address, sign the
              OrbitX nonce in the Jupiter app, then paste the signature. This is
              not a transaction and does not cost fees.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Jupiter wallet address"
              placeholderTextColor={colors.mute}
              autoCapitalize="none"
              autoCorrect={false}
              value={pubkey}
              onChangeText={setPubkey}
            />
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={() => void handleRequestMessage()}
              disabled={connecting}
            >
              <Text style={styles.secondaryButtonText}>Request sign-in message</Text>
            </Pressable>
            {message ? (
              <>
                <Text selectable style={styles.messageBox}>
                  {message}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  onPress={() => void Share.share({ message })}
                >
                  <Text style={styles.secondaryButtonText}>Share / copy message</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  onPress={() => void openJupiterMobile()}
                >
                  <Text style={styles.primaryButtonText}>Open Jupiter</Text>
                </Pressable>
                <TextInput
                  style={styles.input}
                  placeholder="Paste base58 signature"
                  placeholderTextColor={colors.mute}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={signature}
                  onChangeText={setSignature}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    connecting && styles.primaryButtonDisabled,
                  ]}
                  onPress={() => void handleVerify()}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color={colors.frost} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify and log in</Text>
                  )}
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={() => setJupiterStep(false)}>
              <Text style={styles.back}>Back to wallets</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                connecting && styles.primaryButtonDisabled,
              ]}
              onPress={() => void handleConnect("jupiter")}
              disabled={connecting}
              accessibilityRole="button"
              accessibilityLabel="Connect Jupiter wallet"
            >
              {connecting ? (
                <ActivityIndicator color={colors.frost} />
              ) : (
                <Text style={styles.primaryButtonText}>Connect Jupiter</Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.primaryButtonPressed,
                connecting && styles.primaryButtonDisabled,
              ]}
              onPress={() => void handleConnect("phantom")}
              disabled={connecting}
              accessibilityRole="button"
              accessibilityLabel="Connect Phantom wallet"
            >
              <Text style={styles.secondaryButtonText}>Connect Phantom</Text>
            </Pressable>
          </>
        )}
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
  siws: {
    width: "100%",
    gap: 12,
  },
  siwsTitle: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 18,
    textAlign: "center",
  },
  siwsBody: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingHorizontal: 14,
  },
  messageBox: {
    width: "100%",
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
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
  secondaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
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
  secondaryButtonText: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  back: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 8,
  },
});
