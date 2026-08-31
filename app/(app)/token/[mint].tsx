import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DexChart, LimitLadder, type LadderOrder } from "../../../src/components";
import { fetchTradeHistory, type TradeIntent } from "../../../src/lib/tradeHistory";
import { colors } from "../../../src/theme";

type Params = {
  mint: string;
  symbol?: string;
  price?: string;
  marketCap?: string;
  marketCapValue?: string;
  liquidity?: string;
  volume?: string;
  risk?: string;
  pairAddress?: string;
};

function Metric({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value ?? "—"}</Text>
    </View>
  );
}

export default function TokenDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const mint = typeof params.mint === "string" ? params.mint : "";
  const symbol = typeof params.symbol === "string" ? params.symbol : "—";
  const marketCapValue = params.marketCapValue ? Number(params.marketCapValue) : undefined;
  const pairAddress = typeof params.pairAddress === "string" ? params.pairAddress : undefined;

  const [showLadder, setShowLadder] = useState(false);
  const [intents, setIntents] = useState<TradeIntent[] | null>(null);
  const [loadingIntents, setLoadingIntents] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchTradeHistory("ALL")
      .then((all) => {
        if (cancelled) return;
        setIntents(all.filter((i) => i.mint === mint));
      })
      .catch(() => {
        if (!cancelled) setIntents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingIntents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const quote = (context: string) =>
    router.push({ pathname: "/", params: { context } });

  const placeLadder = (
    orders: LadderOrder[],
    context: { mint: string; symbol: string; currentMc: number },
  ) => {
    const lines = orders
      .map(
        (o) =>
          `${o.side} ${o.allocationPct}% of my ${context.symbol} position when MC ${
            o.targetChangePct >= 0 ? "reaches" : "drops to"
          } ~$${Math.round(o.targetMc).toLocaleString()} (${o.targetChangePct >= 0 ? "+" : ""}${o.targetChangePct.toFixed(1)}% from current MC $${Math.round(context.currentMc).toLocaleString()})`,
      )
      .join("; ");
    quote(
      `Set up this limit ladder for ${context.symbol} (${context.mint}): ${lines}. Confirm each order with me before submitting.`,
    );
    setShowLadder(false);
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.price}>{params.price ?? "—"}</Text>
          <Text style={styles.risk}>{params.risk ?? "—"}</Text>
        </View>

        <View style={styles.metrics}>
          <Metric label="MCAP" value={params.marketCap} />
          <Metric label="LIQUIDITY" value={params.liquidity} />
          <Metric label="VOLUME 24H" value={params.volume} />
        </View>

        {pairAddress ? (
          <DexChart pairAddress={pairAddress} symbol={symbol} />
        ) : (
          <View style={styles.noChart}>
            <Text style={styles.noChartText}>
              No DexScreener pair found for this mint yet — chart unavailable.
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.action, styles.actionAccent]}
            onPress={() => quote(`Quote buying 0.1 SOL of ${symbol} (${mint}). Do not execute.`)}
          >
            <Text style={styles.actionAccentText}>Buy</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => quote(`Quote selling ${symbol} (${mint}) back to SOL. Do not execute.`)}
          >
            <Text style={styles.actionText}>Sell</Text>
          </Pressable>
          {marketCapValue != null ? (
            <Pressable style={styles.action} onPress={() => setShowLadder(true)}>
              <Text style={styles.actionText}>Ladder</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.ordersCard}>
          <Text style={styles.sectionLabel}>ORDER ACTIVITY (THIS DEVICE)</Text>
          {loadingIntents ? (
            <ActivityIndicator color={colors.signal} style={{ marginVertical: 12 }} />
          ) : intents && intents.length > 0 ? (
            intents.slice(0, 20).map((i) => (
              <View key={i.id} style={styles.orderRow}>
                <Text style={styles.orderKind}>{i.kind}</Text>
                <Text style={styles.orderStatus}>{i.status}</Text>
                <Text style={styles.orderTime}>
                  {new Date(i.createdAt).toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyOrders}>
              No preview, submitted, confirmed, or failed orders for this token yet.
            </Text>
          )}
        </View>
      </ScrollView>

      {showLadder && marketCapValue != null ? (
        <View style={styles.ladderOverlay}>
          <Pressable
            style={styles.ladderBackdrop}
            onPress={() => setShowLadder(false)}
            accessibilityRole="button"
            accessibilityLabel="Close ladder"
          />
          <View style={styles.ladderSheet}>
            <LimitLadder
              mint={mint}
              symbol={symbol}
              currentMc={marketCapValue}
              onPlace={placeLadder}
            />
            <Pressable style={styles.ladderClose} onPress={() => setShowLadder(false)}>
              <Text style={styles.ladderCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  header: { gap: 2 },
  symbol: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  price: {
    color: colors.ice,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  risk: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 10,
    gap: 2,
  },
  metricLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1,
  },
  metricValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  noChart: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: "center",
  },
  noChartText: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  actionAccent: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  actionText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  actionAccentText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  ordersCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  orderKind: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  orderStatus: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  orderTime: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  emptyOrders: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
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
