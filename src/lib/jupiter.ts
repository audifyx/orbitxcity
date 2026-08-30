import { solanaRpcUrl } from "./env";
import { invokeFunction } from "./supabase";
import { signAndSendSwapTransaction } from "./jupiterSign";

export { signAndSendSwapTransaction };

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";

export type JupiterQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  slippageBps: number;
  otherAmountThreshold?: string;
  swapMode?: string;
  priceImpactPct?: string;
  routePlan?: unknown[];
};

type RpcEnvelope = {
  result?: {
    value?: {
      data?: {
        parsed?: {
          info?: {
            decimals?: number;
          };
        };
      };
    };
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isQuote(value: unknown): value is JupiterQuote {
  const rec = asRecord(value);
  if (!rec) {
    return false;
  }
  return (
    typeof rec.inputMint === "string" &&
    typeof rec.outputMint === "string" &&
    typeof rec.inAmount === "string" &&
    rec.inAmount.length > 0 &&
    typeof rec.outAmount === "string" &&
    rec.outAmount.length > 0
  );
}

export function parseQuoteJson(raw: unknown): JupiterQuote | null {
  if (isQuote(raw)) {
    return raw;
  }
  if (typeof raw !== "string" || !raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isQuote(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getMintDecimals(mint: string): Promise<number> {
  if (mint === SOL_MINT) {
    return 9;
  }
  const response = await fetch(solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [mint, { encoding: "jsonParsed" }],
    }),
  });
  const json = (await response.json()) as RpcEnvelope;
  const decimals = json.result?.value?.data?.parsed?.info?.decimals;
  if (typeof decimals === "number" && decimals >= 0 && decimals <= 12) {
    return decimals;
  }
  return 6;
}

export function uiAmountToRaw(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter an amount greater than 0.");
  }
  const raw = Math.round(amount * 10 ** decimals);
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error("Amount is too small for this mint.");
  }
  return String(raw);
}

async function quoteFromLiteApi(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}): Promise<JupiterQuote> {
  const url = new URL(JUPITER_LITE_QUOTE);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amount);
  url.searchParams.set("slippageBps", String(params.slippageBps));
  const response = await fetch(url.toString());
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok || !isQuote(json)) {
    const rec = asRecord(json);
    const detail =
      typeof rec?.error === "string"
        ? rec.error
        : typeof rec?.message === "string"
          ? rec.message
          : `Jupiter quote failed (${response.status})`;
    throw new Error(detail);
  }
  return json;
}

export async function fetchQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  slippageBps?: number;
}): Promise<JupiterQuote> {
  const amount = String(params.amount);
  const slippageBps = params.slippageBps ?? 50;
  try {
    return await quoteFromLiteApi({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount,
      slippageBps,
    });
  } catch (liteError) {
    try {
      const data = await invokeFunction("jupiter-quote", {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount,
        slippageBps,
      });
      const quote = isQuote(data)
        ? data
        : isQuote(asRecord(data)?.quote)
          ? (asRecord(data)?.quote as JupiterQuote)
          : null;
      if (quote) {
        return quote;
      }
    } catch {
      // Prefer the live Jupiter error.
    }
    throw liteError instanceof Error
      ? liteError
      : new Error("No Jupiter quote returned");
  }
}

export async function fetchSwapTransaction(params: {
  quoteResponse: JupiterQuote;
  userPublicKey: string;
}): Promise<string> {
  const response = await fetch(JUPITER_LITE_SWAP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  const json = (await response.json()) as {
    swapTransaction?: string;
    error?: string;
  };
  if (!response.ok || !json.swapTransaction) {
    throw new Error(
      json.error ?? `Jupiter swap build failed (${response.status})`,
    );
  }
  return json.swapTransaction;
}

export async function confirmSignature(
  signature: string,
): Promise<"confirmed" | "failed" | "pending"> {
  const response = await fetch(solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignatureStatuses",
      params: [[signature], { searchTransactionHistory: true }],
    }),
  });
  const json = (await response.json()) as {
    result?: {
      value?: Array<{ confirmationStatus?: string; err?: unknown } | null>;
    };
  };
  const status = json.result?.value?.[0];
  if (!status) {
    return "pending";
  }
  if (status.err) {
    return "failed";
  }
  if (
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  ) {
    return "confirmed";
  }
  return "pending";
}
