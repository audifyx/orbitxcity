import { Platform } from "react-native";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const standardWallets = new Map<string, StandardWallet>();

function rememberStandardWallet(wallet: StandardWallet): void {
  if (wallet && typeof wallet.name === "string") {
    standardWallets.set(wallet.name, wallet);
  }
}

function ensureStandardListeners(): void {
  const win = getWindow();
  if (!win) {
    return;
  }
  const flagged = win as JupiterWindow & { __orbitxWalletStandard?: boolean };
  if (flagged.__orbitxWalletStandard) {
    return;
  }
  flagged.__orbitxWalletStandard = true;

  win.addEventListener("wallet-standard:register-wallet", ((event: Event) => {
    const detail = (event as CustomEvent<(api: { register: (wallet: StandardWallet) => void }) => void>)
      .detail;
    if (typeof detail === "function") {
      detail({ register: rememberStandardWallet });
    }
  }) as EventListener);

  win.dispatchEvent(
    new CustomEvent("wallet-standard:app-ready", {
      detail: { register: rememberStandardWallet },
    }),
  );
}

function discoverStandardWallets(): StandardWallet[] {
  ensureStandardListeners();
  return [...standardWallets.values()];
}

function liveAccount(wallet: StandardWallet, address?: string): StandardAccount {
  const match = address
    ? wallet.accounts.find((item) => item.address === address)
    : undefined;
  const account = match ?? wallet.accounts[0];
  if (!account?.address) {
    throw new Error(`${wallet.name} did not return an account.`);
  }
  return account;
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
        ? "JUPITER_SIWS_REQUIRED"
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
  const address = result.accounts?.[0]?.address ?? wallet.accounts[0]?.address;
  const account = liveAccount(wallet, address);

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

  const bytes = new TextEncoder().encode(message);
  const preferred = liveAccount(wallet, account.address);
  const candidates = [
    preferred,
    ...wallet.accounts.filter((item) => item !== preferred),
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const signed = await signFeature.signMessage([
        { account: candidate, message: bytes },
      ]);
      const signature = signed[0]?.signature;
      if (!signature) {
        throw new Error(`${wallet.name} did not return a signature.`);
      }
      return bs58.encode(signature);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(text);
      if (!/invalid account/i.test(text)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`${wallet.name} did not return a signature.`);
}

let standardSession: { id: WalletId; wallet: StandardWallet; account: StandardAccount } | null = null;

export function isWalletInjected(id: WalletId): boolean {
  if (getInjectedById(id)) {
    return true;
  }
  return discoverStandardWallets().some((wallet) => walletNameMatches(wallet.name, id));
}

export async function waitForWallet(id: WalletId, timeoutMs = 2500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  ensureStandardListeners();
  while (Date.now() < deadline) {
    if (isWalletInjected(id)) {
      return true;
    }
    await sleep(80);
  }
  return isWalletInjected(id);
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
  const { openWalletInAppBrowser } = await import("./walletOpen");
  await openWalletInAppBrowser("jupiter");
}

export function walletNeedsManualSiws(id: WalletId): boolean {
  void id;
  return false;
}
