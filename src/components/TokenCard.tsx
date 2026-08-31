import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type TokenCardProps = {
  symbol: string;
  price: string;
  marketCap: string;
  liquidity: string;
  volume: string;
  risk: string;
  onBuy?: () => void;
  onSell?: () => void;
  onAnalyze?: () => void;
  onTrack?: () => void;
  /** Present only when the caller has a real numeric market cap to build a ladder from. */
  onLadder?: () => void;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = "default",
}: {
  label: string;
  onPress?: () => void;
  variant?: "default" | "accent";
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        variant === "accent" && styles.actionBtnAccent,
        pressed && styles.actionPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.actionLabel,
          variant === "accent" && styles.actionLabelAccent,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TokenCard({
  symbol,
  price,
  marketCap,
  liquidity,
  volume,
  risk,
  onBuy,
  onSell,
  onAnalyze,
  onTrack,
  onLadder,
}: TokenCardProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>{symbol.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        <View style={styles.riskBadge}>
          <Text style={styles.riskLabel}>RISK</Text>
          <Text style={styles.riskValue}>{risk}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric label="MCAP" value={marketCap} />
        <Metric label="LIQ" value={liquidity} />
        <Metric label="VOL" value={volume} />
      </View>

      <View style={styles.actions}>
        <ActionButton label="Buy" onPress={onBuy} variant="accent" />
        <ActionButton label="Sell" onPress={onSell} />
        <ActionButton label="Analyze" onPress={onAnalyze} />
        <ActionButton label="Track" onPress={onTrack} />
        {onLadder ? <ActionButton label="Ladder" onPress={onLadder} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.glass,
    padding: 14,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.ice,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 13,
  },
  headerMeta: {
    flex: 1,
    gap: 2,
  },
  symbol: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.4,
  },
  price: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  riskBadge: {
    alignItems: "flex-end",
    gap: 2,
  },
  riskLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  riskValue: {
    color: colors.warning,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  metrics: {
    flexDirection: "row",
    gap: 10,
  },
  metric: {
    flex: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  metricLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.1,
  },
  metricValue: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  actionBtnAccent: {
    backgroundColor: "rgba(126, 182, 255, 0.12)",
    borderColor: "rgba(126, 182, 255, 0.28)",
  },
  actionPressed: {
    opacity: 0.72,
  },
  actionLabel: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  actionLabelAccent: {
    color: colors.ice,
  },
});
