import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../theme";

export type PortfolioToken = {
  mint: string;
  symbol: string;
  name?: string;
  /** Amount of the token the wallet holds. */
  amount: number;
  /** USD value of the holding, if known. */
  usdValue?: number;
  /** Unit price in USD, if known. */
  priceUsd?: number;
  /** Share of the wallet's total USD value (0–100). */
  allocationPct?: number;
  /** Share of the token's circulating supply this wallet holds (0–100). */
  supplyPct?: number;
};

export type PortfolioViewProps = {
  address: string;
  totalUsd?: number;
  solBalance?: number;
  pnl24h?: number;
  pnl7d?: number;
  tokens: PortfolioToken[];
  loading?: boolean;
  error?: string | null;
  copied?: boolean;
  onCopyAddress?: () => void;
  onOpenExplorer?: () => void;
  onRefresh?: () => void;
  onAskOrbitX?: () => void;
  onExport?: () => void;
  onLogout?: () => void;
};

function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatUsd(value?: number): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(value >= 0.01 ? 4 : 6)}`;
}

function formatAmount(value: number): string {
  if (Number.isNaN(value)) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatPct(value?: number, withSign = false): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pnlColor(value?: number): string {
  if (value == null) {
    return colors.mute;
  }
  return value >= 0 ? colors.success : colors.danger;
}

function TokenRow({ token }: { token: PortfolioToken }) {
  const letter = (token.symbol || token.mint || "?").slice(0, 1).toUpperCase();
  const allocation = Math.max(0, Math.min(100, token.allocationPct ?? 0));
  return (
    <View style={styles.tokenRow}>
      <View style={styles.tokenLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{letter}</Text>
        </View>
        <View style={styles.tokenMeta}>
          <Text style={styles.tokenSymbol} numberOfLines={1}>
            {token.symbol || truncateAddress(token.mint)}
          </Text>
          <Text style={styles.tokenName} numberOfLines={1}>
            {token.name ?? truncateAddress(token.mint)}
          </Text>
        </View>
      </View>

      <View style={styles.tokenRight}>
        <Text style={styles.tokenValue}>{formatUsd(token.usdValue)}</Text>
        <Text style={styles.tokenAmount} numberOfLines={1}>
          {formatAmount(token.amount)} {token.symbol}
        </Text>
      </View>

      <View style={styles.tokenFooter}>
        <View style={styles.allocationTrack}>
          <View style={[styles.allocationFill, { width: `${allocation}%` }]} />
        </View>
        <View style={styles.tokenTags}>
          {token.allocationPct != null ? (
            <Text style={styles.tokenTag}>{formatPct(token.allocationPct)} of bag</Text>
          ) : null}
          {token.supplyPct != null ? (
            <Text style={styles.tokenTag}>
              {formatPct(token.supplyPct)} of supply
            </Text>
          ) : null}
          {token.priceUsd != null ? (
            <Text style={styles.tokenTag}>@ {formatUsd(token.priceUsd)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function PortfolioView({
  address,
  totalUsd,
  solBalance,
  pnl24h,
  pnl7d,
  tokens,
  loading = false,
  error = null,
  copied = false,
  onCopyAddress,
  onOpenExplorer,
  onRefresh,
  onAskOrbitX,
  onExport,
  onLogout,
}: PortfolioViewProps) {
  return (
    <View style={styles.root}>
      {/* Total value header */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>TOTAL PORTFOLIO VALUE</Text>
        {loading && totalUsd == null ? (
          <ActivityIndicator color={colors.signal} style={styles.heroLoader} />
        ) : (
          <Text style={styles.heroValue}>{formatUsd(totalUsd)}</Text>
        )}

        <View style={styles.pnlRow}>
          <View style={styles.pnlChip}>
            <Text style={styles.pnlLabel}>24h</Text>
            <Text style={[styles.pnlValue, { color: pnlColor(pnl24h) }]}>
              {formatPct(pnl24h, true)}
            </Text>
          </View>
          <View style={styles.pnlChip}>
            <Text style={styles.pnlLabel}>7d</Text>
            <Text style={[styles.pnlValue, { color: pnlColor(pnl7d) }]}>
              {formatPct(pnl7d, true)}
            </Text>
          </View>
          <View style={styles.pnlChip}>
            <Text style={styles.pnlLabel}>SOL</Text>
            <Text style={styles.pnlValue}>
              {solBalance != null ? solBalance.toFixed(3) : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <Pressable
            style={styles.addressChip}
            onPress={onCopyAddress}
            accessibilityRole="button"
            accessibilityLabel="Copy wallet address"
          >
            <Text style={styles.addressText}>{truncateAddress(address)}</Text>
            <Text style={styles.addressAction}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
          {onOpenExplorer ? (
            <Pressable
              style={styles.explorerChip}
              onPress={onOpenExplorer}
              accessibilityRole="button"
              accessibilityLabel="View on Solscan"
            >
              <Text style={styles.addressAction}>Solscan ↗</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.action, styles.actionPrimary]}
          onPress={onAskOrbitX}
          accessibilityRole="button"
        >
          <Text style={styles.actionPrimaryText}>Ask OrbitX</Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={onExport}
          accessibilityRole="button"
          accessibilityLabel="Export wallet"
        >
          <Text style={styles.actionText}>Export</Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh holdings"
        >
          <Text style={styles.actionText}>Refresh</Text>
        </Pressable>
      </View>

      {/* Holdings */}
      <View style={styles.holdingsHeader}>
        <Text style={styles.sectionLabel}>HOLDINGS</Text>
        <Text style={styles.holdingsCount}>
          {tokens.length} {tokens.length === 1 ? "token" : "tokens"}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : loading && tokens.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.signal} />
        </View>
      ) : tokens.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No token balances yet</Text>
          <Text style={styles.emptyBody}>
            Fund this wallet or make a trade and your holdings — with live
            metadata, amounts, and portfolio share — will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {tokens.map((token) => (
            <TokenRow key={token.mint} token={token} />
          ))}
        </ScrollView>
      )}

      {onLogout ? (
        <Pressable
          style={styles.logout}
          onPress={onLogout}
          accessibilityRole="button"
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 16,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 20,
    gap: 10,
  },
  heroKicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
  },
  heroLoader: {
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  heroValue: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 38,
    letterSpacing: -0.5,
  },
  pnlRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  pnlChip: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  pnlLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1,
  },
  pnlValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  addressRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  addressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addressText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  addressAction: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  explorerChip: {
    justifyContent: "center",
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  actionPrimary: {
    flex: 1.4,
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  actionPrimaryText: {
    color: colors.void,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  holdingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  holdingsCount: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 8,
  },
  tokenRow: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    gap: 12,
  },
  tokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(126, 182, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.ice,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 16,
  },
  tokenMeta: {
    flex: 1,
    gap: 2,
  },
  tokenSymbol: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  tokenName: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  tokenRight: {
    position: "absolute",
    right: 14,
    top: 14,
    alignItems: "flex-end",
    gap: 2,
  },
  tokenValue: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  tokenAmount: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  tokenFooter: {
    gap: 8,
  },
  allocationTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink,
    overflow: "hidden",
  },
  allocationFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.signal,
  },
  tokenTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tokenTag: {
    color: colors.dim,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  centered: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: colors.frost,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  emptyBody: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255, 120, 90, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 150, 120, 0.25)",
    gap: 8,
  },
  errorText: {
    color: "#FFB899",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  logout: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#FF8A8A",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
