import { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PortfolioView, type PortfolioToken } from "../../src/components";
import { useAuth } from "../../src/lib/auth";
import { walletExportUrl } from "../../src/lib/hostedAuth";
import { invokeFunction } from "../../src/lib/supabase";
import { openExternalUrl } from "../../src/lib/walletOpen";
import { colors } from "../../src/theme";

type RawToken = Record<string, unknown>;

type WalletSnapshot = {
  totalUsd?: number;
  solBalance?: number;
  pnl24h?: number;
  pnl7d?: number;
  tokens: PortfolioToken[];
};

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function firstArray(record: Record<string, unknown>, keys: string[]): RawToken[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is RawToken => typeof item === "object" && item !== null,
      );
    }
  }
  return [];
}

/** Normalize the many shapes wallet/portfolio edge functions can return. */
function normalizeSnapshot(raw: unknown): WalletSnapshot {
  const record =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const data =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;

  const rawTokens = firstArray(data, [
    "tokens",
    "holdings",
    "balances",
    "assets",
    "portfolio",
  ]);

  const tokens: PortfolioToken[] = rawTokens.map((token, index) => {
    const amount =
      num(token.amount) ??
      num(token.balance) ??
      num(token.uiAmount) ??
      num(token.quantity) ??
      0;
    const priceUsd = num(token.priceUsd) ?? num(token.price) ?? num(token.usdPrice);
    const usdValue =
      num(token.usdValue) ??
      num(token.valueUsd) ??
      num(token.value) ??
      (priceUsd != null ? priceUsd * amount : undefined);
    return {
      mint: str(token.mint) ?? str(token.address) ?? str(token.id) ?? `token-${index}`,
      symbol: str(token.symbol) ?? str(token.ticker) ?? "—",
      name: str(token.name),
      amount,
      usdValue,
      priceUsd,
      supplyPct:
        num(token.supplyPct) ??
        num(token.supplyPercent) ??
        num(token.percentOfSupply) ??
        num(token.ownershipPct),
    };
  });

  const solBalance =
    num(data.solBalance) ?? num(data.sol) ?? num(data.nativeBalance);

  // Total portfolio value: prefer explicit, else sum token values (+ SOL value).
  const explicitTotal =
    num(data.totalUsd) ?? num(data.totalValueUsd) ?? num(data.netWorth);
  const summedTokens = tokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
  const solUsd = num(data.solUsdValue) ?? num(data.solValueUsd);
  const totalUsd =
    explicitTotal ?? (summedTokens > 0 ? summedTokens + (solUsd ?? 0) : undefined);

  // Allocation share of each holding within the portfolio.
  const allocationBase = totalUsd && totalUsd > 0 ? totalUsd : summedTokens;
  const withAllocation = tokens
    .map((t) => ({
      ...t,
      allocationPct:
        allocationBase > 0 && t.usdValue != null
          ? (t.usdValue / allocationBase) * 100
          : undefined,
    }))
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  return {
    totalUsd,
    solBalance,
    pnl24h: num(data.pnl24h) ?? num(data.pnl_24h),
    pnl7d: num(data.pnl7d) ?? num(data.pnl_7d),
    tokens: withAllocation,
  };
}

async function fetchWalletData(wallet: string): Promise<WalletSnapshot> {
  // Try the richest portfolio source first, then fall back. Each backend has a
  // slightly different contract, so we send a superset of the common params.
  const attempts: Array<{ name: string; body: Record<string, unknown> }> = [
    { name: "wallet-portfolio", body: { address: wallet, wallet_address: wallet, wallet } },
    {
      name: "wallet-manager",
      body: { action: "get_balance", wallet_address: wallet, wallet },
    },
    { name: "og-wallet", body: { address: wallet, wallet_address: wallet, wallet } },
    { name: "pnl-scan", body: { wallet, wallet_address: wallet } },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const result = await invokeFunction(attempt.name, attempt.body);
      const snapshot = normalizeSnapshot(result);
      if (
        snapshot.tokens.length > 0 ||
        snapshot.totalUsd != null ||
        snapshot.solBalance != null
      ) {
        return snapshot;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Wallet data unavailable from connected services.");
  }
  // Reached only when services returned empty payloads — show an empty portfolio.
  return { tokens: [] };
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wallet, disconnect } = useAuth();

  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchWalletData(wallet));
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
    router.push({ pathname: "/", params: { context } });
  }, [router, wallet]);

  const copyAddress = useCallback(async () => {
    if (!wallet) {
      return;
    }
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.clipboard
    ) {
      try {
        await navigator.clipboard.writeText(wallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Could not copy address.");
      }
    }
  }, [wallet]);

  const openExplorer = useCallback(() => {
    if (wallet) {
      void openExternalUrl(`https://solscan.io/account/${wallet}`);
    }
  }, [wallet]);

  const exportWallet = useCallback(() => {
    void openExternalUrl(walletExportUrl());
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.title}>Wallet</Text>
      <Text style={styles.subtitle}>Your OrbitX in-app wallet</Text>

      {!wallet ? (
        <Text style={styles.empty}>
          Sign in with email or phone and OrbitX creates this wallet for you.
        </Text>
      ) : (
        <PortfolioView
          address={wallet}
          totalUsd={snapshot?.totalUsd}
          solBalance={snapshot?.solBalance}
          pnl24h={snapshot?.pnl24h}
          pnl7d={snapshot?.pnl7d}
          tokens={snapshot?.tokens ?? []}
          loading={loading}
          error={error}
          copied={copied}
          onCopyAddress={() => void copyAddress()}
          onOpenExplorer={openExplorer}
          onRefresh={() => void load()}
          onAskOrbitX={askOrbitX}
          onExport={exportWallet}
          onLogout={() => void disconnect()}
        />
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
    gap: 8,
    flexGrow: 1,
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
    marginBottom: 8,
  },
  empty: {
    color: colors.mute,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
});
