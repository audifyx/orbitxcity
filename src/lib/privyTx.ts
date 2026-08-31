type PrivyTxSigner = (transactionB64: string) => Promise<string>;
type WalletAddressListener = (address: string | null) => void;

let sendSigner: PrivyTxSigner | null = null;
let signOnly: PrivyTxSigner | null = null;
let walletAddress: string | null = null;
const addressListeners = new Set<WalletAddressListener>();

export function setPrivyTransactionSigner(next: PrivyTxSigner | null): void {
  sendSigner = next;
}

export function setPrivySignOnly(next: PrivyTxSigner | null): void {
  signOnly = next;
}

export function setPrivyWalletAddress(next: string | null): void {
  const address = next && next.trim() ? next.trim() : null;
  if (address === walletAddress) {
    return;
  }
  walletAddress = address;
  for (const listener of addressListeners) {
    listener(walletAddress);
  }
}

export function getPrivyWalletAddress(): string | null {
  return walletAddress;
}

export function subscribePrivyWalletAddress(
  listener: WalletAddressListener,
): () => void {
  addressListeners.add(listener);
  listener(walletAddress);
  return () => {
    addressListeners.delete(listener);
  };
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
