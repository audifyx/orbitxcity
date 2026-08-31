import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { useAuth } from "../lib/auth";
import { fetchWalletData } from "../lib/walletSnapshot";
import { computeTradeStats, fetchTradeHistory } from "../lib/tradeHistory";

type Snapshot = {
  totalUsd?: number;
  pnl24h?: number;
  tradesToday?: number;
  pendingToday?: number;
};

function formatUsd(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${value.toFixed(2)}`;
}

function formatPct(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pnlColor(value?: number): string {
  if (value == null) return colors.mute;
  return value >= 0 ? colors.success : colors.danger;
}

/**
 * Compact real-data strip for Home. Deliberately does not replace or wrap
 * the existing ChatThread — it sits above it. Every number here comes from
 * the same wallet-portfolio backends and orbitx_ai_transaction_intents
 * table already used on the Wallet screen; nothing here is invented.
 */
export function HomeSnapshotBar() {
  const { wallet } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchWalletData(wallet), fetchTradeHistory("1D")])
      .then(([walletData, intents]) => {
        if (cancelled) return;
        const stats = computeTradeStats(intents, "1D");
        setSnapshot({
          totalUsd: walletData.totalUsd,
          pnl24h: walletData.pnl24h,
          tradesToday: stats.confirmed,
          pendingToday: stats.pending,
        });
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (!wallet || (!snapshot && !loading)) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.item}>
        <Text style={styles.label}>PORTFOLIO</Text>
        <Text style={styles.value}>{formatUsd(snapshot?.totalUsd)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <Text style={styles.label}>24H</Text>
        <Text style={[styles.value, { color: pnlColor(snapshot?.pnl24h) }]}>
          {formatPct(snapshot?.pnl24h)}
        </Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <Text style={styles.label}>TODAY</Text>
        <Text style={styles.value}>
          {snapshot?.tradesToday ?? 0} confirmed
          {snapshot?.pendingToday ? ` · ${snapshot.pendingToday} pending` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  item: {
    flex: 1,
    gap: 1,
  },
  label: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1,
  },
  value: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.hairline,
    marginHorizontal: 10,
  },
});
