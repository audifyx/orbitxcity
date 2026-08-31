import { supabase } from "./supabase";

/**
 * Trade-history analytics are sourced entirely from orbitx_ai_transaction_intents
 * — the same table ChatThread.tsx already writes to for every swap/order
 * lifecycle (preview → submitted → confirmed/failed). This is real data, not
 * a mock table: each row is a transaction intent this app itself created.
 *
 * IMPORTANT: this table records individual trade *executions*, not matched
 * buy/sell round-trips. Without a paired cost-basis ledger we cannot honestly
 * compute win rate, average win/loss, or best/worst trade — those require
 * knowing which sell closed out which buy. Rather than fabricate that,
 * TradeStats leaves those fields undefined until a real position-matching
 * data source exists, and the UI must render "—" for them, not a guess.
 */

export type TimeRange = "1D" | "7D" | "30D" | "ALL";

export type TradeIntent = {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  /** USD notional of the trade, only when the quote payload actually carries a computable amount. */
  usdValue?: number;
  symbol?: string;
  mint?: string;
  signature?: string;
};

export type TradeStats = {
  range: TimeRange;
  totalIntents: number;
  confirmed: number;
  failed: number;
  pending: number;
  /** Sum of usdValue across trades where it was computable. Undefined if none were. */
  volumeUsd?: number;
  /** Count of trades whose quote payload didn't carry enough info to size in USD. */
  volumeUnknownCount: number;
  tradingDays: number;
  tradesPerDay: number;
  byDay: { date: string; count: number }[];
  byKind: Record<string, number>;
};

const TRADE_KINDS = ["swap", "jupiter-swap", "jupiter-order", "limit-order", "trade"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function rangeStart(range: TimeRange): Date | null {
  const now = Date.now();
  switch (range) {
    case "1D":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7D":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30D":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "ALL":
      return null;
  }
}

/** Extract a USD notional from a quote payload only if it's actually derivable — never guessed. */
function usdFromQuote(quote: unknown): number | undefined {
  if (!isRecord(quote)) return undefined;
  const direct =
    num(quote.usdValue) ?? num(quote.valueUsd) ?? num(quote.notionalUsd) ?? num(quote.amountUsd);
  if (direct != null) return direct;

  const amount = num(quote.inAmount) ?? num(quote.amount) ?? num(quote.uiAmount);
  const price = num(quote.priceUsd) ?? num(quote.inPriceUsd) ?? num(quote.price);
  if (amount != null && price != null) return amount * price;

  return undefined;
}

export async function fetchTradeHistory(range: TimeRange): Promise<TradeIntent[]> {
  let query = supabase
    .from("orbitx_ai_transaction_intents")
    .select("id, kind, status, created_at, quote, signature")
    .order("created_at", { ascending: false })
    .limit(500);

  const start = rangeStart(range);
  if (start) {
    query = query.gte("created_at", start.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter(isRecord)
    .map((row) => {
      const quote = row.quote;
      return {
        id: str(row.id) ?? "",
        kind: str(row.kind) ?? "unknown",
        status: str(row.status) ?? "unknown",
        createdAt: str(row.created_at) ?? new Date(0).toISOString(),
        usdValue: usdFromQuote(quote),
        symbol: isRecord(quote) ? str(quote.symbol) ?? str(quote.outSymbol) : undefined,
        mint: isRecord(quote) ? str(quote.mint) ?? str(quote.outputMint) : undefined,
        signature: str(row.signature),
      };
    })
    .filter((intent) => intent.id !== "");
}

export function computeTradeStats(intents: TradeIntent[], range: TimeRange): TradeStats {
  const trades = intents.filter((i) => TRADE_KINDS.includes(i.kind));

  const confirmed = trades.filter((t) => t.status === "confirmed").length;
  const failed = trades.filter((t) => t.status === "failed").length;
  const pending = trades.length - confirmed - failed;

  const withVolume = trades.filter((t) => t.usdValue != null);
  const volumeUsd = withVolume.length
    ? withVolume.reduce((sum, t) => sum + (t.usdValue ?? 0), 0)
    : undefined;

  const byDay = new Map<string, number>();
  const byKind: Record<string, number> = {};
  for (const t of trades) {
    const day = t.createdAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
  }

  const tradingDays = byDay.size;
  const dayEntries = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    range,
    totalIntents: trades.length,
    confirmed,
    failed,
    pending,
    volumeUsd,
    volumeUnknownCount: trades.length - withVolume.length,
    tradingDays,
    tradesPerDay: tradingDays > 0 ? trades.length / tradingDays : 0,
    byDay: dayEntries,
    byKind,
  };
}
