import type { WalletId } from "./wallets";

export function isPrivyConfigured(): boolean {
  return false;
}

export async function connectWithPrivy(
  _walletId: WalletId,
): Promise<{ pubkey: string; signMessage: (message: string) => Promise<string> }> {
  throw new Error("Privy wallet connect is only available on the OrbitX website.");
}
