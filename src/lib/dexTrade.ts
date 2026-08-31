import {
  SOL_MINT,
  executeJupiterSwap,
  fetchQuote,
  getMintDecimals,
  uiAmountToRaw,
  type JupiterQuote,
} from "./jupiter";
import { getPrivyWalletAddress } from "./privyTx";
import { getTokenBalance, resolveSellAmount } from "./portfolio";
import { parseInstantTrade as parseTradeText } from "./tradeIntent";
import { assertCanAffordBuy, formatSwapError, getSolLamports, instantBuySol } from "./swapGuard";
import { isSolanaPubkey } from "./wallets";

function signingWallet(preferred?: string): string {
  const privy = getPrivyWalletAddress();
  if (privy && isSolanaPubkey(privy)) {
    return privy;
  }
  if (preferred && isSolanaPubkey(preferred)) {
    return preferred;
  }
  throw new Error("Sign in before trading.");
}

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
  percent?: number;
} | null {
  return parseTradeText(text);
}

export async function resolveTradeAmount(input: {
  wallet: string;
  side: TradeSide;
  mint: string;
  amount?: number;
  percent?: number;
}): Promise<number> {
  const wallet = signingWallet(input.wallet);
  if (input.side === "buy") {
    if (typeof input.amount === "number" && input.amount > 0) {
      return input.amount;
    }
    return instantBuySol();
  }

  const sellInput: { amount?: number; percent?: number } = {};
  if (typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0) {
    sellInput.amount = input.amount;
  } else if (
    typeof input.percent === "number" &&
    Number.isFinite(input.percent)
  ) {
    sellInput.percent = input.percent;
  } else {
    sellInput.percent = 100;
  }

  return resolveSellAmount(wallet, input.mint, sellInput);
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
  const wallet = signingWallet(input.wallet);
  const mint = input.mint.trim();
  if (!isSolanaPubkey(mint) || mint === SOL_MINT) {
    throw new Error("Enter a token mint to buy or sell.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter an amount greater than 0.");
  }

  const inputMint = input.side === "buy" ? SOL_MINT : mint;
  const outputMint = input.side === "buy" ? mint : SOL_MINT;

  try {
    let amountRaw: string;
    if (input.side === "buy") {
      await assertCanAffordBuy(wallet, input.amount);
      amountRaw = uiAmountToRaw(input.amount, 9);
    } else {
      const balance = await getTokenBalance(wallet, mint);
      if (balance <= 0) {
        throw new Error("You do not hold this token.");
      }
      let sellAmount = input.amount;
      if (sellAmount > balance) {
        throw new Error(
          `Not enough tokens. You hold ${balance.toPrecision(6)} but tried to sell ${sellAmount}.`,
        );
      }
      if (sellAmount >= balance * 0.999) {
        sellAmount = balance * 0.9999;
      }
      const sol = await getSolLamports(wallet);
      if (sol < 2_000_000) {
        throw new Error("Not enough SOL for sell fees. Keep a little SOL in the wallet.");
      }
      const decimals = await getMintDecimals(mint);
      amountRaw = uiAmountToRaw(sellAmount, decimals);
    }

    const result = await executeJupiterSwap({
      inputMint,
      outputMint,
      amount: amountRaw,
      userPublicKey: wallet,
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
