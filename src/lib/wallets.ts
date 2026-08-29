import { Platform } from "react-native";
import * as Linking from "expo-linking";
import bs58 from "bs58";

export type WalletId = "jupiter" | "phantom";

export const WALLET_LABELS: Record<WalletId, string> = {
  jupiter: "Jupiter",
  phantom: "Phantom",
};

type InjectedProvider = {
  isPhantom?: boolean;
  isJupiter?: boolean;
  publicKey?: { toBase58?: () => string; toString(): string } | null;
  connect(): Promise<{ publicKey?: { toBase58?: () => string; toString(): string } } | void>;
  signMessage(
    message: Uint8Array,
    display?: "utf8" | "hex",
  ): Promise<{ signature: Uint8Array | string } | Uint8Array>;
};

type StandardAccount = {
  address: string;
  publicKey?: Uint8Array;
};

type StandardWallet = {
  name: string;
  accounts: StandardAccount[];
  features: Record<string, unknown>;
};

type JupiterWindow = Window & {
  phantom?: { solana?: InjectedProvider };
  solana?: InjectedProvider;
  jupiter?: { solana?: InjectedProvider } | InjectedProvider;
  jup?: { solana?: InjectedProvider } | InjectedProvider;
};

const JUPITER_OPEN_CANDIDATES = [
  "jupiter://",
  "jup://",
  "https://jup.ag",
] as const;

function getWindow(): JupiterWindow | null {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }
  return window as JupiterWindow;
}

function asProvider(value: unknown): InjectedProvider | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.connect !== "function" || typeof rec.signMessage !== "function") {
    return null;
  }
  return value as InjectedProvider;
}

function unwrapNested(value: unknown): InjectedProvider | null {
  const direct = asProvider(value);
  if (direct) {
    return direct;
  }
  if (value && typeof value === "object" && "solana" in value) {
    return asProvider((value as { solana?: unknown }).solana);
  }
  return null;
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof value === "string") {
    return bs58.decode(value);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  if (value && typeof value === "object" && "signature" in value) {
    return toBytes((value as { signature: unknown }).signature);
  }
  throw new Error("Wallet did not return a signature.");
}

function pubkeyFromKey(key: { toBase58?: () => string; toString(): string } | null | undefined): string {
  const pubkey = key?.toBase58?.() ?? key?.toString() ?? "";
  if (!pubkey) {
    throw new Error("Wallet did not return a public key.");
  }
  return pubkey;
}

export function isSolanaPubkey(value: string): boolean {
  try {
    return bs58.decode(value.trim()).length === 32;
  } catch {
    return false;
  }
}

export function isSolanaSignature(value: string): boolean {
  try {
    return bs58.decode(value.trim()).length === 64;
  } catch {
    return false;
  }
}

function getInjectedById(id: WalletId): InjectedProvider | null {
  const win = getWindow();
  if (!win) {
    return null;
  }

  if (id === "phantom") {
    return (
      unwrapNested(win.phantom) ??
      (win.solana?.isPhantom ? asProvider(win.solana) : null)
    );
  }

  return (
    unwrapNested(win.jupiter) ??
    unwrapNested(win.jup) ??
    (win.solana?.isJupiter ? asProvider(win.solana) : null)
  );
}

function walletNameMatches(name: string, id: WalletId): boolean {
  const lower = name.toLowerCase();
  if (id === "jupiter") {
    return lower.includes("jupiter") || lower === "jup";
  }
  return lower.includes("phantom");
}

function discoverStandardWallets(): StandardWallet[] {
  const win = getWindow();
  if (!win) {
    return [];
  }

  const found: StandardWallet[] = [];
  const register = (wallet: StandardWallet) => {
    if (wallet && typeof wallet.name === "string") {
      found.push(wallet);
    }
  };

  win.dispatchEvent(
    new CustomEvent("wallet-standard:app-ready", {
      detail: { register },
    }),
  );

  return found;
}

function getStandardFeature<T>(wallet: StandardWallet, name: string): T | null {
  const feature = wallet.features[name];
  return feature ? (feature as T) : null;
}

async function connectStandard(id: WalletId): Promise<{ pubkey: string; wallet: StandardWallet; account: StandardAccount }> {
  const wallets = discoverStandardWallets();
  const wallet = wallets.find((item) => walletNameMatches(item.name, id));
  if (!wallet) {
    throw new Error(
      id === "jupiter"
        ? "Jupiter Wallet is not installed in this browser."
        : "Phantom is not installed in this browser.",
    );
  }

  const connectFeature = getStandardFeature<{ connect: () => Promise<{ accounts?: StandardAccount[] }> }>(
    wallet,
    "standard:connect",
  );
  if (!connectFeature?.connect) {
    throw new Error(`${wallet.name} does not support connect.`);
  }

  const result = await connectFeature.connect();
  const account = result.accounts?.[0] ?? wallet.accounts[0];
  if (!account?.address) {
    throw new Error(`${wallet.name} did not return an account.`);
  }

  return { pubkey: account.address, wallet, account };
}

async function signStandard(
  wallet: StandardWallet,
  account: StandardAccount,
  message: string,
): Promise<string> {
  const signFeature = getStandardFeature<{
    signMessage: (input: { account: StandardAccount; message: Uint8Array }[]) => Promise<
      Array<{ signature: Uint8Array }>
    >;
  }>(wallet, "solana:signMessage");

  if (!signFeature?.signMessage) {
    throw new Error(`${wallet.name} does not support message signing.`);
  }

  const signed = await signFeature.signMessage([
    { account, message: new TextEncoder().encode(message) },
  ]);
  const signature = signed[0]?.signature;
  if (!signature) {
    throw new Error(`${wallet.name} did not return a signature.`);
  }
  return bs58.encode(signature);
}

let standardSession: { id: WalletId; wallet: StandardWallet; account: StandardAccount } | null = null;

export function isWalletInjected(id: WalletId): boolean {
  if (getInjectedById(id)) {
    return true;
  }
  return discoverStandardWallets().some((wallet) => walletNameMatches(wallet.name, id));
}

export async function connectBrowserWallet(id: WalletId): Promise<{ pubkey: string }> {
  const injected = getInjectedById(id);
  if (injected) {
    const response = await injected.connect();
    const pubkey = pubkeyFromKey(response && "publicKey" in response ? response.publicKey : injected.publicKey);
    standardSession = null;
    return { pubkey };
  }

  const standard = await connectStandard(id);
  standardSession = { id, wallet: standard.wallet, account: standard.account };
  return { pubkey: standard.pubkey };
}

export async function signBrowserWallet(id: WalletId, message: string): Promise<string> {
  const injected = getInjectedById(id);
  if (injected) {
    const raw = await injected.signMessage(new TextEncoder().encode(message), "utf8");
    const bytes = toBytes(raw);
    return bs58.encode(bytes);
  }

  if (standardSession && standardSession.id === id) {
    return signStandard(standardSession.wallet, standardSession.account, message);
  }

  const standard = await connectStandard(id);
  standardSession = { id, wallet: standard.wallet, account: standard.account };
  return signStandard(standard.wallet, standard.account, message);
}

export async function openJupiterMobile(): Promise<void> {
  for (const url of JUPITER_OPEN_CANDIDATES) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // try the next candidate
    }
  }
  await Linking.openURL("https://jup.ag");
}

export function walletNeedsManualSiws(id: WalletId): boolean {
  if (id !== "jupiter") {
    return false;
  }
  if (Platform.OS !== "web") {
    return true;
  }
  return !isWalletInjected("jupiter");
}
