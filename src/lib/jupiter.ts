import { solanaRpcUrl } from "./env";
import { invokeFunction } from "./supabase";
import { signAndSendSwapTransaction } from "./jupiterSign";

export { signAndSendSwapTransaction };

const JUPITER_LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [350, 900, 1800];

export type JupiterQuote = {
  inputMint: string; outputMint: string; inAmount: string; outAmount: string;
  otherAmountThreshold?: string; slippageBps: number; routePlan?: unknown[];
};

function isQuote(value: unknown): value is JupiterQuote {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.inputMint === "string" && typeof rec.outputMint === "string" &&
    typeof rec.inAmount === "string" && typeof rec.outAmount === "string";
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try { return await fn(); } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed after retries");
}

export async function fetchQuote(params: {
  inputMint: string; outputMint: string; amount: string | number; slippageBps?: number;
}): Promise<JupiterQuote> {
  return retry(async () => {
    const data = await invokeFunction("jupiter-quote", {
      inputMint: params.inputMint, outputMint: params.outputMint,
      amount: String(params.amount), slippageBps: params.slippageBps ?? 75,
    });
    const quote = isQuote(data) ? data : typeof data === "object" && data !== null && isQuote((data as Record<string, unknown>).quote)
      ? ((data as Record<string, unknown>).quote as JupiterQuote) : null;
    if (!quote) throw new Error("No Jupiter quote returned");
    return quote;
  });
}

export async function fetchSwapTransaction(params: { quoteResponse: JupiterQuote; userPublicKey: string }): Promise<string> {
  return retry(async () => {
    const response = await fetch(JUPITER_LITE_SWAP, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: params.quoteResponse, userPublicKey: params.userPublicKey,
        wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
        dynamicSlippage: true, prioritizationFeeLamports: "auto",
      }),
    });
    const json = (await response.json()) as { swapTransaction?: string; error?: string };
    if (!response.ok || !json.swapTransaction) throw new Error(json.error ?? `Jupiter swap build failed (${response.status})`);
    return json.swapTransaction;
  });
}

export async function confirmSignature(signature: string): Promise<"confirmed" | "failed" | "pending"> {
  return retry(async () => {
    const response = await fetch(solanaRpcUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[signature], { searchTransactionHistory: true }] }),
    });
    const json = (await response.json()) as { result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> } };
    if (!response.ok) throw new Error(`Solana RPC failed (${response.status})`);
    const status = json.result?.value?.[0];
    if (!status) return "pending";
    if (status.err) return "failed";
    if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") return "confirmed";
    return "pending";
  });
}

export function parseQuoteJson(raw: unknown): JupiterQuote | null {
  if (isQuote(raw)) return raw;
  if (typeof raw !== "string" || !raw) return null;
  try { const parsed: unknown = JSON.parse(raw); return isQuote(parsed) ? parsed : null; }
  catch { return null; }
}
