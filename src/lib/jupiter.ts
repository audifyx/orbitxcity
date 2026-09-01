import { solanaRpcUrl } from "./env";
import { invokeFunction } from "./supabase";
import { signAndSendSwapTransaction } from "./jupiterSign";

export { signAndSendSwapTransaction };

const JUPITER_LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";
const RAPTOR_BASE = "https://raptor-beta.solanatracker.io";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [350, 900, 1800];

export type JupiterQuote = {
  inputMint: string; outputMint: string; inAmount: string; outAmount: string;
  otherAmountThreshold?: string; slippageBps: number; routePlan?: unknown[];
  provider?: "jupiter" | "raptor";
  minAmountOut?: string;
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

function normalizeRaptorQuote(raw: unknown, params: { inputMint: string; outputMint: string; slippageBps: number }): JupiterQuote | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  const inAmount = String(rec.amountIn ?? rec.inAmount ?? "");
  const outAmount = String(rec.amountOut ?? rec.outAmount ?? "");
  if (!inAmount || !outAmount) return null;
  return {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inAmount,
    outAmount,
    otherAmountThreshold: String(rec.minAmountOut ?? rec.otherAmountThreshold ?? outAmount),
    minAmountOut: String(rec.minAmountOut ?? outAmount),
    slippageBps: params.slippageBps,
    routePlan: Array.isArray(rec.routePlan) ? rec.routePlan : [],
    provider: "raptor",
  };
}

async function fetchRaptorQuote(params: { inputMint: string; outputMint: string; amount: string | number; slippageBps: number }): Promise<JupiterQuote> {
  const url = new URL(`${RAPTOR_BASE}/quote`);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", String(params.amount));
  url.searchParams.set("slippageBps", String(params.slippageBps));
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const data = await response.json() as unknown;
  if (!response.ok) throw new Error(`Raptor quote failed (${response.status})`);
  const quote = normalizeRaptorQuote(data, params);
  if (!quote) throw new Error("Raptor returned no usable quote");
  return quote;
}

export async function fetchQuote(params: {
  inputMint: string; outputMint: string; amount: string | number; slippageBps?: number;
}): Promise<JupiterQuote> {
  try {
    return await retry(async () => {
      const data = await invokeFunction("jupiter-quote", {
        inputMint: params.inputMint, outputMint: params.outputMint,
        amount: String(params.amount), slippageBps: params.slippageBps ?? 75,
      });
      const quote = isQuote(data) ? data : typeof data === "object" && data !== null && isQuote((data as Record<string, unknown>).quote)
        ? ((data as Record<string, unknown>).quote as JupiterQuote) : null;
      if (!quote) throw new Error("No Jupiter quote returned");
      return { ...quote, provider: quote.provider ?? "jupiter" };
    });
  } catch (jupiterError) {
    try {
      return await fetchRaptorQuote({
        ...params,
        slippageBps: params.slippageBps ?? 75,
      });
    } catch (raptorError) {
      const j = jupiterError instanceof Error ? jupiterError.message : "Jupiter unavailable";
      const r = raptorError instanceof Error ? raptorError.message : "Raptor unavailable";
      throw new Error(`Swap quote providers unavailable. Jupiter: ${j}. Raptor: ${r}`);
    }
  }
}

export async function fetchSwapTransaction(params: { quoteResponse: JupiterQuote; userPublicKey: string }): Promise<string> {
  if (params.quoteResponse.provider === "raptor") {
    const response = await fetch(`${RAPTOR_BASE}/swap`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: params.quoteResponse, userPublicKey: params.userPublicKey,
        wrapUnwrapSol: true, txVersion: "V0", priorityFee: "medium", maxPriorityFee: 1_000_000,
      }),
    });
    const json = await response.json() as { swapTransaction?: string; error?: string };
    if (!response.ok || !json.swapTransaction) throw new Error(json.error ?? `Raptor swap build failed (${response.status})`);
    return json.swapTransaction;
  }
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
