import { Buffer } from "buffer";
import bs58 from "bs58";

export type NativeSolanaTransactionSender = (
  transaction: Uint8Array,
) => Promise<Uint8Array | string>;

function decodeBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

export async function signAndSendSwapTransaction(
  swapTransactionB64: string,
  sendNative?: NativeSolanaTransactionSender,
): Promise<string> {
  if (!sendNative) {
    throw new Error(
      "A connected embedded Solana wallet is required to sign this swap.",
    );
  }
  const result = await sendNative(decodeBase64(swapTransactionB64));
  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }
  if (result instanceof Uint8Array && result.length > 0) {
    return bs58.encode(result);
  }
  throw new Error("Privy did not return a transaction signature.");
}
