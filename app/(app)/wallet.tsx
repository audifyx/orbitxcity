import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExportKeySheet } from "../../src/components/ExportKeySheet";
import { useAuth } from "../../src/lib/auth";
import { copyText } from "../../src/lib/clipboard";
import type { ExportPageStatus } from "../../src/lib/exportWallet";
import {
  formatPnl,
  formatTokenAmount,
  formatUsd,
  loadWalletSnapshot,
  type WalletSnapshot,
} from "../../src/lib/portfolio";
import { colors } from "../../src/theme";

function formatExportResult(status: ExportPageStatus, error?: string): string {
  if (status === "success") {
    return "Privy closed the export window. OrbitX never received your key.";
  }
  if (status === "error") {
    return error ?? "Privy could not export this wallet.";
  }
  return "Export closed. Your key stayed in Privy.";
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wallet, disconnect } = useAuth();

  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) {
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await loadWalletSnapshot(wallet);
      setSnapshot(data);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  const askOrbitX = useCallback(() => {
    const context = wallet
      ? `Analyze my wallet ${wallet} — holdings, risk, and opportunities.`
      : "Help me understand my Solana wallet.";
    router.push({
      pathname: "/(app)",
      params: { context },
    });
  }, [router, wallet]);

  const copyAddress = useCallback(async () => {
    if (!wallet) {
      return;
    }
    const ok = await copyText(wallet);
    if (!ok) {
      setError("Could not copy this address.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [wallet]);

  const confirmExport = useCallback(() => {
    Alert.alert(
      "Export secret key",
      "Privy will show your encoded secret key. OrbitX never receives it. Anyone with this key can take your funds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            setExportNote(null);
            setExportOpen(true);
          },
        },
      ],
    );
  }, []);

  const handleExportResult = useCallback(
    (status: ExportPageStatus, exportError?: string) => {
      setExportNote(formatExportResult(status, exportError));
    },
    [],
  );

  const tokens = snapshot?.tokens ?? [];
  const pnlNegative = (snapshot?.pnl24h ?? 0) < 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>
        Email or phone created this Solana wallet in Privy. OrbitX only stores
        the public address. The secret key never comes to our servers.
      </Text>

      {!wallet ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No wallet yet</Text>
          <Text style={styles.cardBody}>
            Sign in with email or phone and OrbitX creates this wallet for you.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardKicker}>IN-APP · PRIVY</Text>
            <Text style={styles.cardTitle}>Address</Text>
            <Text selectable style={styles.fullAddress}>
              {wallet}
            </Text>
            <Pressable
              style={styles.copyBtn}
              onPress={() => void copyAddress()}
              accessibilityRole="button"
              accessibilityLabel="Copy wallet address"
            >
              <Text style={styles.copyBtnText}>
                {copied ? "Copied" : "Copy address"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardKicker}>PORTFOLIO</Text>
            {loading ? (
              <ActivityIndicator color={colors.signal} style={styles.loader} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <>
                <Text style={styles.totalValue}>
                  {formatUsd(snapshot?.totalUsd)}
                </Text>
                <Text style={styles.totalHint}>Estimated value</Text>
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>SOL</Text>
                    <Text style={styles.statValue}>
                      {snapshot?.solBalance != null
                        ? formatTokenAmount(snapshot.solBalance)
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>24h PnL</Text>
                    <Text
                      style={[
                        styles.statValue,
                        snapshot?.pnl24h != null
                          ? pnlNegative
                            ? styles.pnlDown
                            : styles.pnlUp
                          : null,
                      ]}
                    >
                      {formatPnl(snapshot?.pnl24h)}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>7d PnL</Text>
                    <Text style={styles.statValue}>
                      {formatPnl(snapshot?.pnl7d)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardKicker}>HOLDINGS</Text>
            {loading ? (
              <ActivityIndicator color={colors.signal} style={styles.loader} />
            ) : tokens.length === 0 ? (
              <Text style={styles.muted}>
                No token balances yet. SOL and tokens you receive show up here.
              </Text>
            ) : (
              tokens.map((token) => (
                <View key={token.mint} style={styles.tokenRow}>
                  <View style={styles.tokenMeta}>
                    <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                    <Text selectable style={styles.tokenMint}>
                      {token.mint}
                    </Text>
                  </View>
                  <View style={styles.tokenAmounts}>
                    <Text style={styles.tokenBalance}>
                      {formatTokenAmount(token.balance)}
                    </Text>
                    <Text style={styles.tokenUsd}>
                      {formatUsd(token.usdValue)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable style={styles.exportButton} onPress={confirmExport}>
            <Text style={styles.exportButtonText}>Export key</Text>
            <Text style={styles.exportButtonHint}>
              Encoded in Privy. We never see it.
            </Text>
          </Pressable>

          {exportNote ? (
            <Text style={styles.exportNote}>{exportNote}</Text>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={askOrbitX}>
            <Text style={styles.primaryButtonText}>Ask OrbitX</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => void load()}>
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>

          <Pressable
            style={styles.dangerButton}
            onPress={() => void disconnect()}
          >
            <Text style={styles.dangerButtonText}>Log out</Text>
          </Pressable>

          <ExportKeySheet
            visible={exportOpen}
            address={wallet}
            onClose={() => setExportOpen(false)}
            onResult={handleExportResult}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    gap: 10,
  },
  cardKicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 17,
  },
  cardBody: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  fullAddress: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  copyBtn: {
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  copyBtnText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  loader: {
    marginTop: 8,
  },
  errorText: {
    color: "#FF9A9A",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  totalValue: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 32,
  },
  totalHint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: -4,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.ink,
  },
  statLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  statValue: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    marginTop: 4,
  },
  pnlUp: {
    color: colors.success,
  },
  pnlDown: {
    color: colors.danger,
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tokenMeta: {
    flex: 1,
    gap: 4,
  },
  tokenSymbol: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  tokenMint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  tokenAmounts: {
    alignItems: "flex-end",
    gap: 4,
  },
  tokenBalance: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  tokenUsd: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  exportButton: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(126, 182, 255, 0.35)",
    backgroundColor: "rgba(126, 182, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 2,
  },
  exportButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  exportButtonHint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  exportNote: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  dangerButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#FF8A8A",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
