import type { PortfolioToken } from "../components/PortfolioView";
import { invokeFunction } from "./supabase";

type RawToken = Record<string, unknown>;

export type WalletSnapshot = {
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
    const avgEntryUsd =
      num(token.avgEntryUsd) ??
      num(token.avgEntry) ??
      num(token.averageEntryPrice) ??
      num(token.costBasisUsd);
    const pnlUsd =
      num(token.pnlUsd) ??
      num(token.unrealizedPnlUsd) ??
      (avgEntryUsd != null && priceUsd != null
        ? (priceUsd - avgEntryUsd) * amount
        : undefined);
    const pnlPct =
      num(token.pnlPct) ??
      num(token.unrealizedPnlPct) ??
      (avgEntryUsd != null && avgEntryUsd > 0 && priceUsd != null
        ? ((priceUsd - avgEntryUsd) / avgEntryUsd) * 100
        : undefined);
    const marketCapUsd = num(token.marketCapUsd) ?? num(token.marketCap) ?? num(token.fdv);
    return {
      mint: str(token.mint) ?? str(token.address) ?? str(token.id) ?? `token-${index}`,
      symbol: str(token.symbol) ?? str(token.ticker) ?? "—",
      name: str(token.name),
      amount,
      usdValue,
      priceUsd,
      avgEntryUsd,
      pnlUsd,
      pnlPct,
      marketCapUsd,
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
  // Only add a separate SOL value if native SOL isn't already a token entry,
  // otherwise the headline total double-counts it.
  const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
  const hasSolToken = tokens.some(
    (t) => t.symbol.toUpperCase() === "SOL" || t.mint === WRAPPED_SOL,
  );
  const solUsd = hasSolToken
    ? undefined
    : num(data.solUsdValue) ?? num(data.solValueUsd);
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

export async function fetchWalletData(wallet: string): Promise<WalletSnapshot> {
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
