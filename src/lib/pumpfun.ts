import { Buffer } from "buffer";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

import { signAndSendWithPrivy } from "./privyTx";

const PUMP_IPFS = "https://pump.fun/api/ipfs";
const PUMP_TRADE_LOCAL = "https://pumpportal.fun/api/trade-local";

export type PumpCreateInput = {
  wallet: string;
  name: string;
  symbol: string;
  description: string;
  imageUri?: string;
  initialBuySol?: number;
};

export type PumpCreateResult = {
  signature: string;
  mint: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function encodeTx(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function signWithMint(raw: Uint8Array, mint: Keypair): string {
  try {
    const tx = VersionedTransaction.deserialize(raw);
    tx.sign([mint]);
    return encodeTx(tx.serialize());
  } catch {
    const legacy = Transaction.from(raw);
    legacy.partialSign(mint);
    return encodeTx(legacy.serialize({ requireAllSignatures: false }));
  }
}

export async function uploadPumpMetadata(input: {
  name: string;
  symbol: string;
  description: string;
}): Promise<string> {
  const form = new FormData();
  form.append("name", input.name);
  form.append("symbol", input.symbol);
  form.append("description", input.description);
  form.append("twitter", "");
  form.append("telegram", "");
  form.append("website", "https://ogscan.fun");
  form.append("showName", "true");

  const response = await fetch(PUMP_IPFS, {
    method: "POST",
    body: form,
  });
  const json: unknown = await response.json().catch(() => null);
  const rec = asRecord(json);
  const uri =
    (typeof rec?.metadataUri === "string" && rec.metadataUri) ||
    (typeof rec?.uri === "string" && rec.uri) ||
    (typeof rec?.metadata === "object" && rec.metadata !== null
      ? String((rec.metadata as Record<string, unknown>).uri ?? "")
      : "");
  if (!response.ok || !uri) {
    throw new Error(
      typeof rec?.error === "string"
        ? rec.error
        : "pump.fun metadata upload failed. Add a name and ticker and try again.",
    );
  }
  return uri;
}

export async function createPumpToken(
  input: PumpCreateInput,
): Promise<PumpCreateResult> {
  const name = input.name.trim();
  const symbol = input.symbol.trim().toUpperCase();
  if (name.length < 2 || symbol.length < 2) {
    throw new Error("Token name and ticker are required.");
  }
  if (!input.wallet) {
    throw new Error("Sign in before launching.");
  }

  const mint = Keypair.generate();
  const uri = await uploadPumpMetadata({
    name,
    symbol,
    description: input.description.trim() || `${name} launched from OrbitX.`,
  });

  const response = await fetch(PUMP_TRADE_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: input.wallet,
      action: "create",
      tokenMetadata: { name, symbol, uri },
      mint: mint.publicKey.toBase58(),
      denominatedInSol: "true",
      amount: input.initialBuySol ?? 0,
      slippage: 15,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail.slice(0, 220) || "pump.fun create failed.");
  }

  const raw = new Uint8Array(await response.arrayBuffer());
  const signed = signWithMint(raw, mint);
  const signature = await signAndSendWithPrivy(signed);
  return { signature, mint: mint.publicKey.toBase58() };
}

export async function pumpCurveTrade(input: {
  wallet: string;
  mint: string;
  action: "buy" | "sell";
  amount: number;
}): Promise<string> {
  const response = await fetch(PUMP_TRADE_LOCAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: input.wallet,
      action: input.action,
      mint: input.mint,
      denominatedInSol: "true",
      amount: input.amount,
      slippage: 15,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail.slice(0, 220) || "pump.fun trade failed.");
  }
  const raw = new Uint8Array(await response.arrayBuffer());
  return signAndSendWithPrivy(encodeTx(raw));
}
