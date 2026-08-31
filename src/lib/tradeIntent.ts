import { isSolanaPubkey } from "./wallets";

export type TradeSide = "buy" | "sell";

export type MarketTradeIntent = {
  kind: "market";
  side: TradeSide;
  mint: string;
  /** SOL for buys, token units for sells (when not using USD). */
  amount?: number;
  percent?: number;
  /** Exact USD notional — e.g. buy $1 or sell $1 worth. */
  amountUsd?: number;
};

export type LimitTradeIntent = {
  kind: "limit";
  side: TradeSide;
  mint: string;
  percent?: number;
  amountSol?: number;
  amountUsd?: number;
  triggerType: "mcap" | "price";
  triggerValue: number;
};

export type TradeIntent = MarketTradeIntent | LimitTradeIntent;

const WORD_PERCENT: Record<string, number> = {
  all: 100,
  max: 100,
  everything: 100,
  half: 50,
  quarter: 25,
};

function parsePercentToken(token: string): number | undefined {
  const word = token.toLowerCase().replace(/[.,!?]/g, "");
  if (word in WORD_PERCENT) {
    return WORD_PERCENT[word];
  }
  const match = token.match(/^(\d+(?:\.\d+)?)\s*(?:%|percent|pct)?$/i);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.min(value, 100);
}

function parseMoneyValue(raw: string): number | undefined {
  const token = raw.toLowerCase().replace(/[$,]/g, "");
  const match = token.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/i);
  if (!match) {
    const plain = Number(token);
    return Number.isFinite(plain) && plain > 0 ? plain : undefined;
  }
  let value = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    value *= 1_000;
  } else if (suffix === "m") {
    value *= 1_000_000;
  } else if (suffix === "b") {
    value *= 1_000_000_000;
  }
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function parseUsdAmount(text: string): number | undefined {
  const patterns = [
    /\$\s*(\d+(?:\.\d{1,2})?)/,
    /\b(\d+(?:\.\d{1,2})?)\s*(?:usd|usdc|dollars?)\b/i,
    /\b(\d+(?:\.\d{1,2})?)\s*\$\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = parseMoneyValue(match[1]);
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
}

function parseSolAmount(text: string): number | undefined {
  const explicit = text.match(/\b(\d+(?:\.\d+)?)\s*sol\b/i);
  if (explicit) {
    const value = Number(explicit[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const withClause = text.match(/\bwith\s+(\d+(?:\.\d+)?)\s*sol\b/i);
  if (withClause) {
    const value = Number(withClause[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
}

function findMint(tokens: string[]): string | undefined {
  return tokens.find((token) => isSolanaPubkey(token));
}

export function parseTradeIntent(text: string): TradeIntent | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const tokens = trimmed.split(/\s+/);
  const mint = findMint(tokens);
  if (!mint) {
    return null;
  }

  const isSell = /^(sell|dump)\b/i.test(trimmed) || /\bsell\b/i.test(lower);
  const isBuy = /^(buy|snipe|ape)\b/i.test(trimmed) || /\bbuy\b/i.test(lower);
  if (!isSell && !isBuy) {
    return null;
  }

  const amountUsd = parseUsdAmount(trimmed);
  const solAmount = parseSolAmount(trimmed);

  const limitMatch = lower.match(
    /(?:when|once|at)\s+(?:the\s+)?(?:mc(?:ap)?|market\s*cap|price)\s+(?:hits?|reaches?|is|at|>=|=>|above|below)\s+([$]?\d[\d.,]*(?:\s*[kmb])?)/i,
  );
  if (limitMatch) {
    const triggerRaw = limitMatch[1] ?? "";
    const triggerValue = parseMoneyValue(triggerRaw);
    if (triggerValue === undefined) {
      return null;
    }
    const triggerType =
      /mc(?:ap)?|market\s*cap/i.test(limitMatch[0]) ? "mcap" : "price";

    if (isSell) {
      const percentToken = tokens.find(
        (token) => parsePercentToken(token) !== undefined,
      );
      const percent = percentToken ? parsePercentToken(percentToken) : 100;
      if (percent === undefined) {
        return null;
      }
      return {
        kind: "limit",
        side: "sell",
        mint,
        percent,
        triggerType,
        triggerValue,
      };
    }

    return {
      kind: "limit",
      side: "buy",
      mint,
      amountSol: amountUsd ? undefined : solAmount,
      amountUsd,
      triggerType,
      triggerValue,
    };
  }

  const percentToken = amountUsd
    ? undefined
    : tokens.find((token) => parsePercentToken(token) !== undefined);
  const percent = percentToken ? parsePercentToken(percentToken) : undefined;

  let amount: number | undefined;
  if (!amountUsd && !solAmount) {
    const rawAmount = tokens.find(
      (token) =>
        /^\d+(?:\.\d+)?$/.test(token) &&
        parsePercentToken(token) === undefined,
    );
    amount = rawAmount ? Number(rawAmount) : undefined;
  }

  return {
    kind: "market",
    side: isSell ? "sell" : "buy",
    mint,
    amount: solAmount ?? amount,
    amountUsd,
    percent: amountUsd ? undefined : percent,
  };
}

/** @deprecated Use parseTradeIntent */
export function parseInstantTrade(text: string): {
  side: TradeSide;
  mint: string;
  amount?: number;
  percent?: number;
  amountUsd?: number;
} | null {
  const intent = parseTradeIntent(text);
  if (!intent || intent.kind !== "market") {
    return null;
  }
  return {
    side: intent.side,
    mint: intent.mint,
    amount: intent.amount,
    percent: intent.percent,
    amountUsd: intent.amountUsd,
  };
}
