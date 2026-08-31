import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExportKeySheet } from "../../src/components/ExportKeySheet";
import { useAuth } from "../../src/lib/auth";
import { copyText } from "../../src/lib/clipboard";
import {
  executeDexSwap,
  resolveTradeAmount,
  type TradeSide,
} from "../../src/lib/dexTrade";
import type { ExportPageStatus } from "../../src/lib/exportWallet";
import {
  DEFAULT_BUY_USD,
  formatBuySol,
  formatSwapError,
  suggestBuySol,
} from "../../src/lib/swapGuard";
import {
  formatPnl,
  formatTokenAmount,
  formatUsd,
  loadWalletSnapshot,
  ORBITX_MINT,
  resolveSellAmount,
  type WalletSnapshot,
} from "../../src/lib/portfolio";
import {
  fetchWalletTrades,
  formatTradeTime,
  type WalletTrade,
} from "../../src/lib/walletTrades";
import { colors } from "../../src/theme";

type WalletTab = "holdings" | "trade" | "trades" | "security";

const SELL_PERCENTS = [25, 50, 75, 100] as const;

function formatExportResult(status: ExportPageStatus, error?: string): string {
  if (status === "success") {
    return "Privy showed your key in its own window. OrbitX never received it.";
  }
  if (status === "error") {
    return error ?? "Privy could not export this wallet.";
  }
  return "Export closed. Your key stays in Privy only.";
}

function shortMint(mint: string): string {
  if (mint.length <= 12) {
    return mint;
  }
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wallet, disconnect } = useAuth();

  const [tab, setTab] = useState<WalletTab>("holdings");
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [trades, setTrades] = useState<WalletTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [tradeMint, setTradeMint] = useState(ORBITX_MINT);
  const [tradeAmount, setTradeAmount] = useState("");
  const [defaultBuySol, setDefaultBuySol] = useState("");
  const [tradeSide, setTradeSide] = useState<TradeSide>("buy");
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
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

  const loadTrades = useCallback(async () => {
    if (!wallet) {
      setTrades([]);
      return;
    }

    setTradesLoading(true);
    setTradesError(null);
    try {
      const rows = await fetchWalletTrades(wallet, 30);
      setTrades(rows);
    } catch (err) {
      setTrades([]);
      setTradesError(
        err instanceof Error ? err.message : "Could not load trades",
      );
    } finally {
      setTradesLoading(false);
    }
  }, [wallet]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPortfolio(), loadTrades()]);
  }, [loadPortfolio, loadTrades]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (tab === "trades") {
      void loadTrades();
    }
  }, [loadTrades, tab]);

  useEffect(() => {
    if (!wallet) {
      return;
    }
    let cancelled = false;
    void suggestBuySol(wallet)
      .then((sol) => {
        if (cancelled) {
          return;
        }
        const text = formatBuySol(sol);
        setDefaultBuySol(text);
        setTradeAmount((current) =>
          current === "" || current === "0.05" ? text : current,
        );
      })
      .catch(() => {
        // Keep the field empty until they type an amount.
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

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

  const openSolscan = useCallback(() => {
    if (!wallet) {
      return;
    }
    void Linking.openURL(`https://solscan.io/account/${wallet}`);
  }, [wallet]);

  const confirmExport = useCallback(() => {
    Alert.alert(
      "Export secret key",
      "Privy opens its own export window inside this sheet. Confirm the same email or phone you used to sign in. Anyone with the key can drain your wallet.",
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

  const runTrade = useCallback(
    async (side: TradeSide, mint = tradeMint, amountText = tradeAmount) => {
      if (!wallet) {
        setTradeStatus("Sign in to trade.");
        return;
      }
      const amount = Number(amountText);
      if (!Number.isFinite(amount) || amount <= 0) {
        setTradeStatus(
          side === "sell" ? "Enter a token amount." : "Enter a SOL amount.",
        );
        return;
      }
      setTradeBusy(true);
      setTradeStatus(null);
      setTradeSide(side);
      setTradeMint(mint);
      try {
        const resolved =
          side === "sell"
            ? await resolveTradeAmount({
                wallet,
                side,
                mint: mint.trim(),
                amount,
              })
            : amount;
        const result = await executeDexSwap({
          wallet,
          side,
          mint: mint.trim(),
          amount: resolved,
        });
        setTradeStatus(
          `${side === "sell" ? "Sold" : "Bought"} on Jupiter · ${result.signature}`,
        );
        void refreshAll();
      } catch (err) {
        setTradeStatus(formatSwapError(err));
      } finally {
        setTradeBusy(false);
      }
    },
    [refreshAll, tradeAmount, tradeMint, wallet],
  );

  const applySellPercent = useCallback(
    async (percent: number, mint = tradeMint) => {
      if (!wallet) {
        return;
      }
      setTradeSide("sell");
      setTradeMint(mint);
      try {
        const amount = await resolveSellAmount(wallet, mint, { percent });
        setTradeAmount(String(amount));
        setTradeStatus(null);
      } catch (err) {
        setTradeStatus(
          err instanceof Error ? err.message : "Could not set sell amount.",
        );
      }
    },
    [tradeMint, wallet],
  );

  const selectTokenForTrade = useCallback(
    (mint: string, side: TradeSide, balance?: number) => {
      setTradeMint(mint);
      setTradeSide(side);
      setTab("trade");
      if (side === "buy") {
        setTradeAmount(defaultBuySol);
      } else if (balance && balance > 0) {
        setTradeAmount(String(Number(balance.toPrecision(9))));
      }
    },
    [defaultBuySol],
  );

  const tokens = snapshot?.tokens ?? [];
  const pnlNegative = (snapshot?.pnl24h ?? 0) < 0;

  const tabs: { id: WalletTab; label: string }[] = [
    { id: "holdings", label: "Holdings" },
    { id: "trade", label: "Trade" },
    { id: "trades", label: "Trades" },
    { id: "security", label: "Security" },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={loading || tradesLoading}
          onRefresh={() => void refreshAll()}
          tintColor={colors.signal}
        />
      }
    >
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>
        Privy embedded Solana wallet. OrbitX only stores your public address.
      </Text>

      <Pressable
        style={styles.ordersLink}
        onPress={() => router.push("/orders")}
        accessibilityRole="button"
      >
        <Text style={styles.ordersLinkText}>Limit order desk →</Text>
      </Pressable>

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
            <Text selectable style={styles.fullAddress}>
              {wallet}
            </Text>
            <View style={styles.addressActions}>
              <Pressable
                style={styles.chipBtn}
                onPress={() => void copyAddress()}
              >
                <Text style={styles.chipBtnText}>
                  {copied ? "Copied" : "Copy"}
                </Text>
              </Pressable>
              <Pressable style={styles.chipBtn} onPress={openSolscan}>
                <Text style={styles.chipBtnText}>Solscan</Text>
              </Pressable>
              <Pressable style={styles.chipBtn} onPress={askOrbitX}>
                <Text style={styles.chipBtnText}>Ask OrbitX</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardKicker}>PORTFOLIO</Text>
            {loading && !snapshot ? (
              <ActivityIndicator color={colors.signal} style={styles.loader} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <>
                <Text style={styles.totalValue}>
                  {formatUsd(snapshot?.totalUsd)}
                </Text>
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
                    <Text style={styles.statLabel}>24h</Text>
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
                    <Text style={styles.statLabel}>7d</Text>
                    <Text style={styles.statValue}>
                      {formatPnl(snapshot?.pnl7d)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.tabRow}>
            {tabs.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.tabBtn, tab === item.id && styles.tabBtnLive]}
                onPress={() => setTab(item.id)}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    tab === item.id && styles.tabBtnTextLive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "holdings" ? (
            <View style={styles.card}>
              <Text style={styles.cardKicker}>HOLDINGS</Text>
              {loading ? (
                <ActivityIndicator color={colors.signal} style={styles.loader} />
              ) : (
                <>
                  <View style={styles.tokenRow}>
                    <View style={styles.tokenMeta}>
                      <Text style={styles.tokenSymbol}>SOL</Text>
                      <Text style={styles.tokenMint}>Native balance</Text>
                    </View>
                    <View style={styles.tokenAmounts}>
                      <Text style={styles.tokenBalance}>
                        {snapshot?.solBalance != null
                          ? formatTokenAmount(snapshot.solBalance)
                          : "—"}
                      </Text>
                    </View>
                  </View>
                  {tokens.length === 0 ? (
                    <Text style={styles.muted}>
                      No SPL tokens yet. Swaps and transfers show up here.
                    </Text>
                  ) : (
                    tokens.map((token) => (
                      <View key={token.mint} style={styles.tokenRow}>
                        <View style={styles.tokenMeta}>
                          <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                          <Text selectable style={styles.tokenMint}>
                            {shortMint(token.mint)}
                          </Text>
                        </View>
                        <View style={styles.tokenAmounts}>
                          <Text style={styles.tokenBalance}>
                            {formatTokenAmount(token.balance)}
                          </Text>
                          <Text style={styles.tokenUsd}>
                            {formatUsd(token.usdValue)}
                          </Text>
                          <View style={styles.tokenActions}>
                            <Pressable
                              style={styles.tinyBtn}
                              onPress={() =>
                                selectTokenForTrade(token.mint, "buy")
                              }
                            >
                              <Text style={styles.tinyBtnText}>Buy</Text>
                            </Pressable>
                            <Pressable
                              style={styles.tinyBtn}
                              onPress={() =>
                                selectTokenForTrade(
                                  token.mint,
                                  "sell",
                                  token.balance,
                                )
                              }
                            >
                              <Text style={styles.tinyBtnText}>Sell</Text>
                            </Pressable>
                            <Pressable
                              style={styles.tinyBtn}
                              onPress={() =>
                                void Linking.openURL(
                                  `https://solscan.io/token/${token.mint}`,
                                )
                              }
                            >
                              <Text style={styles.tinyBtnText}>Scan</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          ) : null}

          {tab === "trade" ? (
            <View style={styles.card}>
              <Text style={styles.cardKicker}>SWAP · JUPITER ULTRA</Text>
              <Text style={styles.cardBody}>
                Buy default is ${DEFAULT_BUY_USD.toFixed(2)} of SOL. Sell uses
                token amount — tap a percent chip or type manually.
              </Text>
              <TextInput
                style={styles.input}
                value={tradeMint}
                onChangeText={setTradeMint}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Token mint"
                placeholderTextColor={colors.mute}
              />
              <TextInput
                style={styles.input}
                value={tradeAmount}
                onChangeText={setTradeAmount}
                keyboardType="decimal-pad"
                placeholder={
                  tradeSide === "sell" ? "Token amount" : "SOL amount"
                }
                placeholderTextColor={colors.mute}
              />
              <View style={styles.tradeRow}>
                <Pressable
                  style={[
                    styles.sideBtn,
                    tradeSide === "buy" && styles.sideBtnLive,
                  ]}
                  onPress={() => setTradeSide("buy")}
                >
                  <Text style={styles.sideBtnText}>Buy</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.sideBtn,
                    tradeSide === "sell" && styles.sideBtnLive,
                  ]}
                  onPress={() => setTradeSide("sell")}
                >
                  <Text style={styles.sideBtnText}>Sell</Text>
                </Pressable>
              </View>
              {tradeSide === "sell" ? (
                <View style={styles.percentRow}>
                  {SELL_PERCENTS.map((pct) => (
                    <Pressable
                      key={pct}
                      style={styles.percentChip}
                      onPress={() => void applySellPercent(pct)}
                    >
                      <Text style={styles.percentChipText}>{pct}%</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Pressable
                style={styles.primaryButton}
                disabled={tradeBusy}
                onPress={() => void runTrade(tradeSide)}
              >
                <Text style={styles.primaryButtonText}>
                  {tradeBusy
                    ? "Signing…"
                    : tradeSide === "sell"
                      ? "Approve & sell"
                      : "Approve & buy"}
                </Text>
              </Pressable>
              {tradeStatus ? (
                <Text selectable style={styles.tradeStatus}>
                  {tradeStatus}
                </Text>
              ) : null}
            </View>
          ) : null}

          {tab === "trades" ? (
            <View style={styles.card}>
              <Text style={styles.cardKicker}>RECENT SWAPS</Text>
              {tradesLoading && trades.length === 0 ? (
                <ActivityIndicator color={colors.signal} style={styles.loader} />
              ) : tradesError ? (
                <Text style={styles.errorText}>{tradesError}</Text>
              ) : trades.length === 0 ? (
                <Text style={styles.muted}>
                  No swaps indexed yet. Trades appear after Jupiter fills.
                </Text>
              ) : (
                trades.map((trade, index) => (
                  <View
                    key={`${trade.txHash ?? trade.mint}-${trade.time}-${index}`}
                    style={styles.tradeRow}
                  >
                    <View style={styles.tradeMeta}>
                      <Text
                        style={[
                          styles.tradeSide,
                          trade.side === "buy" ? styles.pnlUp : styles.pnlDown,
                        ]}
                      >
                        {trade.side.toUpperCase()}{" "}
                        {trade.symbol ?? shortMint(trade.mint)}
                      </Text>
                      <Text style={styles.tradeSub}>
                        {formatTokenAmount(trade.tokenAmount)} ·{" "}
                        {trade.solAmount.toFixed(4)} SOL
                        {trade.usd != null ? ` · ${formatUsd(trade.usd)}` : ""}
                      </Text>
                      <Text style={styles.tradeTime}>
                        {formatTradeTime(trade.time)}
                      </Text>
                    </View>
                    {trade.txHash ? (
                      <Pressable
                        style={styles.tinyBtn}
                        onPress={() =>
                          void Linking.openURL(
                            `https://solscan.io/tx/${trade.txHash}`,
                          )
                        }
                      >
                        <Text style={styles.tinyBtnText}>Tx</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === "security" ? (
            <View style={styles.card}>
              <Text style={styles.cardKicker}>SECURITY</Text>
              <Text style={styles.cardBody}>
                Export opens Privy inside an in-app sheet. OrbitX never receives
                your secret key. Anyone with the key can move your funds.
              </Text>
              <Pressable style={styles.exportButton} onPress={confirmExport}>
                <Text style={styles.exportButtonText}>Export private key</Text>
              </Pressable>
              {exportNote ? (
                <Text style={styles.exportNote}>{exportNote}</Text>
              ) : null}
              <Pressable
                style={styles.dangerButton}
                onPress={() => {
                  void disconnect().finally(() => {
                    router.replace("/connect");
                  });
                }}
              >
                <Text style={styles.dangerButtonText}>Log out</Text>
              </Pressable>
            </View>
          ) : null}

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
  ordersLink: {
    alignSelf: "flex-start",
    marginTop: -8,
    marginBottom: 4,
  },
  ordersLinkText: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
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
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  addressActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chipBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  chipBtnText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
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
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
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
  tabRow: {
    flexDirection: "row",
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnLive: {
    borderColor: colors.signal,
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  tabBtnText: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  tabBtnTextLive: {
    color: colors.frost,
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
  tokenActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  tinyBtn: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  tinyBtnText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.frost,
    backgroundColor: colors.ink,
  },
  tradeRow: {
    flexDirection: "row",
    gap: 8,
  },
  sideBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtnLive: {
    borderColor: colors.signal,
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  sideBtnText: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  percentRow: {
    flexDirection: "row",
    gap: 8,
  },
  percentChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  percentChipText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  tradeStatus: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  tradeMeta: {
    flex: 1,
    gap: 2,
  },
  tradeSide: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  tradeSub: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  tradeTime: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  exportButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(126, 182, 255, 0.35)",
    backgroundColor: "rgba(126, 182, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  exportButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  exportNote: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
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
  dangerButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  dangerButtonText: {
    color: "#FF8A8A",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
