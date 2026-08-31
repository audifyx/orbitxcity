import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export type ClaimCardProps = {
  claimableSol?: number;
  status?: "preview" | "claiming" | "confirmed" | "failed";
  signature?: string;
  onClaim?: () => void;
};

export function ClaimCard({
  claimableSol,
  status = "preview",
  signature,
  onClaim,
}: ClaimCardProps) {
  const canClaim = status === "preview" && onClaim;
  const amountLabel =
    typeof claimableSol === "number" && claimableSol > 0
      ? `${claimableSol.toFixed(4)} SOL`
      : "your pump.fun creator fees";

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>◎</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Claim creator fees</Text>
        <Text style={styles.body}>
          Collect {amountLabel} from every coin you launched on pump.fun — one
          signature, auto-signed with your OrbitX wallet.
        </Text>
        {status === "confirmed" && signature ? (
          <Text style={styles.success}>Claimed · {signature.slice(0, 8)}…</Text>
        ) : null}
        {status === "failed" ? (
          <Text style={styles.error}>Claim failed — try again in a moment.</Text>
        ) : null}
      </View>
      {canClaim ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={onClaim}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Claim now</Text>
        </Pressable>
      ) : status === "claiming" ? (
        <Text style={styles.pending}>Claiming…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126, 182, 255, 0.22)",
    backgroundColor: "rgba(8, 12, 22, 0.92)",
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(126, 182, 255, 0.12)",
  },
  icon: {
    color: colors.signal,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 18,
  },
  copy: {
    gap: 6,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 16,
  },
  body: {
    color: colors.mist,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
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
  pending: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  button: {
    alignSelf: "flex-start",
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.signal,
  },
  buttonText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.78,
  },
});
