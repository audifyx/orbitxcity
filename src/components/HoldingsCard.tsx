import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatTokenAmount, formatUsd } from "../lib/portfolio";
import { colors } from "../theme";

type HoldingRow = {
  mint: string;
  symbol: string;
  balance: number;
  usdValue?: number;
};

export type HoldingsCardProps = {
  address: string;
  portfolio: string;
  pnl?: string;
  solBalance?: number;
  holdings?: HoldingRow[];
  onOpenWallet?: () => void;
};

function shortAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function HoldingsCard({
  address,
  portfolio,
  pnl,
  solBalance,
  holdings = [],
  onOpenWallet,
}: HoldingsCardProps) {
  const pnlNegative = (pnl ?? "").trim().startsWith("-");

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.kicker}>LIVE HOLDINGS</Text>
        <Text style={styles.address}>{shortAddress(address)}</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>PORTFOLIO</Text>
          <Text style={styles.statValue}>{portfolio}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>24H</Text>
          <Text
            style={[
              styles.statValue,
              pnl ? (pnlNegative ? styles.pnlDown : styles.pnlUp) : null,
            ]}
          >
            {pnl ?? "—"}
          </Text>
        </View>
      </View>

      {typeof solBalance === "number" ? (
        <View style={styles.solRow}>
          <Text style={styles.tokenSymbol}>SOL</Text>
          <Text style={styles.tokenBalance}>
            {formatTokenAmount(solBalance)}
          </Text>
        </View>
      ) : null}

      {holdings.length === 0 ? (
        <Text style={styles.empty}>No SPL tokens with balance yet.</Text>
      ) : (
        holdings.map((token) => (
          <View key={token.mint} style={styles.tokenRow}>
            <View style={styles.tokenMeta}>
              <Text style={styles.tokenSymbol}>{token.symbol}</Text>
              <Text style={styles.tokenMint}>
                {token.mint.slice(0, 4)}…{token.mint.slice(-4)}
              </Text>
            </View>
            <View style={styles.tokenAmounts}>
              <Text style={styles.tokenBalance}>
                {formatTokenAmount(token.balance)}
              </Text>
              {token.usdValue !== undefined ? (
                <Text style={styles.tokenUsd}>{formatUsd(token.usdValue)}</Text>
              ) : null}
            </View>
          </View>
        ))
      )}

      {onOpenWallet ? (
        <Pressable style={styles.button} onPress={onOpenWallet}>
          <Text style={styles.buttonText}>Open wallet</Text>
        </Pressable>
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
    gap: 10,
  },
  header: {
    gap: 4,
  },
  kicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.8,
  },
  address: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 16,
  },
  stats: {
    flexDirection: "row",
    gap: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 10,
    gap: 4,
  },
  statLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  statValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  pnlUp: {
    color: colors.success,
  },
  pnlDown: {
    color: colors.danger,
  },
  solRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tokenMeta: {
    flex: 1,
    gap: 2,
  },
  tokenSymbol: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  tokenMint: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  tokenAmounts: {
    alignItems: "flex-end",
    gap: 2,
  },
  tokenBalance: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  tokenUsd: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.signal,
    marginTop: 4,
  },
  buttonText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
