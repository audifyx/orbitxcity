import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type TxPreviewStatus =
  | "preview"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";

export type TxPreviewProps = {
  inAmount: string;
  outAmount: string;
  slippage: string;
  route: string;
  warnings?: string[];
  status: TxPreviewStatus;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const STATUS_LABELS: Record<TxPreviewStatus, string> = {
  preview: "Preview",
  awaiting_signature: "Awaiting signature",
  submitted: "Submitted",
  confirming: "Confirming",
  confirmed: "Confirmed",
  failed: "Failed",
};

function statusColor(status: TxPreviewStatus): string {
  switch (status) {
    case "confirmed":
      return colors.success;
    case "failed":
      return colors.danger;
    case "confirming":
    case "submitted":
    case "awaiting_signature":
      return colors.warning;
    default:
      return colors.signal;
  }
}

export function TxPreview({
  inAmount,
  outAmount,
  slippage,
  route,
  warnings = [],
  status,
  onConfirm,
  onCancel,
}: TxPreviewProps) {
  const canConfirm = status === "preview" || status === "awaiting_signature";
  const isTerminal = status === "confirmed" || status === "failed";

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.kicker}>TX PREVIEW</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor(status) }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
          <Text style={[styles.statusText, { color: statusColor(status) }]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      <View style={styles.swapRow}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>IN</Text>
          <Text style={styles.amountValue}>{inAmount}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>OUT</Text>
          <Text style={styles.amountValue}>{outAmount}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>SLIPPAGE</Text>
          <Text style={styles.metaValue}>{slippage}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>ROUTE</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {route}
          </Text>
        </View>
      </View>

      {warnings.length > 0 ? (
        <View style={styles.warnings}>
          {warnings.map((warning, index) => (
            <View key={`${index}-${warning}`} style={styles.warningRow}>
              <Text style={styles.warningIcon}>!</Text>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!isTerminal ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && styles.pressed,
            ]}
            onPress={onCancel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>

          {canConfirm ? (
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={styles.confirmLabel}>Confirm in wallet</Text>
            </Pressable>
          ) : (
            <View style={styles.pendingBtn}>
              <Text style={styles.pendingLabel}>Waiting for wallet…</Text>
            </View>
          )}
        </View>
      ) : null}
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
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  amountBlock: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  amountLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  amountValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  arrow: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaItem: {
    flex: 1,
    gap: 4,
  },
  metaLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.1,
  },
  metaValue: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  warnings: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  warningRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  warningIcon: {
    color: colors.warning,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 18,
  },
  warningText: {
    flex: 1,
    color: colors.warning,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelLabel: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  confirmBtn: {
    flex: 1.4,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126, 182, 255, 0.32)",
    backgroundColor: "rgba(126, 182, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmLabel: {
    color: colors.ice,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  pendingBtn: {
    flex: 1.4,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingLabel: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
