import AsyncStorage from "@react-native-async-storage/async-storage";
import { executeDexSwap } from "./dexTrade";
import { getTokenBalance, resolveSellAmount } from "./portfolio";
import { instantBuySol } from "./swapGuard";
import { isSolanaPubkey } from "./wallets";

const STORAGE_KEY = "orbitx-limit-orders";
const JUPITER_TOKEN_SEARCH = "https://api.jup.ag/tokens/v2/search";
const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v2";

export type LimitOrderStatus =
  | "pending"
  | "triggered"
  | "confirmed"
  | "failed"
  | "cancelled";

export type LimitOrderSide = "buy" | "sell";

export type LimitOrder = {
  id: string;
  wallet: string;
  mint: string;
  symbol?: string;
  side: LimitOrderSide;
  percent?: number;
  amountSol?: number;
  triggerType: "mcap" | "price";
  triggerValue: number;
  status: LimitOrderStatus;
  createdAt: number;
  triggeredAt?: number;
  signature?: string;
  error?: string;
};

type TokenMarket = {
  price?: number;
  mcap?: number;
  symbol?: string;
};

type Listener = (orders: LimitOrder[]) => void;

const listeners = new Set<Listener>();
let monitorTimer: ReturnType<typeof setInterval> | null = null;
let monitorWallet: string | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function notify(orders: LimitOrder[]): void {
  for (const listener of listeners) {
    listener(orders);
  }
}

function normalizeOrder(raw: Record<string, unknown>): LimitOrder | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.wallet !== "string" ||
    typeof raw.mint !== "string" ||
    (raw.triggerType !== "mcap" && raw.triggerType !== "price") ||
    typeof raw.triggerValue !== "number"
  ) {
    return null;
  }

  const side: LimitOrderSide = raw.side === "buy" ? "buy" : "sell";
  const percent =
    typeof raw.percent === "number" ? raw.percent : side === "sell" ? 100 : undefined;
  const amountSol =
    typeof raw.amountSol === "number" ? raw.amountSol : undefined;

  if (side === "sell" && (percent === undefined || percent <= 0 || percent > 100)) {
    return null;
  }

  return {
    id: raw.id,
    wallet: raw.wallet,
    mint: raw.mint,
    symbol: typeof raw.symbol === "string" ? raw.symbol : undefined,
    side,
    percent,
    amountSol,
    triggerType: raw.triggerType,
    triggerValue: raw.triggerValue,
    status: (raw.status as LimitOrderStatus) ?? "pending",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    triggeredAt:
      typeof raw.triggeredAt === "number" ? raw.triggeredAt : undefined,
    signature: typeof raw.signature === "string" ? raw.signature : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
  };
}

async function readAll(): Promise<LimitOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        const rec = asRecord(item);
        return rec ? normalizeOrder(rec) : null;
      })
      .filter((item): item is LimitOrder => item !== null);
  } catch {
    return [];
  }
}

async function writeAll(orders: LimitOrder[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  notify(orders);
}

export function subscribeLimitOrders(listener: Listener): () => void {
  listeners.add(listener);
  void readAll().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function listLimitOrders(wallet?: string): Promise<LimitOrder[]> {
  const orders = await readAll();
  if (!wallet) {
    return orders;
  }
  return orders.filter((order) => order.wallet === wallet);
}

export async function createLimitOrder(input: {
  wallet: string;
  mint: string;
  side: LimitOrderSide;
  percent?: number;
  amountSol?: number;
  triggerType: "mcap" | "price";
  triggerValue: number;
  symbol?: string;
}): Promise<LimitOrder> {
  if (!isSolanaPubkey(input.wallet) || !isSolanaPubkey(input.mint)) {
    throw new Error("Sign in before placing a limit order.");
  }
  if (!Number.isFinite(input.triggerValue) || input.triggerValue <= 0) {
    throw new Error("Enter a valid target price or market cap.");
  }

  if (input.side === "sell") {
    const percent = input.percent ?? 100;
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new Error("Enter a sell percent between 1 and 100.");
    }
    const balance = await getTokenBalance(input.wallet, input.mint);
    if (balance <= 0) {
      throw new Error("You do not hold this token — nothing to sell.");
    }
  } else {
    const amountSol = input.amountSol ?? (await instantBuySol());
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      throw new Error("Enter a buy size in SOL.");
    }
  }

  const order: LimitOrder = {
    id: `lim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    wallet: input.wallet,
    mint: input.mint,
    symbol: input.symbol,
    side: input.side,
    percent: input.side === "sell" ? (input.percent ?? 100) : undefined,
    amountSol:
      input.side === "buy"
        ? (input.amountSol ?? (await instantBuySol()))
        : undefined,
    triggerType: input.triggerType,
    triggerValue: input.triggerValue,
    status: "pending",
    createdAt: Date.now(),
  };

  const orders = await readAll();
  orders.unshift(order);
  await writeAll(orders);
  return order;
}

export async function cancelLimitOrder(id: string): Promise<void> {
  const orders = await readAll();
  const next = orders.map((order) =>
    order.id === id && order.status === "pending"
      ? { ...order, status: "cancelled" as const }
      : order,
  );
  await writeAll(next);
}

async function fetchTokenMarket(mint: string): Promise<TokenMarket> {
  const market: TokenMarket = {};
  try {
    const search = await fetch(
      `${JUPITER_TOKEN_SEARCH}?query=${encodeURIComponent(mint)}`,
    );
    if (search.ok) {
      const json: unknown = await search.json();
      const list = Array.isArray(json) ? json : [];
      const row =
        list.find((item) => asRecord(item)?.id === mint) ?? list[0];
      const rec = asRecord(row);
      if (rec) {
        const price = Number(rec.usdPrice);
        const mcap = Number(rec.mcap);
        if (Number.isFinite(price) && price > 0) {
          market.price = price;
        }
        if (Number.isFinite(mcap) && mcap > 0) {
          market.mcap = mcap;
        }
        if (typeof rec.symbol === "string") {
          market.symbol = rec.symbol;
        }
      }
    }
  } catch {
    // Fall back to price API below.
  }

  if (market.price === undefined) {
    try {
      const response = await fetch(
        `${JUPITER_PRICE_URL}?ids=${encodeURIComponent(mint)}`,
      );
      const json: unknown = await response.json();
      const data = asRecord(asRecord(json)?.data);
      const row = data ? asRecord(data[mint]) : null;
      const price = Number(row?.price);
      if (response.ok && Number.isFinite(price) && price > 0) {
        market.price = price;
      }
    } catch {
      // Leave market empty.
    }
  }

  return market;
}

function isTriggered(order: LimitOrder, market: TokenMarket): boolean {
  if (order.triggerType === "price") {
    return typeof market.price === "number" && market.price >= order.triggerValue;
  }
  return typeof market.mcap === "number" && market.mcap >= order.triggerValue;
}

async function executeLimitOrder(order: LimitOrder): Promise<LimitOrder> {
  if (order.side === "buy") {
    const amount = order.amountSol ?? (await instantBuySol());
    const result = await executeDexSwap({
      wallet: order.wallet,
      side: "buy",
      mint: order.mint,
      amount,
    });
    return {
      ...order,
      status: "confirmed",
      triggeredAt: Date.now(),
      signature: result.signature,
    };
  }

  const amount = await resolveSellAmount(order.wallet, order.mint, {
    percent: order.percent ?? 100,
  });
  const result = await executeDexSwap({
    wallet: order.wallet,
    side: "sell",
    mint: order.mint,
    amount,
  });
  return {
    ...order,
    status: "confirmed",
    triggeredAt: Date.now(),
    signature: result.signature,
  };
}

async function tick(wallet: string): Promise<void> {
  const orders = await readAll();
  let changed = false;
  const next: LimitOrder[] = [];

  for (const order of orders) {
    if (order.wallet !== wallet || order.status !== "pending") {
      next.push(order);
      continue;
    }

    try {
      const market = await fetchTokenMarket(order.mint);
      if (!isTriggered(order, market)) {
        next.push({
          ...order,
          symbol: order.symbol ?? market.symbol,
        });
        continue;
      }

      const triggered: LimitOrder = {
        ...order,
        status: "triggered",
        triggeredAt: Date.now(),
        symbol: order.symbol ?? market.symbol,
      };
      changed = true;
      next.push(triggered);

      try {
        const filled = await executeLimitOrder(triggered);
        changed = true;
        next[next.length - 1] = filled;
      } catch (error) {
        changed = true;
        next[next.length - 1] = {
          ...triggered,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : order.side === "buy"
                ? "Limit buy failed."
                : "Limit sell failed.",
        };
      }
    } catch (error) {
      next.push({
        ...order,
        status: "failed",
        error: error instanceof Error ? error.message : "Could not read market.",
      });
      changed = true;
    }
  }

  if (changed) {
    await writeAll(next);
  }
}

export function startLimitOrderMonitor(wallet: string | null): void {
  if (!wallet || !isSolanaPubkey(wallet)) {
    stopLimitOrderMonitor();
    return;
  }
  if (monitorWallet === wallet && monitorTimer) {
    return;
  }
  stopLimitOrderMonitor();
  monitorWallet = wallet;
  void tick(wallet);
  monitorTimer = setInterval(() => {
    void tick(wallet);
  }, 30_000);
}

export function stopLimitOrderMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  monitorWallet = null;
}
