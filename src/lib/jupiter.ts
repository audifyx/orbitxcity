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

async function fetchJupiterJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, init);
    lastStatus = response.status;
    if (response.status === 429 || response.status === 503) {
      await sleep(500 * 2 ** attempt);
      continue;
    }
    const json: unknown = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, json };
  }
  throw new Error(lastStatus === 429 ? "Too Many Requests" : `Jupiter request failed (${lastStatus})`);
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
  const { ok, status, json } = await fetchJupiterJson(url.toString());
  if (!ok || !isQuote(json)) {
    const rec = asRecord(json);
    const detail =
      typeof rec?.error === "string"
        ? rec.error
        : typeof rec?.message === "string"
          ? rec.message
          : `Jupiter quote failed (${status})`;
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
    const fallback =
      liteError instanceof Error ? liteError.message : "No Jupiter quote returned";
    if (/too many requests|429/i.test(fallback)) {
      throw new Error("Too Many Requests");
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
  const { ok, status, json } = await fetchJupiterJson(JUPITER_LITE_SWAP, {
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
  const rec = asRecord(json);
  const swapTransaction =
    typeof rec?.swapTransaction === "string" ? rec.swapTransaction : "";
  if (!ok || !swapTransaction) {
    const detail =
      typeof rec?.error === "string"
        ? rec.error
        : `Jupiter swap build failed (${status})`;
    throw new Error(detail);
  }
  return swapTransaction;
}

export type SignatureOutcome = "confirmed" | "failed" | "pending";

const RPC_URLS = Array.from(
  new Set([solanaRpcUrl, "https://api.mainnet-beta.solana.com"]),
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SignatureStatus = {
  confirmationStatus?: string;
  err?: unknown;
};

type RpcResponse = {
  result?: unknown;
  error?: { message?: string };
};

async function rpcCall(
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC ${response.status}`);
  }
  const json = (await response.json()) as RpcResponse;
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  return json.result;
}

function outcomeFromStatus(status: SignatureStatus | null): SignatureOutcome | null {
  if (!status) {
    return null;
  }
  if (status.err) {
    return "failed";
  }
  if (
    status.confirmationStatus === "processed" ||
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  ) {
    return "confirmed";
  }
  return null;
}

async function confirmOnRpc(
  url: string,
  signature: string,
): Promise<SignatureOutcome> {
  const statuses = (await rpcCall(url, "getSignatureStatuses", [
    [signature],
    { searchTransactionHistory: true },
  ])) as { value?: Array<SignatureStatus | null> } | null;
  const fromStatus = outcomeFromStatus(statuses?.value?.[0] ?? null);
  if (fromStatus) {
    return fromStatus;
  }

  const tx = (await rpcCall(url, "getTransaction", [
    signature,
    {
      encoding: "json",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    },
  ])) as { meta?: { err?: unknown } | null; slot?: number } | null;
  if (tx && typeof tx === "object") {
    if (tx.meta?.err) {
      return "failed";
    }
    return "confirmed";
  }
  return "pending";
}

export async function confirmSignature(
  signature: string,
): Promise<SignatureOutcome> {
  if (!signature.trim()) {
    return "pending";
  }
  for (const url of RPC_URLS) {
    try {
      const outcome = await confirmOnRpc(url, signature);
      if (outcome !== "pending") {
        return outcome;
      }
    } catch {
      // Try the next RPC. Public mainnet often 429s mid-poll.
    }
  }
  return "pending";
}

export async function waitForSignature(
  signature: string,
  options?: { attempts?: number; intervalMs?: number },
): Promise<SignatureOutcome> {
  const attempts = options?.attempts ?? 24;
  const intervalMs = options?.intervalMs ?? 2000;
  if (attempts < 1) {
    return "pending";
  }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(intervalMs);
    }
    const outcome = await confirmSignature(signature);
    if (outcome !== "pending") {
      return outcome;
    }
  }
  return "pending";
}
