import { getInjectedPhantom } from "./phantom";

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
  _sendNative?: (transaction: Uint8Array) => Promise<Uint8Array | string>,
): Promise<string> {
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
