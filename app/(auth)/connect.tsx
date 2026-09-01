import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import bs58 from "bs58";
import { Buffer } from "buffer";
import {
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  useLoginWithSMS,
} from "@privy-io/expo";

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

/**
 * Privy's embedded Solana wallet returns a signature as a string, but the
 * SDK docs don't pin the exact encoding across versions. This tries the
 * encodings actually seen in the wild (base58 raw, base64, hex) and only
 * accepts one that decodes to a real 64-byte ed25519 signature — never
 * guesses or passes through something unverified.
 */
function normalizePrivySignature(raw: string): string {
  const trimmed = raw.trim();

  try {
    if (bs58.decode(trimmed).length === 64) {
      return trimmed;
    }
  } catch {
    // not base58 — try the next encoding
  }

  try {
    const fromBase64 = Buffer.from(trimmed, "base64");
    if (fromBase64.length === 64) {
      return bs58.encode(fromBase64);
    }
  } catch {
    // not base64 — try the next encoding
  }

  try {
    const fromHex = Buffer.from(trimmed.replace(/^0x/, ""), "hex");
    if (fromHex.length === 64) {
      return bs58.encode(fromHex);
    }
  } catch {
    // fall through to the error below
  }

  throw new Error("Unexpected signature format from the embedded wallet.");
}

type Method = "email" | "phone";
type Step = "enter" | "code";

/**
 * Real in-app authentication using Privy's native React Native SDK —
 * email/SMS OTP happens entirely inside the app, no browser redirect, no
 * origin-allowlist issue (that only ever applied to the hosted browser
 * page). Once Privy confirms the OTP, this gets/creates the user's
 * embedded Solana wallet, signs the exact same nonce challenge the hosted
 * flow used, and finishes through the exact same signInWithSignature ->
 * wallet-auth verify -> Supabase session path already in use everywhere
 * else in the app. Wallet export intentionally still uses the hosted
 * ogscan.fun page — this only replaces login.
 */
function NativeConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithSignature, session } = useAuth();

  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<Step>("enter");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailLogin = useLoginWithEmail();
  const smsLogin = useLoginWithSMS();
  const solanaWallet = useEmbeddedSolanaWallet();

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [router, session]);

  const active = method === "email" ? emailLogin : smsLogin;
  const sending = active.state.status === "sending-code";
  const submittingCode = active.state.status === "submitting-code";

  const handleSendCode = useCallback(async () => {
    setError(null);
    const value = identifier.trim();
    if (!value) {
      setError(method === "email" ? "Enter your email." : "Enter your phone number.");
      return;
    }
    try {
      if (method === "email") {
        await emailLogin.sendCode({ email: value });
      } else {
        await smsLogin.sendCode({ phone: value });
      }
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code.");
    }
  }, [emailLogin, identifier, method, smsLogin]);

  const { requestSignInMessage } = useAuth();

  const handleVerify = useCallback(async () => {
    setError(null);
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Enter the code we sent you.");
      return;
    }
    setFinishing(true);
    try {
      if (method === "email") {
        await emailLogin.loginWithCode({ code: trimmedCode });
      } else {
        await smsLogin.loginWithCode({ code: trimmedCode });
      }

      let wallet = solanaWallet.wallets?.[0];
      if (!wallet) {
        if (solanaWallet.create) {
          await solanaWallet.create();
        }
        wallet = solanaWallet.wallets?.[0];
      }
      if (!wallet) {
        throw new Error("OrbitX could not set up your wallet. Try again.");
      }

      const pubkey = wallet.address;
      const nonceMessage = await requestSignInMessage(pubkey);
      const provider = await wallet.getProvider();
      const { signature } = await provider.request({
        method: "signMessage",
        params: { message: nonceMessage },
      });
      const normalized = normalizePrivySignature(signature);
      await signInWithSignature(pubkey, normalized);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setFinishing(false);
    }
  }, [
    code,
    emailLogin,
    method,
    requestSignInMessage,
    router,
    signInWithSignature,
    smsLogin,
    solanaWallet,
  ]);

  const busy = sending || submittingCode || finishing;

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
          Use your email or phone. OrbitX creates your in-app wallet — this
          all happens right here, no browser needed.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === "enter" ? (
          <>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, method === "email" && styles.tabActive]}
                onPress={() => setMethod("email")}
              >
                <Text style={[styles.tabText, method === "email" && styles.tabTextActive]}>
                  Email
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, method === "phone" && styles.tabActive]}
                onPress={() => setMethod("phone")}
              >
                <Text style={[styles.tabText, method === "phone" && styles.tabTextActive]}>
                  Phone
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={method === "email" ? "you@example.com" : "+1 555 555 5555"}
              placeholderTextColor={colors.mute}
              autoCapitalize="none"
              keyboardType={method === "email" ? "email-address" : "phone-pad"}
              style={styles.input}
              editable={!busy}
            />

            <Pressable
              style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
              onPress={() => void handleSendCode()}
              disabled={busy}
            >
              {sending ? (
                <ActivityIndicator color={colors.void} />
              ) : (
                <Text style={styles.primaryButtonText}>Send code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.status}>
              Enter the code sent to {identifier}.
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.mute}
              keyboardType="number-pad"
              style={styles.input}
              editable={!busy}
            />
            <Pressable
              style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
              onPress={() => void handleVerify()}
              disabled={busy}
            >
              {submittingCode || finishing ? (
                <ActivityIndicator color={colors.void} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setStep("enter");
                setCode("");
                setError(null);
              }}
              disabled={busy}
            >
              <Text style={styles.dashboardLink}>Use a different email or phone</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function WebConnectScreen() {
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

export default function ConnectScreen() {
  // Platform.OS never changes for the lifetime of the app, so this decides
  // which whole component tree to render — it does not conditionally call
  // hooks within a single component instance. Each of WebConnectScreen and
  // NativeConnectScreen calls its own hooks unconditionally within itself.
  if (Platform.OS === "web") {
    return <WebConnectScreen />;
  }
  return <NativeConnectScreen />;
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
  tabs: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tabActive: {
    borderColor: colors.signal,
  },
  tabText: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.frost,
  },
  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    color: colors.frost,
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
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
