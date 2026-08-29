import type { WalletId } from "./wallets";

export function isPrivyConfigured(): boolean {
  return false;
}

export function consumePrivyHostResult(): { pubkey: string; signature: string } | null {
  return null;
}

export async function connectWithPrivy(
  _walletId: WalletId,
): Promise<{ pubkey: string; signature: string }> {
  throw new Error("Privy wallet connect is only available on the OrbitX website.");
}
