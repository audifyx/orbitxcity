import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import { SimpleBarChart } from "./SimpleBarChart";
import {
  computeTradeStats,
  fetchTradeHistory,
  type TimeRange,
  type TradeStats,
} from "../lib/tradeHistory";

const RANGES: TimeRange[] = ["1D", "7D", "30D", "ALL"];

function formatUsd(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${value.toFixed(2)}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function PerformancePanel() {
  const [range, setRange] = useState<TimeRange>("7D");
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTradeHistory(range)
      .then((intents) => {
        if (!cancelled) setStats(computeTradeStats(intents, range));
      })
      .catch((err) => {
        if (!cancelled) {
          setStats(null);
          setError(err instanceof Error ? err.message : "Failed to load trade history");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const barPoints = useMemo(
    () => (stats?.byDay ?? []).slice(-14).map((d) => ({ label: dayLabel(d.date), value: d.count })),
    [stats],
  );

  return (
    <View style={styles.root}>
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={[styles.rangeChip, r === range && styles.rangeChipActive]}
          >
            <Text style={[styles.rangeText, r === range && styles.rangeTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading && !stats ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.signal} />
        </View>
      ) : stats ? (
        <>
          <View style={styles.statGrid}>
            <StatCard label="TOTAL TRADES" value={String(stats.totalIntents)} />
            <StatCard label="CONFIRMED" value={String(stats.confirmed)} />
            <StatCard label="FAILED" value={String(stats.failed)} />
            <StatCard label="TRADING DAYS" value={String(stats.tradingDays)} />
            <StatCard
              label="VOLUME"
              value={formatUsd(stats.volumeUsd)}
              sub={
                stats.volumeUnknownCount > 0
                  ? `${stats.volumeUnknownCount} trade${stats.volumeUnknownCount === 1 ? "" : "s"} without a sized quote`
                  : undefined
              }
            />
            <StatCard label="TRADES / DAY" value={stats.tradesPerDay.toFixed(1)} />
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.sectionLabel}>TRADES PER DAY</Text>
            <SimpleBarChart points={barPoints} />
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              Win rate, average win/loss, and best/worst trade need matched buy→sell
              cost-basis tracking this app doesn't have yet — shown here as real trade
              counts and volume only, not filled in with guesses.
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  rangeRow: { flexDirection: "row", gap: 8 },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rangeChipActive: {
    borderColor: colors.signal,
  },
  rangeText: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  rangeTextActive: {
    color: colors.frost,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    flexBasis: "31%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 10,
    gap: 2,
  },
  statLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1,
  },
  statValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  statSub: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
  },
  chartCard: {
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
  noteBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  noteText: {
    color: colors.dim,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  centered: { paddingVertical: 32, alignItems: "center" },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 120, 90, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 150, 120, 0.25)",
  },
  errorText: {
    color: "#FFB899",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
