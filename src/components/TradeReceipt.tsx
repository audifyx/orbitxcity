import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";
import type { TxPreviewStatus } from "./TxPreview";

export type TradeReceiptProps = {
  side: "buy" | "sell";
  status: TxPreviewStatus;
  amountLabel?: string;
  signature?: string;
};

function statusColor(status: TxPreviewStatus): string {
  switch (status) {
    case "confirmed":
      return colors.success;
    case "failed":
      return colors.danger;
    default:
      return colors.signal;
  }
}

export function TradeReceipt({
  side,
  status,
  amountLabel,
  signature,
}: TradeReceiptProps) {
  const verb = side === "sell" ? "Sell" : "Buy";
  const detail =
    status === "confirmed"
      ? `${verb} confirmed${amountLabel ? ` · ${amountLabel}` : ""}`
      : status === "failed"
        ? `${verb} failed`
        : `${verb} in flight${amountLabel ? ` · ${amountLabel}` : ""}`;

  return (
    <View style={styles.root}>
      <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
      <Text style={styles.text}>{detail}</Text>
      {signature ? (
        <Pressable
          onPress={() => void Linking.openURL(`https://solscan.io/tx/${signature}`)}
          accessibilityRole="link"
        >
          <Text style={styles.link}>Solscan</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  link: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
