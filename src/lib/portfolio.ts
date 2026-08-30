import { solanaRpcUrl } from "./env";
import { invokeFunction } from "./supabase";
import { isSolanaPubkey } from "./wallets";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v2";

const KNOWN_SYMBOLS: Record<string, string> = {
  [WSOL_MINT]: "SOL",
  [ORBITX_MINT]: "ORBITX",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
};

export type PortfolioToken = {
  mint: string;
  symbol: string;
  balance: number;
  usdValue?: number;
  usdPrice?: number;
};

export type WalletSnapshot = {
  solBalance?: number;
  tokens: PortfolioToken[];
  totalUsd?: number;
  pnl24h?: number;
  pnl7d?: number;
  source: "rpc" | "edge" | "mixed";
};

type RpcEnvelope<T> = {
  result?: T;
  error?: { message?: string };
};

type ParsedTokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmount?: number | null;
          };
        };
      };
    };
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const json = (await response.json()) as RpcEnvelope<T>;
  if (!response.ok || json.error) {
    throw new Error(json.error?.message ?? `Solana RPC ${method} failed.`);
  }
  if (json.result === undefined) {
    throw new Error(`Solana RPC ${method} returned no result.`);
  }
  return json.result;
}

function parseTokenAccounts(value: unknown): PortfolioToken[] {
  const rec = asRecord(value);
  const list = rec && Array.isArray(rec.value) ? rec.value : [];
  const tokens: PortfolioToken[] = [];

  for (const item of list) {
    const parsed = asRecord(item) as ParsedTokenAccount | null;
    const info = parsed?.account?.data?.parsed?.info;
    const mint = info?.mint?.trim() ?? "";
    const amount = info?.tokenAmount;
    if (!isSolanaPubkey(mint) || !amount) {
      continue;
    }
    const uiAmount =
      asFiniteNumber(amount.uiAmount) ??
      (asFiniteNumber(amount.amount) !== undefined &&
      asFiniteNumber(amount.decimals) !== undefined
        ? Number(amount.amount) / 10 ** Number(amount.decimals)
        : undefined);
    if (uiAmount === undefined || uiAmount <= 0) {
      continue;
    }
    tokens.push({
      mint,
      symbol: KNOWN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
      balance: uiAmount,
    });
  }

  return tokens;
}

async function fetchTokenPrices(
  mints: string[],
): Promise<Record<string, number>> {
  if (mints.length === 0) {
    return {};
  }

  const unique = [...new Set(mints)];
  const url = `${JUPITER_PRICE_URL}?ids=${unique.map(encodeURIComponent).join(",")}`;
  const response = await fetch(url);
  if (!response.ok) {
    return {};
  }

  const json: unknown = await response.json();
  const data = asRecord(asRecord(json)?.data);
  if (!data) {
    return {};
  }

  const prices: Record<string, number> = {};
  for (const mint of unique) {
    const row = asRecord(data[mint]);
    const price = asFiniteNumber(row?.price);
    if (price !== undefined && price >= 0) {
      prices[mint] = price;
    }
  }
  return prices;
}

function applyPrices(
  tokens: PortfolioToken[],
  prices: Record<string, number>,
): PortfolioToken[] {
  return tokens.map((token) => {
    const usdPrice = prices[token.mint];
    if (usdPrice === undefined) {
      return token;
    }
    return {
      ...token,
      usdPrice,
      usdValue: token.balance * usdPrice,
    };
  });
}

function sortTokens(tokens: PortfolioToken[]): PortfolioToken[] {
  return [...tokens].sort((a, b) => {
    const aUsd = a.usdValue ?? 0;
    const bUsd = b.usdValue ?? 0;
    if (bUsd !== aUsd) {
      return bUsd - aUsd;
    }
    if (a.mint === ORBITX_MINT && b.mint !== ORBITX_MINT) {
      return -1;
    }
    if (b.mint === ORBITX_MINT && a.mint !== ORBITX_MINT) {
      return 1;
    }
    return b.balance - a.balance;
  });
}

async function fetchRpcPortfolio(wallet: string): Promise<WalletSnapshot> {
  const [balance, spl, token2022] = await Promise.all([
    solanaRpc<{ value: number }>("getBalance", [wallet]),
    solanaRpc<unknown>("getParsedTokenAccountsByOwner", [
      wallet,
      { programId: TOKEN_PROGRAM },
      { encoding: "jsonParsed" },
    ]).catch(() => ({ value: [] })),
    solanaRpc<unknown>("getParsedTokenAccountsByOwner", [
      wallet,
      { programId: TOKEN_2022_PROGRAM },
      { encoding: "jsonParsed" },
    ]).catch(() => ({ value: [] })),
  ]);

  const solBalance = asFiniteNumber(balance.value);
  if (solBalance === undefined) {
    throw new Error("Solana RPC did not return a SOL balance.");
  }

  const merged = new Map<string, PortfolioToken>();
  for (const token of [
    ...parseTokenAccounts(spl),
    ...parseTokenAccounts(token2022),
  ]) {
    const existing = merged.get(token.mint);
    if (existing) {
      existing.balance += token.balance;
    } else {
      merged.set(token.mint, { ...token });
    }
  }

  const tokens = [...merged.values()];
  const prices = await fetchTokenPrices([WSOL_MINT, ...tokens.map((t) => t.mint)]);
  const priced = applyPrices(tokens, prices);
  const solUsd =
    prices[WSOL_MINT] !== undefined
      ? (solBalance / 1e9) * prices[WSOL_MINT]
      : undefined;
  const tokenUsd = priced.reduce(
    (sum, token) => sum + (token.usdValue ?? 0),
    0,
  );
  const totalUsd =
    solUsd !== undefined ? solUsd + tokenUsd : tokenUsd > 0 ? tokenUsd : undefined;

  return {
    solBalance: solBalance / 1e9,
    tokens: sortTokens(priced),
    totalUsd,
    source: "rpc",
  };
}

function parseEdgeTokens(value: unknown): PortfolioToken[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tokens: PortfolioToken[] = [];
  for (const item of value) {
    const rec = asRecord(item);
    if (!rec) {
      continue;
    }
    const mint = typeof rec.mint === "string" ? rec.mint.trim() : "";
    const balance = asFiniteNumber(rec.balance);
    if (!isSolanaPubkey(mint) || balance === undefined || balance <= 0) {
      continue;
    }
    tokens.push({
      mint,
      symbol:
        typeof rec.symbol === "string" && rec.symbol.trim()
          ? rec.symbol.trim()
          : (KNOWN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`),
      balance,
      usdValue: asFiniteNumber(rec.usdValue),
      usdPrice: asFiniteNumber(rec.usdPrice),
    });
  }
  return tokens;
}

async function fetchEdgeSnapshot(wallet: string): Promise<WalletSnapshot | null> {
  const attempts = ["wallet-manager", "og-wallet", "pnl-scan"] as const;

  for (const name of attempts) {
    try {
      const result = await invokeFunction(name, { wallet, action: "snapshot" });
      const rec = asRecord(result);
      if (!rec) {
        continue;
      }
      return {
        solBalance: asFiniteNumber(rec.solBalance),
        tokens: parseEdgeTokens(rec.tokens),
        totalUsd: asFiniteNumber(rec.totalUsd),
        pnl24h: asFiniteNumber(rec.pnl24h),
        pnl7d: asFiniteNumber(rec.pnl7d),
        source: "edge",
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadWalletSnapshot(wallet: string): Promise<WalletSnapshot> {
  const trimmed = wallet.trim();
  if (!isSolanaPubkey(trimmed)) {
    throw new Error("Wallet address is invalid.");
  }

  const [rpcResult, edgeResult] = await Promise.allSettled([
    fetchRpcPortfolio(trimmed),
    fetchEdgeSnapshot(trimmed),
  ]);

  const rpc = rpcResult.status === "fulfilled" ? rpcResult.value : null;
  const edge = edgeResult.status === "fulfilled" ? edgeResult.value : null;

  if (!rpc && !edge) {
    throw new Error("Could not load this wallet from Solana or OrbitX.");
  }

  if (rpc && edge) {
    return {
      solBalance: rpc.solBalance ?? edge.solBalance,
      tokens: rpc.tokens.length > 0 ? rpc.tokens : edge.tokens,
      totalUsd: rpc.totalUsd ?? edge.totalUsd,
      pnl24h: edge.pnl24h,
      pnl7d: edge.pnl7d,
      source: "mixed",
    };
  }

  return (rpc ?? edge) as WalletSnapshot;
}

export function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10 ? 2 : 4,
  });
}

export function formatPnl(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}
