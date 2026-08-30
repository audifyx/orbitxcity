import {
  SOL_MINT,
  executeJupiterSwap,
  executeUltraOrder,
  fetchQuote,
  fetchUltraOrder,
  getMintDecimals,
  signSwapTransaction,
  uiAmountToRaw,
  type JupiterQuote,
} from "./jupiter";
import { assertCanAffordBuy, formatSwapError, instantBuySol } from "./swapGuard";
import { isSolanaPubkey } from "./wallets";

export { SOL_MINT };
export type { JupiterQuote };

export type TradeSide = "buy" | "sell";

export type ExecutedTrade = {
  signature: string;
  quote: JupiterQuote;
  route: "jupiter";
};

export function parseInstantTrade(text: string): {
  side: TradeSide;
  mint: string;
  amount?: number;
} | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const side: TradeSide | null = /^(buy|snipe|ape)\b/i.test(trimmed)
    ? "buy"
    : /^(sell|dump)\b/i.test(trimmed)
      ? "sell"
      : null;
  if (!side) {
    return null;
  }
  const tokens = trimmed.split(/\s+/);
  const mint = tokens.find(
    (token) => isSolanaPubkey(token) && token !== SOL_MINT,
  );
  if (!mint) {
    return null;
  }
  const rawAmount = tokens.find((token) => /^\d+(?:\.\d+)?$/.test(token));
  const amount = rawAmount ? Number(rawAmount) : undefined;
  return {
    side,
    mint,
    amount:
      typeof amount === "number" && Number.isFinite(amount) && amount > 0
        ? amount
        : undefined,
  };
}

export async function quoteDexSwap(input: {
  side: TradeSide;
  mint: string;
  amount: number;
}): Promise<JupiterQuote> {
  const mint = input.mint.trim();
  if (!isSolanaPubkey(mint) || mint === SOL_MINT) {
    throw new Error("Enter a token mint to buy or sell.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter an amount greater than 0.");
  }

  if (input.side === "buy") {
    return fetchQuote({
      inputMint: SOL_MINT,
      outputMint: mint,
      amount: uiAmountToRaw(input.amount, 9),
      slippageBps: 100,
    });
  }

  const decimals = await getMintDecimals(mint);
  return fetchQuote({
    inputMint: mint,
    outputMint: SOL_MINT,
    amount: uiAmountToRaw(input.amount, decimals),
    slippageBps: 100,
  });
}

export async function executeDexSwap(input: {
  wallet: string;
  side: TradeSide;
  mint: string;
  amount: number;
  quote?: JupiterQuote;
}): Promise<ExecutedTrade> {
  if (!isSolanaPubkey(input.wallet)) {
    throw new Error("Sign in before trading.");
  }
  const mint = input.mint.trim();
  if (!isSolanaPubkey(mint) || mint === SOL_MINT) {
    throw new Error("Enter a token mint to buy or sell.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter an amount greater than 0.");
  }

  const inputMint = input.side === "buy" ? SOL_MINT : mint;
  const outputMint = input.side === "buy" ? mint : SOL_MINT;
  const amountRaw =
    input.side === "buy"
      ? uiAmountToRaw(input.amount, 9)
      : uiAmountToRaw(input.amount, await getMintDecimals(mint));

  try {
    if (input.side === "buy") {
      const [order] = await Promise.all([
        fetchUltraOrder({
          inputMint,
          outputMint,
          amount: amountRaw,
          taker: input.wallet,
        }).catch(() => null),
        assertCanAffordBuy(input.wallet, input.amount),
      ]);
      if (order) {
        const signed = await signSwapTransaction(order.transaction);
        const signature = await executeUltraOrder({
          signedTransaction: signed,
          requestId: order.requestId,
        });
        return { signature, quote: order, route: "jupiter" };
      }
    }
    const result = await executeJupiterSwap({
      inputMint,
      outputMint,
      amount: amountRaw,
      userPublicKey: input.wallet,
    });
    return { signature: result.signature, quote: result.quote, route: "jupiter" };
  } catch (error) {
    throw new Error(formatSwapError(error));
  }
}

export async function quoteFromPreview(input: {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  mint?: string;
  side?: string;
  amount?: number;
}): Promise<JupiterQuote> {
  const mint = String(input.mint ?? "").trim();
  const side = input.side === "sell" ? "sell" : "buy";
  if (
    typeof input.amount === "number" &&
    input.amount > 0 &&
    isSolanaPubkey(mint) &&
    mint !== SOL_MINT
  ) {
    return quoteDexSwap({ side, mint, amount: input.amount });
  }

  const inputMint = String(input.inputMint ?? "").trim();
  const outputMint = String(input.outputMint ?? "").trim();
  const inAmount = String(input.inAmount ?? "").trim();
  if (
    isSolanaPubkey(inputMint) &&
    isSolanaPubkey(outputMint) &&
    /^\d+$/.test(inAmount)
  ) {
    return fetchQuote({
      inputMint,
      outputMint,
      amount: inAmount,
      slippageBps: 100,
    });
  }

  if (!isSolanaPubkey(mint) || mint === SOL_MINT) {
    throw new Error("This preview has no token mint to swap.");
  }
  return quoteDexSwap({
    side,
    mint,
    amount: input.amount ?? instantBuySol(),
  });
}
