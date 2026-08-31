import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type OrderCardStatus =
  | "pending"
  | "triggered"
  | "confirmed"
  | "failed"
  | "cancelled";

export type OrderCardProps = {
  percent: number;
  triggerType: "mcap" | "price";
  triggerValue: number;
  symbol?: string;
  mint?: string;
  status: OrderCardStatus;
  signature?: string;
  onCancel?: () => void;
  onOpenDashboard?: () => void;
};

const STATUS_LABEL: Record<OrderCardStatus, string> = {
  pending: "Pending",
  triggered: "Triggering",
  confirmed: "Confirmed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function statusColor(status: OrderCardStatus): string {
  switch (status) {
    case "confirmed":
      return colors.success;
    case "failed":
    case "cancelled":
      return colors.danger;
    case "triggered":
      return colors.warning;
    default:
      return colors.signal;
  }
}

function formatTarget(type: "mcap" | "price", value: number): string {
  if (type === "mcap") {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M mcap`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K mcap`;
    }
    return `$${value.toLocaleString()} mcap`;
  }
  return `$${value}`;
}

export function OrderCard({
  percent,
  triggerType,
  triggerValue,
  symbol,
  status,
  signature,
  onCancel,
  onOpenDashboard,
}: OrderCardProps) {
  const label = symbol ? symbol : "token";
  const canCancel = status === "pending" && onCancel;

  return (
    <View style={styles.root}>
      <Text style={styles.line}>
        Limit sell {percent}% of {label} when {formatTarget(triggerType, triggerValue)} hits.
      </Text>
      <View style={styles.metaRow}>
        <View style={[styles.badge, { borderColor: statusColor(status) }]}>
          <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
          <Text style={[styles.badgeText, { color: statusColor(status) }]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
        {signature ? (
          <Pressable
            onPress={() => void Linking.openURL(`https://solscan.io/tx/${signature}`)}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Solscan ↗</Text>
          </Pressable>
        ) : onOpenDashboard ? (
          <Pressable onPress={onOpenDashboard} accessibilityRole="button">
            <Text style={styles.link}>Open desk ↗</Text>
          </Pressable>
        ) : null}
      </View>
      {canCancel ? (
        <Pressable
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          onPress={onCancel}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel order</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
    gap: 8,
    paddingLeft: 2,
  },
  line: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  link: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  cancel: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  cancelText: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
