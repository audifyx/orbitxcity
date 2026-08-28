import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type WalletCardProps = {
  address: string;
  portfolio: string;
  pnl: string;
  onAnalyze?: () => void;
  onTrack?: () => void;
};

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletCard({
  address,
  portfolio,
  pnl,
  onAnalyze,
  onTrack,
}: WalletCardProps) {
  const pnlIsNegative = pnl.trim().startsWith("-");

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>◎</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.label}>WALLET</Text>
          <Text style={styles.address}>{shortenAddress(address)}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>PORTFOLIO</Text>
          <Text style={styles.statValue}>{portfolio}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>PNL</Text>
          <Text
            style={[
              styles.statValue,
              pnlIsNegative ? styles.pnlNegative : styles.pnlPositive,
            ]}
          >
            {pnl}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={onAnalyze}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>Analyze</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnAccent,
            pressed && styles.pressed,
          ]}
          onPress={onTrack}
          accessibilityRole="button"
        >
          <Text style={[styles.actionLabel, styles.actionLabelAccent]}>Track</Text>
        </Pressable>
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
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.signal,
    fontSize: 18,
    fontFamily: "Inter_500Medium",
  },
  headerMeta: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
  },
  address: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  statLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.1,
  },
  statValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  pnlPositive: {
    color: colors.success,
  },
  pnlNegative: {
    color: colors.danger,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnAccent: {
    backgroundColor: "rgba(126, 182, 255, 0.12)",
    borderColor: "rgba(126, 182, 255, 0.28)",
  },
  pressed: {
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
