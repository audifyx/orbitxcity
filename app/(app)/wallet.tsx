import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/lib/auth";
import { invokeFunction } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

type WalletSnapshot = {
  solBalance?: number;
  tokens?: Array<{
    mint: string;
    symbol: string;
    balance: number;
    usdValue?: number;
  }>;
  pnl24h?: number;
  pnl7d?: number;
};

function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

async function fetchWalletData(wallet: string): Promise<WalletSnapshot> {
  const attempts = ["wallet-manager", "og-wallet", "pnl-scan"] as const;

  for (const name of attempts) {
    try {
      const result = await invokeFunction(name, { wallet, action: "snapshot" });
      if (typeof result === "object" && result !== null) {
        return result as WalletSnapshot;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Wallet data unavailable from connected services.");
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wallet, disconnect } = useAuth();

  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) {
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchWalletData(wallet);
      setSnapshot(data);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  const askOrbitX = useCallback(() => {
    const context = wallet
      ? `Analyze my wallet ${wallet} — holdings, risk, and opportunities.`
      : "Help me understand my Solana wallet.";
    router.push({
      pathname: "/(app)",
      params: { context },
    });
  }, [router, wallet]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>Your OrbitX in-app wallet</Text>

      {!wallet ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No wallet yet</Text>
          <Text style={styles.cardBody}>
            Sign in with email or phone and OrbitX creates this wallet for you.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardKicker}>Connected</Text>
            <Text style={styles.address}>{truncateAddress(wallet)}</Text>
            {loading ? (
              <ActivityIndicator color={colors.signal} style={styles.loader} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <>
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>SOL</Text>
                    <Text style={styles.statValue}>
                      {snapshot?.solBalance?.toFixed(4) ?? "—"}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>24h PnL</Text>
                    <Text style={styles.statValue}>
                      {snapshot?.pnl24h != null
                        ? `${snapshot.pnl24h >= 0 ? "+" : ""}${snapshot.pnl24h.toFixed(2)}%`
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>7d PnL</Text>
                    <Text style={styles.statValue}>
                      {snapshot?.pnl7d != null
                        ? `${snapshot.pnl7d >= 0 ? "+" : ""}${snapshot.pnl7d.toFixed(2)}%`
                        : "—"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Tokens</Text>
                {(snapshot?.tokens ?? []).length === 0 ? (
                  <Text style={styles.muted}>No token balances returned.</Text>
                ) : (
                  (snapshot?.tokens ?? []).map((token) => (
                    <View key={token.mint} style={styles.tokenRow}>
                      <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                      <Text style={styles.tokenBalance}>
                        {token.balance.toLocaleString()}
                        {token.usdValue != null
                          ? ` · $${token.usdValue.toFixed(2)}`
                          : ""}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          <Pressable style={styles.primaryButton} onPress={askOrbitX}>
            <Text style={styles.primaryButtonText}>Ask OrbitX</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={load}>
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>

          <Pressable
            style={styles.dangerButton}
            onPress={() => void disconnect()}
          >
            <Text style={styles.dangerButtonText}>Log out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 26,
  },
  subtitle: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    gap: 10,
  },
  cardKicker: {
    color: colors.signal,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 17,
  },
  cardBody: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  address: {
    color: colors.frost,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
    letterSpacing: 1,
  },
  loader: {
    marginTop: 8,
  },
  errorText: {
    color: "#FF9A9A",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.ink,
  },
  statLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  statValue: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    marginTop: 4,
  },
  sectionLabel: {
    color: colors.mute,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  muted: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tokenSymbol: {
    color: colors.frost,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  tokenBalance: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.signal,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.void,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.ice,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  dangerButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#FF8A8A",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
