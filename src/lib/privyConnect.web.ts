import bs58 from "bs58";

import { privyAppId } from "./env";
import { isSolanaPubkey, isSolanaSignature, type WalletId } from "./wallets";

type PrivySolanaWallet = {
  address: string;
  standardWallet?: { name?: string };
};

type SignResult = { signature: Uint8Array } | Uint8Array;

type PrivyRuntime = {
  ready: boolean;
  connectWallet: (opts: {
    description?: string;
    walletList?: Array<"phantom" | "jupiter">;
    walletChainType?: "solana-only";
  }) => void | Promise<void>;
  wallets: PrivySolanaWallet[];
  signMessage: (opts: {
    message: Uint8Array;
    wallet: PrivySolanaWallet;
  }) => Promise<SignResult>;
};

let runtime: PrivyRuntime | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerPrivyRuntime(next: PrivyRuntime | null): void {
  runtime = next;
}

export function isPrivyConfigured(): boolean {
  return privyAppId.length > 0;
}

function walletNameMatches(wallet: PrivySolanaWallet, walletId: WalletId): boolean {
  const name = (wallet.standardWallet?.name ?? "").toLowerCase();
  if (walletId === "phantom") {
    return name.includes("phantom");
  }
  return name.includes("jupiter") || name.includes("jup");
}

function pickWallet(
  wallets: PrivySolanaWallet[],
  walletId: WalletId,
): PrivySolanaWallet | null {
  const named = wallets.find((wallet) => walletNameMatches(wallet, walletId));
  if (named && isSolanaPubkey(named.address)) {
    return named;
  }
  const first = wallets.find((wallet) => isSolanaPubkey(wallet.address));
  return first ?? null;
}

function toBase58Signature(result: SignResult): string {
  const bytes = result instanceof Uint8Array ? result : result.signature;
  const encoded = bs58.encode(bytes);
  if (!isSolanaSignature(encoded)) {
    throw new Error("Wallet did not return a valid signature.");
  }
  return encoded;
}

async function waitForRuntime(timeoutMs: number): Promise<PrivyRuntime> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runtime?.ready) {
      return runtime;
    }
    await sleep(50);
  }
  if (!isPrivyConfigured()) {
    throw new Error(
      "OrbitX is missing the Privy App ID on this build. Set PRIVY_APP_ID or EXPO_PUBLIC_PRIVY_APP_ID on Vercel.",
    );
  }
  throw new Error("Wallet connect is still starting. Try again.");
}

async function waitForWallet(
  getWallets: () => PrivySolanaWallet[],
  walletId: WalletId,
  timeoutMs: number,
): Promise<PrivySolanaWallet> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const wallet = pickWallet(getWallets(), walletId);
    if (wallet) {
      return wallet;
    }
    await sleep(80);
  }
  throw new Error("Wallet did not connect. Pick Phantom or Jupiter and approve.");
}

export async function connectWithPrivy(
  walletId: WalletId,
): Promise<{ pubkey: string; signMessage: (message: string) => Promise<string> }> {
  const current = await waitForRuntime(30000);
  let wallet = pickWallet(current.wallets, walletId);

  if (!wallet) {
    await current.connectWallet({
      description: "Connect to OrbitX. This request will not send a transaction.",
      walletList: [walletId],
      walletChainType: "solana-only",
    });
    wallet = await waitForWallet(() => runtime?.wallets ?? current.wallets, walletId, 90000);
  }

  const pubkey = wallet.address.trim();
  if (!isSolanaPubkey(pubkey)) {
    throw new Error("Wallet did not return a valid Solana address.");
  }

  return {
    pubkey,
    signMessage: async (message: string) => {
      const latest = runtime ?? current;
      const active = pickWallet(latest.wallets, walletId) ?? wallet;
      const signed = await latest.signMessage({
        message: new TextEncoder().encode(message),
        wallet: active,
      });
      return toBase58Signature(signed);
    },
  };
}
