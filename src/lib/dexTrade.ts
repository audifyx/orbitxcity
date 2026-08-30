import {
  SOL_MINT,
  fetchQuote,
  fetchSwapTransaction,
  getMintDecimals,
  signAndSendSwapTransaction,
  uiAmountToRaw,
  waitForSignature,
  type JupiterQuote,
} from "./jupiter";
import { pumpCurveTrade } from "./pumpfun";
import { assertCanAffordBuy, formatSwapError, solAmountForUsd } from "./swapGuard";
import { isSolanaPubkey } from "./wallets";

export { SOL_MINT };
export type { JupiterQuote };

export type TradeSide = "buy" | "sell";

export type ExecutedTrade = {
  signature: string;
  quote: JupiterQuote;
  route: "jupiter" | "pump";
};

function isNoRouteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no route|could not find|not tradable|no markets/i.test(message);
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
}): Promise<ExecutedTrade> {
  if (!isSolanaPubkey(input.wallet)) {
    throw new Error("Sign in before trading.");
  }
  if (input.side === "buy") {
    await assertCanAffordBuy(input.wallet, input.amount);
  }

  let quote: JupiterQuote;
  try {
    quote = await quoteDexSwap(input);
  } catch (error) {
    if (input.side === "buy" && isNoRouteError(error)) {
      const signature = await pumpCurveTrade({
        wallet: input.wallet,
        mint: input.mint.trim(),
        action: "buy",
        amount: input.amount,
      });
      return {
        signature,
        quote: {
          inputMint: SOL_MINT,
          outputMint: input.mint.trim(),
          inAmount: uiAmountToRaw(input.amount, 9),
          outAmount: "0",
          slippageBps: 1500,
        },
        route: "pump",
      };
    }
    throw new Error(formatSwapError(error));
  }

  try {
    const swapTx = await fetchSwapTransaction({
      quoteResponse: quote,
      userPublicKey: input.wallet,
    });
    const signature = await signAndSendSwapTransaction(swapTx);
    const outcome = await waitForSignature(signature, {
      attempts: 24,
      intervalMs: 2000,
    });
    if (outcome === "failed") {
      throw new Error("Jupiter swap landed as failed.");
    }
    return { signature, quote, route: "jupiter" };
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
  const fallbackAmount =
    side === "buy" ? await solAmountForUsd() : 0.05;
  return quoteDexSwap({
    side,
    mint,
    amount: input.amount ?? fallbackAmount,
  });
}
