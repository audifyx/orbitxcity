import {
  confirmSignature,
  fetchQuote,
  fetchSwapTransaction,
  signAndSendSwapTransaction,
  type JupiterQuote,
} from "./jupiter";
import { pumpCurveTrade } from "./pumpfun";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export type TradeSide = "buy" | "sell";

export type ExecutedTrade = {
  signature: string;
  quote: JupiterQuote | null;
  route: "jupiter" | "pump";
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function quoteDexSwap(input: {
  side: TradeSide;
  mint: string;
  solAmount: number;
}): Promise<JupiterQuote> {
  const lamports = Math.round(input.solAmount * 1_000_000_000);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error("Enter a SOL amount greater than 0.");
  }
  return fetchQuote({
    inputMint: input.side === "sell" ? input.mint : SOL_MINT,
    outputMint: input.side === "sell" ? SOL_MINT : input.mint,
    amount: lamports,
    slippageBps: 50,
  });
}

export async function executeDexSwap(input: {
  wallet: string;
  side: TradeSide;
  mint: string;
  solAmount: number;
}): Promise<ExecutedTrade> {
  try {
    const quote = await quoteDexSwap(input);
    const swapTx = await fetchSwapTransaction({
      quoteResponse: quote,
      userPublicKey: input.wallet,
    });
    const signature = await signAndSendSwapTransaction(swapTx);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sleep(1500);
      const outcome = await confirmSignature(signature);
      if (outcome === "confirmed") {
        return { signature, quote, route: "jupiter" };
      }
      if (outcome === "failed") {
        throw new Error("Jupiter swap landed as failed.");
      }
    }
    return { signature, quote, route: "jupiter" };
  } catch (error) {
    const signature = await pumpCurveTrade({
      wallet: input.wallet,
      mint: input.mint,
      action: input.side,
      amount: input.solAmount,
    });
    return { signature, quote: null, route: "pump" };
  }
}
