import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LimitLadder, PerformancePanel, PortfolioView, type LadderOrder, type PortfolioToken } from "../../src/components";
import { useAuth } from "../../src/lib/auth";
import { openExternalUrl } from "../../src/lib/walletOpen";
import { fetchWalletData, type WalletSnapshot } from "../../src/lib/walletSnapshot";
import { colors } from "../../src/theme";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wallet, disconnect, connect, connecting } = useAuth();

  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ladderToken, setLadderToken] = useState<PortfolioToken | null>(null);
  const [activeTab, setActiveTab] = useState<"portfolio" | "performance">("portfolio");

  const load = useCallback(async () => {
    if (!wallet) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchWalletData(wallet));
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
    router.push({ pathname: "/", params: { context } });
  }, [router, wallet]);

  const copyAddress = useCallback(async () => {
    if (!wallet) {
      return;
    }
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.clipboard
    ) {
      try {
        await navigator.clipboard.writeText(wallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Could not copy address.");
      }
    }
  }, [wallet]);

  const openExplorer = useCallback(() => {
    if (wallet) {
      void openExternalUrl(`https://solscan.io/account/${wallet}`);
    }
  }, [wallet]);

  const exportWallet = useCallback(() => {
    setError("Connect Phantom Wallet before trading.");
  }, []);

  const connectJupiter = useCallback(async () => {
    setError(null);
    try {
      await connect("jupiter");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Phantom Wallet.");
    }
  }, [connect, load]);

  const buyToken = useCallback(
    (token: PortfolioToken) => {
      router.push({
        pathname: "/",
        params: {
          context: `Quote buying more ${token.symbol} (${token.mint}). Do not execute.`,
        },
      });
    },
    [router],
  );

  const sellToken = useCallback(
    (token: PortfolioToken) => {
      router.push({
        pathname: "/",
        params: {
          context: `Quote selling my ${token.symbol} (${token.mint}) position back to SOL. Do not execute.`,
        },
      });
    },
    [router],
  );

  const placeLadder = useCallback(
    (orders: LadderOrder[], context: { mint: string; symbol: string; currentMc: number }) => {
      // Draft only — the agent still has to run the existing jupiter-order
      // tool (confirmationRequired: true) and the user still signs in their
      // wallet. This never executes anything directly.
      const lines = orders
        .map(
          (o) =>
            `${o.side} ${o.allocationPct}% of my ${context.symbol} position when MC ${
              o.targetChangePct >= 0 ? "reaches" : "drops to"
            } ~$${Math.round(o.targetMc).toLocaleString()} (${o.targetChangePct >= 0 ? "+" : ""}${o.targetChangePct.toFixed(1)}% from current MC $${Math.round(
              context.currentMc,
            ).toLocaleString()})`,
        )
        .join("; ");
      router.push({
        pathname: "/",
        params: {
          context: `Set up this limit ladder for ${context.symbol} (${context.mint}): ${lines}. Confirm each order with me before submitting.`,
        },
      });
      setLadderToken(null);
    },
    [router],
  );

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Connect Phantom Wallet to trade</Text>
      </View>

      {!wallet ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.empty}>
            Your Supabase account is ready. Connect Phantom Wallet to view holdings and approve swaps.
          </Text>
          <Pressable style={styles.connectButton} onPress={() => void connectJupiter()} disabled={connecting}>
            {connecting ? <ActivityIndicator color={colors.void} /> : <Text style={styles.connectButtonText}>Connect Phantom Wallet</Text>}
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, activeTab === "portfolio" && styles.tabActive]}
              onPress={() => setActiveTab("portfolio")}
            >
              <Text style={[styles.tabText, activeTab === "portfolio" && styles.tabTextActive]}>
                Portfolio
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "performance" && styles.tabActive]}
              onPress={() => setActiveTab("performance")}
            >
              <Text style={[styles.tabText, activeTab === "performance" && styles.tabTextActive]}>
                Performance
              </Text>
            </Pressable>
          </View>

          {activeTab === "portfolio" ? (
            <View style={styles.portfolio}>
              <PortfolioView
                address={wallet}
                totalUsd={snapshot?.totalUsd}
                solBalance={snapshot?.solBalance}
                pnl24h={snapshot?.pnl24h}
                pnl7d={snapshot?.pnl7d}
                tokens={snapshot?.tokens ?? []}
                loading={loading}
                error={error}
                copied={copied}
                onCopyAddress={() => void copyAddress()}
                onOpenExplorer={openExplorer}
                onRefresh={() => void load()}
                onAskOrbitX={askOrbitX}
                onExport={exportWallet}
                onLogout={() => void disconnect()}
                onBuyToken={buyToken}
                onSellToken={sellToken}
                onLadderToken={setLadderToken}
              />
            </View>
          ) : (
            <View style={styles.portfolio}>
              <PerformancePanel />
            </View>
          )}
        </>
      )}

      {ladderToken && ladderToken.marketCapUsd != null ? (
        <View style={styles.ladderOverlay}>
          <Pressable
            style={styles.ladderBackdrop}
            onPress={() => setLadderToken(null)}
            accessibilityRole="button"
            accessibilityLabel="Close ladder"
          />
          <View style={styles.ladderSheet}>
            <LimitLadder
              mint={ladderToken.mint}
              symbol={ladderToken.symbol}
              currentMc={ladderToken.marketCapUsd}
              onPlace={placeLadder}
            />
            <Pressable style={styles.ladderClose} onPress={() => setLadderToken(null)}>
              <Text style={styles.ladderCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 2,
  },
  portfolio: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
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
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  emptyBlock: {
    padding: 20,
    gap: 14,
  },
  connectButton: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  connectButtonText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    padding: 20,
  },
  ladderOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  ladderBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  ladderSheet: {
    padding: 16,
    paddingBottom: 28,
    gap: 10,
    backgroundColor: colors.abyss,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  ladderClose: {
    alignItems: "center",
    paddingVertical: 10,
  },
  ladderCloseText: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
