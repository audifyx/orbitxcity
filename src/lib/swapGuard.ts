import { solanaRpcUrl } from "./env";
import { isSolanaPubkey } from "./wallets";

const FEE_RESERVE_LAMPORTS = 5_000_000;
const DEFAULT_BUY_SOL = 0.05;
const MIN_BUY_SOL = 0.001;

type RpcEnvelope = {
  result?: { value?: number };
  error?: { message?: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4).replace(/\.?0+$/, "") || "0";
}

export function formatSwapError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lamports = message.match(/insufficient lamports (\d+), need (\d+)/i);
  if (lamports) {
    const have = Number(lamports[1]);
    const need = Number(lamports[2]);
    if (Number.isFinite(have) && Number.isFinite(need)) {
      return `Not enough SOL. Wallet has ${formatSol(have)} SOL; this buy needs ${formatSol(need)} SOL plus fees. Lower the amount.`;
    }
  }
  if (/too many requests|429/i.test(message)) {
    return "Jupiter is rate-limited. Wait a few seconds and try again.";
  }
  if (/simulation failed/i.test(message) && /custom program error: 0x1/i.test(message)) {
    return "Not enough SOL to complete this swap. Lower the buy amount or add SOL.";
  }
  if (/simulation failed/i.test(message)) {
    return "Swap simulation failed. Check your SOL balance and try a smaller amount.";
  }
  return message;
}

export async function formatCaughtSwapError(error: unknown): Promise<string> {
  let message = error instanceof Error ? error.message : String(error);
  const rec = asRecord(error);
  const getLogs = rec?.getLogs;
  if (typeof getLogs === "function") {
    try {
      const logs: unknown = await (getLogs as () => Promise<unknown>).call(error);
      if (Array.isArray(logs)) {
        const lines = logs.filter((line): line is string => typeof line === "string");
        if (lines.length > 0) {
          message = `${message}\n${lines.join("\n")}`;
        }
      }
    } catch {
      // Keep the original message if logs cannot be read.
    }
  }
  return formatSwapError(new Error(message));
}

export async function getSolLamports(wallet: string): Promise<number> {
  if (!isSolanaPubkey(wallet)) {
    throw new Error("Sign in before trading.");
  }
  const response = await fetch(solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [wallet],
    }),
  });
  const json = (await response.json()) as RpcEnvelope;
  const value = json.result?.value;
  if (!response.ok || json.error || typeof value !== "number") {
    throw new Error(json.error?.message ?? "Could not read SOL balance.");
  }
  return value;
}

export async function assertCanAffordBuy(
  wallet: string,
  solAmount: number,
): Promise<void> {
  if (!Number.isFinite(solAmount) || solAmount <= 0) {
    throw new Error("Enter a SOL amount greater than 0.");
  }
  const have = await getSolLamports(wallet);
  const need = Math.round(solAmount * 1e9) + FEE_RESERVE_LAMPORTS;
  if (have < need) {
    throw new Error(
      `Not enough SOL. Wallet has ${formatSol(have)} SOL. This buy needs ${solAmount} SOL plus about 0.005 SOL for fees.`,
    );
  }
}

export async function suggestBuySol(wallet: string): Promise<number> {
  const have = await getSolLamports(wallet);
  const spendable = (have - FEE_RESERVE_LAMPORTS) / 1e9;
  if (spendable < MIN_BUY_SOL) {
    throw new Error(
      `Not enough SOL to buy. Wallet has ${formatSol(have)} SOL. Add SOL or sell something first.`,
    );
  }
  const capped = Math.min(DEFAULT_BUY_SOL, spendable);
  return Math.floor(capped * 10000) / 10000;
}
