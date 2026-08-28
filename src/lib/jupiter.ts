import { Platform } from "react-native";

import { getInjectedPhantom } from "./phantom";
import { invokeFunction } from "./supabase";

const JUPITER_LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

export type JupiterQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold?: string;
  slippageBps: number;
  routePlan?: unknown[];
};

function isQuote(value: unknown): value is JupiterQuote {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.inputMint === "string" &&
    typeof rec.outputMint === "string" &&
    typeof rec.inAmount === "string" &&
    typeof rec.outAmount === "string"
  );
}

export async function fetchQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  slippageBps?: number;
}): Promise<JupiterQuote> {
  const data = await invokeFunction("jupiter-quote", {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(params.amount),
    slippageBps: params.slippageBps ?? 50,
  });
  const quote = isQuote(data)
    ? data
    : typeof data === "object" &&
        data !== null &&
        isQuote((data as Record<string, unknown>).quote)
      ? ((data as Record<string, unknown>).quote as JupiterQuote)
      : null;
  if (!quote) {
    throw new Error("No Jupiter quote returned");
  }
  return quote;
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

function b64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signAndSendSwapTransaction(
  swapTransactionB64: string,
): Promise<string> {
  if (Platform.OS !== "web") {
    throw new Error(
      "Live swaps currently sign with injected Phantom in a browser. Native Universal Link swap signing is not enabled — this is not a simulated fill.",
    );
  }
  const provider = getInjectedPhantom();
  if (!provider?.signAndSendTransaction) {
    throw new Error(
      "Phantom is not injected in this session. Open OrbitX in a Phantom-enabled browser to sign the swap.",
    );
  }
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTransactionB64));
  const result = await provider.signAndSendTransaction(tx);
  const signature = typeof result === "string" ? result : result.signature;
  if (!signature) {
    throw new Error("Phantom did not return a signature");
  }
  return signature;
}

export async function confirmSignature(
  signature: string,
): Promise<"confirmed" | "failed" | "pending"> {
  const rpc = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? DEFAULT_RPC;
  const response = await fetch(rpc, {
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
  if (!status) return "pending";
  if (status.err) return "failed";
  if (
    status.confirmationStatus === "confirmed" ||
    status.confirmationStatus === "finalized"
  ) {
    return "confirmed";
  }
  return "pending";
}

export function parseQuoteJson(raw: unknown): JupiterQuote | null {
  if (isQuote(raw)) return raw;
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isQuote(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
