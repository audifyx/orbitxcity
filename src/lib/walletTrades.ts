import { isSolanaPubkey } from "./wallets";

const ORBITX_API = "https://www.orbitx.world";

export type WalletTrade = {
  txHash: string | null;
  side: "buy" | "sell";
  mint: string;
  tokenAmount: number;
  solAmount: number;
  time: number;
  usd: number | null;
  name: string | null;
  symbol: string | null;
  image: string | null;
};

type WalletTradesResponse = {
  ok?: boolean;
  trades?: unknown[];
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function parseTrade(raw: unknown): WalletTrade | null {
  const rec = asRecord(raw);
  if (!rec) {
    return null;
  }
  const side = rec.side === "sell" ? "sell" : rec.side === "buy" ? "buy" : null;
  const mint = typeof rec.mint === "string" ? rec.mint.trim() : "";
  if (!side || !isSolanaPubkey(mint)) {
    return null;
  }
  return {
    txHash: typeof rec.txHash === "string" ? rec.txHash : null,
    side,
    mint,
    tokenAmount: asFiniteNumber(rec.tokenAmount),
    solAmount: asFiniteNumber(rec.solAmount),
    time: asFiniteNumber(rec.time),
    usd:
      rec.usd === null || rec.usd === undefined
        ? null
        : asFiniteNumber(rec.usd),
    name: typeof rec.name === "string" ? rec.name : null,
    symbol: typeof rec.symbol === "string" ? rec.symbol : null,
    image: typeof rec.image === "string" ? rec.image : null,
  };
}

export async function fetchWalletTrades(
  address: string,
  limit = 25,
): Promise<WalletTrade[]> {
  const trimmed = address.trim();
  if (!isSolanaPubkey(trimmed)) {
    return [];
  }

  const url = `${ORBITX_API}/api/ogdex/swaps?address=${encodeURIComponent(trimmed)}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load trades (${response.status}).`);
  }

  const json = (await response.json()) as WalletTradesResponse;
  if (!json.ok || !Array.isArray(json.trades)) {
    return [];
  }

  return json.trades.flatMap((item) => {
    const trade = parseTrade(item);
    return trade ? [trade] : [];
  });
}

export function formatTradeTime(epochMs: number): string {
  if (!epochMs || !Number.isFinite(epochMs)) {
    return "—";
  }
  const date = new Date(epochMs);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) {
    return "just now";
  }
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }
  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
