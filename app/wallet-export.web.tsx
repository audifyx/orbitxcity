import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useExportWallet, useWallets } from "@privy-io/react-auth/solana";

import { EXPORT_CHANNEL } from "../src/lib/exportWallet";
import { privyAppId } from "../src/lib/env";
import { isSolanaPubkey } from "../src/lib/wallets";
import { colors } from "../src/theme";

function readAddress(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("address")?.trim() ?? "";
}

function postExportResult(status: "success" | "error" | "closed", error?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload = JSON.stringify({
    source: EXPORT_CHANNEL,
    status,
    error,
  });
  const webView = (
    window as Window & { ReactNativeWebView?: { postMessage: (value: string) => void } }
  ).ReactNativeWebView;
  if (webView && typeof webView.postMessage === "function") {
    webView.postMessage(payload);
  }
}

function ExportBody() {
  const { ready, authenticated, login, error: privyError } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { exportWallet } = useExportWallet();
  const [status, setStatus] = useState("Preparing Privy export…");
  const [error, setError] = useState<string | null>(null);
  const loginOpened = useRef(false);
  const exporting = useRef(false);
  const expected = useMemo(() => {
    const address = readAddress();
    return isSolanaPubkey(address) ? address : "";
  }, []);

  const matchingWallet = useMemo(() => {
    if (expected) {
      return wallets.find((wallet) => wallet.address === expected);
    }
    return wallets[0];
  }, [expected, wallets]);

  const openLogin = useCallback(() => {
    setError(null);
    setStatus("Confirm the same email or phone. OrbitX never sees your key.");
    try {
      login({ loginMethods: ["email", "sms"] });
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Could not open Privy login.",
      );
    }
  }, [login]);

  const startExport = useCallback(async () => {
    if (exporting.current) {
      return;
    }
    if (!matchingWallet) {
      setError(
        expected
          ? "This login does not own the OrbitX wallet on this phone."
          : "No Privy Solana wallet is attached to this login.",
      );
      return;
    }
    exporting.current = true;
    setError(null);
    setStatus("Privy is opening the secret-key window…");
    try {
      await exportWallet({ address: matchingWallet.address });
      postExportResult("success");
      setStatus("Done. OrbitX never received your key.");
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Privy could not export this wallet.";
      setError(message);
      postExportResult("error", message);
    } finally {
      exporting.current = false;
    }
  }, [expected, exportWallet, matchingWallet]);

  useEffect(() => {
    if (privyError) {
      setError(privyError.message);
    }
  }, [privyError]);

  useEffect(() => {
    if (!ready || authenticated || loginOpened.current) {
      return;
    }
    loginOpened.current = true;
    openLogin();
  }, [authenticated, openLogin, ready]);

  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || exporting.current) {
      return;
    }
    if (!matchingWallet) {
      setError(
        expected
          ? "This login does not own the OrbitX wallet on this phone."
          : "No Privy Solana wallet is attached to this login.",
      );
      return;
    }
    void startExport();
  }, [authenticated, expected, matchingWallet, ready, startExport, walletsReady]);

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>PRIVY · USER-CONTROLLED</Text>
      <Text style={styles.title}>Export your secret key</Text>
      <Text style={styles.body}>
        {error ?? status}
      </Text>
      {expected ? <Text selectable style={styles.address}>{expected}</Text> : null}
      <Pressable style={styles.primary} onPress={authenticated ? () => void startExport() : openLogin}>
        <Text style={styles.primaryText}>
          {authenticated ? "Show key in Privy" : "Confirm email or phone"}
        </Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => postExportResult("closed")}>
        <Text style={styles.ghostText}>Close</Text>
      </Pressable>
    </View>
  );
}

export default function WalletExportScreen() {
  if (!privyAppId) {
    return (
      <View style={styles.root}>
        <Text style={styles.body}>OrbitX is missing the Privy App ID on this build.</Text>
      </View>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7EB6FF",
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "sms"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <ExportBody />
    </PrivyProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    textAlign: "center",
  },
  body: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 420,
  },
  address: {
    color: colors.ice,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
  },
  primary: {
    minHeight: 48,
    minWidth: 220,
    borderRadius: 14,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  ghost: {
    minHeight: 44,
    minWidth: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(126, 182, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
