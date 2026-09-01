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
import { Buffer } from "buffer";

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

function encodeSignatureBytes(bytes: Uint8Array): string | null {
  if (bytes.length !== 64) {
    return null;
  }
  const encoded = bs58.encode(bytes);
  return isSolanaSignature(encoded) ? encoded : null;
}

function encodeSignatureString(value: string): string | null {
  const trimmed = value.trim();
  if (isSolanaSignature(trimmed)) {
    return trimmed;
  }

  const hex = trimmed.replace(/^0x/, "");
  if (/^[0-9a-fA-F]{128}$/.test(hex)) {
    return encodeSignatureBytes(Uint8Array.from(Buffer.from(hex, "hex")));
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    try {
      return encodeSignatureBytes(
        Uint8Array.from(Buffer.from(trimmed, "base64")),
      );
    } catch {
      return null;
    }
  }
  return null;
}

function toBase58Signature(value: unknown): string {
  if (typeof value === "string") {
    const encoded = encodeSignatureString(value);
    if (encoded) {
      return encoded;
    }
  }
  if (value instanceof Uint8Array) {
    const encoded = encodeSignatureBytes(value);
    if (encoded) {
      return encoded;
    }
  }
  if (Array.isArray(value)) {
    const encoded = encodeSignatureBytes(Uint8Array.from(value));
    if (encoded) {
      return encoded;
    }
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const nested of [rec.signature, rec.data, rec.result]) {
      if (nested !== undefined) {
        try {
          return toBase58Signature(nested);
        } catch {
          // Try the next native response shape.
        }
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
    lower.includes("client id") ||
    lower.includes("client_id") ||
    lower.includes("allowed_native") ||
    lower.includes("invalid origin")
  ) {
    return "Privy is not set up for Expo Go yet. In the Privy dashboard Clients tab, add app identifiers host.exp.Exponent and ai.orbitx.app, URL schemes exp and orbitx, then set EXPO_PUBLIC_PRIVY_CLIENT_ID. Stay in this app.";
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
    setStatus("Requesting a fresh sign-in nonce…");
    const message = await requestSignInMessage(wallet.address);
    setStatus("Sign the fresh nonce challenge. This is not a transaction.");
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
      if (user) {
        setStatus("You are already signed in. Finishing your OrbitX session…");
        await finishWalletSession();
        return;
      }
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
  }, [emailLogin, finishWalletSession, identifier, mode, smsLogin, user]);

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
        await emailLogin.loginWithCode({ code: otp });
      } else {
        await smsLogin.loginWithCode({ code: otp });
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
    localError ?? (!user && privyError ? friendlyPrivyError(privyError) : null);
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
            {codeSent
              ? "Verify and enter OrbitX"
              : user
                ? "Continue to OrbitX"
                : "Send code"}
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
