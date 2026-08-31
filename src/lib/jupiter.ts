import { solanaRpcUrl } from "./env";
import {
  signAndSendSwapTransaction,
  signSwapTransaction,
} from "./jupiterSign";
import { getPrivyWalletAddress, setPrivyWalletAddress } from "./privyTx";
import { missingSignerPubkey } from "./swapGuard";
import { isSolanaPubkey } from "./wallets";

export { signAndSendSwapTransaction, signSwapTransaction };

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";
const JUPITER_ULTRA_ORDER = "https://lite-api.jup.ag/ultra/v1/order";
const JUPITER_ULTRA_EXECUTE = "https://lite-api.jup.ag/ultra/v1/execute";
const JUPITER_TIMEOUT_MS = 8000;

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

function abortAfter(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function fetchJupiterJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: init?.signal ?? abortAfter(JUPITER_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/abort|timeout/i.test(message)) {
        throw new Error("Jupiter timed out. Try the buy again.");
      }
      throw error;
    }
    lastStatus = response.status;
    if (response.status === 429 || response.status === 503) {
      await sleep(200 * 2 ** attempt);
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
  return quoteFromLiteApi({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount,
    slippageBps,
  });
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
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 2_000_000,
          priorityLevel: "veryHigh",
        },
      },
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

export type UltraOrder = JupiterQuote & {
  transaction: string;
  requestId: string;
};

export async function fetchUltraOrder(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker: string;
}): Promise<UltraOrder> {
  const url = new URL(JUPITER_ULTRA_ORDER);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amount);
  url.searchParams.set("taker", params.taker);
  const { ok, status, json } = await fetchJupiterJson(url.toString());
  const rec = asRecord(json);
  const transaction =
    typeof rec?.transaction === "string" ? rec.transaction : "";
  const requestId = typeof rec?.requestId === "string" ? rec.requestId : "";
  if (!ok || !isQuote(json) || !transaction || !requestId) {
    const detail =
      typeof rec?.errorMessage === "string"
        ? rec.errorMessage
        : typeof rec?.error === "string"
          ? rec.error
          : `Jupiter order failed (${status})`;
    throw new Error(detail);
  }
  return {
    ...(json as JupiterQuote),
    transaction,
    requestId,
  };
}

export async function executeUltraOrder(params: {
  signedTransaction: string;
  requestId: string;
}): Promise<string> {
  const { ok, status, json } = await fetchJupiterJson(JUPITER_ULTRA_EXECUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedTransaction: params.signedTransaction,
      requestId: params.requestId,
    }),
  });
  const rec = asRecord(json);
  const signature = typeof rec?.signature === "string" ? rec.signature : "";
  const execStatus = typeof rec?.status === "string" ? rec.status : "";
  if (execStatus.toLowerCase() === "failed" || (!ok && !signature)) {
    const detail =
      typeof rec?.error === "string"
        ? rec.error
        : `Jupiter execute failed (${status})`;
    throw new Error(detail);
  }
  if (!signature) {
    throw new Error(`Jupiter execute failed (${status})`);
  }
  return signature;
}

function signingPubkey(preferred: string): string {
  const privy = getPrivyWalletAddress();
  if (privy && isSolanaPubkey(privy)) {
    return privy;
  }
  return preferred;
}

function rememberSigner(pubkey: string): string {
  if (isSolanaPubkey(pubkey)) {
    setPrivyWalletAddress(pubkey);
  }
  return pubkey;
}

export async function executeJupiterSwap(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  userPublicKey: string;
}): Promise<{ signature: string; quote: JupiterQuote }> {
  const taker = signingPubkey(params.userPublicKey);
  let order: UltraOrder | null = null;
  try {
    order = await fetchUltraOrder({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      taker,
    });
  } catch {
    order = null;
  }

  if (order) {
    try {
      const signed = await signSwapTransaction(order.transaction);
      const signature = await executeUltraOrder({
        signedTransaction: signed,
        requestId: order.requestId,
      });
      return { signature, quote: order };
    } catch (error) {
      const other = missingSignerPubkey(error);
      if (!other || other === taker) {
        throw error;
      }
      const retryTaker = rememberSigner(other);
      const retry = await fetchUltraOrder({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        taker: retryTaker,
      });
      const signed = await signSwapTransaction(retry.transaction);
      const signature = await executeUltraOrder({
        signedTransaction: signed,
        requestId: retry.requestId,
      });
      return { signature, quote: retry };
    }
  }

  const quote = await fetchQuote({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: 100,
  });
  try {
    const swapTx = await fetchSwapTransaction({
      quoteResponse: quote,
      userPublicKey: taker,
    });
    const signature = await signAndSendSwapTransaction(swapTx);
    return { signature, quote };
  } catch (error) {
    const other = missingSignerPubkey(error);
    if (!other || other === taker) {
      throw error;
    }
    const retryTaker = rememberSigner(other);
    const swapTx = await fetchSwapTransaction({
      quoteResponse: quote,
      userPublicKey: retryTaker,
    });
    const signature = await signAndSendSwapTransaction(swapTx);
    return { signature, quote };
  }
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
  const attempts = options?.attempts ?? 12;
  const intervalMs = options?.intervalMs ?? 400;
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
