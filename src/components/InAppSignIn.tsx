import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  useLoginWithSMS,
  usePrivy,
} from "@privy-io/expo";
import bs58 from "bs58";

import { useAuth } from "../lib/auth";
import { isSolanaPubkey, isSolanaSignature } from "../lib/wallets";
import { colors } from "../theme";

type Mode = "email" | "phone";

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string): string {
  const trimmed = value.trim().replace(/[\s()-]/g, "");
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}

function isE164Phone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function toBase58Signature(value: unknown): string {
  if (typeof value === "string" && isSolanaSignature(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    const encoded = bs58.encode(value);
    if (isSolanaSignature(encoded)) {
      return encoded;
    }
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.signature === "string" && isSolanaSignature(rec.signature)) {
      return rec.signature;
    }
    if (rec.signature instanceof Uint8Array) {
      const encoded = bs58.encode(rec.signature);
      if (isSolanaSignature(encoded)) {
        return encoded;
      }
    }
  }
  throw new Error("OrbitX wallet did not return a valid signature.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyPrivyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Sign-in failed.";
  const lower = message.toLowerCase();
  if (
    lower.includes("app identifier") ||
    lower.includes("application identifier") ||
    lower.includes("allowed_native")
  ) {
    return "This Expo Go build is not on the OrbitX Privy client yet. Stay in the app and try again.";
  }
  if (lower.includes("invalid origin")) {
    return "Sign-in stays in this app. Reload Expo Go and send the code again.";
  }
  return message;
}

export function InAppSignIn() {
  const { isReady, user, error: privyError } = usePrivy();
  const emailLogin = useLoginWithEmail();
  const smsLogin = useLoginWithSMS();
  const solana = useEmbeddedSolanaWallet();
  const solanaRef = useRef(solana);
  solanaRef.current = solana;
  const resumed = useRef(false);
  const { requestSignInMessage, signInWithSignature, connecting } = useAuth();

  const [mode, setMode] = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finishWalletSession = useCallback(async () => {
    setStatus("Creating your OrbitX wallet…");
    const deadline = Date.now() + 45_000;
    let current = solanaRef.current;
    let wallets = current.wallets ?? [];
    if (wallets.length === 0 && typeof current.create === "function") {
      try {
        await current.create();
      } catch (createError) {
        const text =
          createError instanceof Error ? createError.message.toLowerCase() : "";
        if (!text.includes("already")) {
          throw createError;
        }
      }
    }
    while (wallets.length === 0 && Date.now() < deadline) {
      await sleep(200);
      current = solanaRef.current;
      wallets = current.wallets ?? [];
    }
    const wallet = wallets.find((item) => isSolanaPubkey(item.address));
    if (!wallet) {
      throw new Error(
        "Could not create your OrbitX wallet. Check the code and try again.",
      );
    }
    setStatus("Approve the sign-in. This is not a transaction.");
    const message = await requestSignInMessage(wallet.address);
    const provider = await wallet.getProvider();
    const signed = await provider.request({
      method: "signMessage",
      params: { message },
    });
    await signInWithSignature(wallet.address, toBase58Signature(signed));
  }, [requestSignInMessage, signInWithSignature]);

  const sendCode = useCallback(async () => {
    setLocalError(null);
    setBusy(true);
    try {
      if (mode === "email") {
        const email = identifier.trim().toLowerCase();
        if (!looksLikeEmail(email)) {
          throw new Error("Enter a valid email address.");
        }
        await emailLogin.sendCode({ email });
      } else {
        const phone = normalizePhone(identifier);
        if (!isE164Phone(phone)) {
          throw new Error("Enter a phone number with country code, like +15551234567.");
        }
        await smsLogin.sendCode({ phone });
      }
      setCodeSent(true);
      setStatus("Enter the code we sent you.");
    } catch (error) {
      setLocalError(friendlyPrivyError(error));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [emailLogin, identifier, mode, smsLogin]);

  const verifyCode = useCallback(async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const otp = code.trim();
      if (!/^\d{4,8}$/.test(otp)) {
        throw new Error("Enter the code from your email or texts.");
      }
      setStatus("Checking your code…");
      if (mode === "email") {
        await emailLogin.loginWithCode({
          code: otp,
          email: identifier.trim().toLowerCase(),
        });
      } else {
        await smsLogin.loginWithCode({
          code: otp,
          phone: normalizePhone(identifier),
        });
      }
      await finishWalletSession();
    } catch (error) {
      setLocalError(friendlyPrivyError(error));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [code, emailLogin, finishWalletSession, identifier, mode, smsLogin]);

  useEffect(() => {
    if (!isReady || !user || resumed.current) {
      return;
    }
    resumed.current = true;
    setBusy(true);
    setStatus("Finishing your OrbitX wallet…");
    void finishWalletSession()
      .catch((error) => {
        setLocalError(friendlyPrivyError(error));
        setStatus(null);
      })
      .finally(() => {
        setBusy(false);
      });
  }, [finishWalletSession, isReady, user]);

  const displayError =
    localError ?? (privyError ? friendlyPrivyError(privyError) : null);
  const working = busy || connecting;

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.signal} />
        <Text style={styles.status}>Starting in-app sign-in…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.form}
    >
      <View style={styles.modes}>
        {(["email", "phone"] as const).map((item) => {
          const active = mode === item;
          return (
            <Pressable
              key={item}
              onPress={() => {
                setMode(item);
                setCodeSent(false);
                setCode("");
                setLocalError(null);
                setStatus(null);
              }}
              style={[styles.modeButton, active && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, active && styles.modeTextActive]}>
                {item === "email" ? "Email" : "Phone"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={mode === "email" ? "email-address" : "phone-pad"}
        placeholder={mode === "email" ? "you@email.com" : "+15551234567"}
        placeholderTextColor={colors.mute}
        style={styles.input}
        editable={!working}
      />

      {codeSent ? (
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="Code"
          placeholderTextColor={colors.mute}
          style={styles.input}
          editable={!working}
        />
      ) : null}

      {displayError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{displayError}</Text>
        </View>
      ) : null}

      {status && !displayError ? <Text style={styles.status}>{status}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
          working && styles.primaryButtonDisabled,
        ]}
        onPress={() => void (codeSent ? verifyCode() : sendCode())}
        disabled={working}
        accessibilityRole="button"
        accessibilityLabel={codeSent ? "Verify code" : "Send code"}
      >
        {working ? (
          <ActivityIndicator color={colors.frost} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {codeSent ? "Verify and enter OrbitX" : "Send code"}
          </Text>
        )}
      </Pressable>

      {codeSent ? (
        <Pressable
          onPress={() => void sendCode()}
          disabled={working}
          accessibilityRole="button"
          accessibilityLabel="Resend code"
        >
          <Text style={styles.resend}>Resend code</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
    gap: 12,
    alignItems: "center",
  },
  center: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  modes: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  modeText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  modeTextActive: {
    color: colors.void,
  },
  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    color: colors.frost,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    paddingHorizontal: 16,
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
  resend: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 6,
  },
});
