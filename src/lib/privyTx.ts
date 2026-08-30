type PrivyTxSigner = (transactionB64: string) => Promise<string>;

let sendSigner: PrivyTxSigner | null = null;
let signOnly: PrivyTxSigner | null = null;

export function setPrivyTransactionSigner(next: PrivyTxSigner | null): void {
  sendSigner = next;
}

export function setPrivySignOnly(next: PrivyTxSigner | null): void {
  signOnly = next;
}

export async function signAndSendWithPrivy(
  transactionB64: string,
): Promise<string> {
  if (!sendSigner) {
    throw new Error("OrbitX wallet is not ready to sign. Stay signed in and try again.");
  }
  const signature = (await sendSigner(transactionB64)).trim();
  if (!signature) {
    throw new Error("Privy did not return a transaction signature.");
  }
  return signature;
}

export async function signTransactionWithPrivy(
  transactionB64: string,
): Promise<string> {
  if (!signOnly) {
    throw new Error("OrbitX wallet is not ready to sign. Stay signed in and try again.");
  }
  const signed = (await signOnly(transactionB64)).trim();
  if (!signed) {
    throw new Error("Privy did not return a signed transaction.");
  }
  return signed;
}
