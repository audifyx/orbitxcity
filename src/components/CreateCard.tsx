import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type CreateCardProps = {
  kind: "launch" | "nft";
  name: string;
  symbol: string;
  note?: string;
  status?: "preview" | "signing" | "confirmed" | "failed";
  mint?: string;
  signature?: string;
  onOpen?: () => void;
  onApprove?: () => void;
};

export function CreateCard({
  kind,
  name,
  symbol,
  note,
  status = "preview",
  mint,
  signature,
  onOpen,
  onApprove,
}: CreateCardProps) {
  const canApprove = status === "preview" && onApprove;
  const actionLabel =
    kind === "launch" ? "Approve & launch" : "Approve & mint";

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>
        {kind === "launch" ? "PUMP.FUN CREATE" : "NFT MINT"}
      </Text>
      <Text style={styles.title}>
        {name || (kind === "launch" ? "New coin" : "New NFT")}
      </Text>
      <Text style={styles.symbol}>{symbol || "—"}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {status === "signing" ? (
        <Text style={styles.pending}>
          {kind === "launch" ? "Launching on chain…" : "Minting on chain…"}
        </Text>
      ) : null}
      {status === "confirmed" && mint ? (
        <Text style={styles.success}>
          Live · {mint.slice(0, 6)}…{mint.slice(-4)}
          {signature ? ` · ${signature.slice(0, 8)}…` : ""}
        </Text>
      ) : null}
      {status === "failed" ? (
        <Text style={styles.error}>
          {kind === "launch" ? "Launch failed" : "Mint failed"} — try again.
        </Text>
      ) : null}
      {canApprove ? (
        <View style={styles.row}>
          <Pressable style={styles.ghost} onPress={onOpen}>
            <Text style={styles.ghostText}>Open desk</Text>
          </Pressable>
          <Pressable style={styles.solid} onPress={onApprove}>
            <Text style={styles.solidText}>{actionLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126, 182, 255, 0.22)",
    backgroundColor: "rgba(8, 12, 22, 0.92)",
    padding: 14,
    gap: 8,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.8,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 18,
  },
  symbol: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  note: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  pending: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  success: {
    color: colors.success,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  ghost: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: colors.mist,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  solid: {
    flex: 1.3,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  solidText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
