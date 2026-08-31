import { Buffer } from "buffer";
import { Platform } from "react-native";
import bs58 from "bs58";

import { isInsideWalletBrowser } from "./walletOpen";

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

function viewToBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    const view = value;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return Uint8Array.from(value);
  }
  return null;
}

function decodeBase64Bytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(Buffer.from(normalized, "base64"));
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function decodeHexBytes(value: string): Uint8Array | null {
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  try {
    const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function decodeSignatureString(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const base58 = bs58.decode(trimmed);
    if (base58.length === 64) {
      return base58;
    }
  } catch {
    // Privy Expo returns base64, not base58.
  }
  const base64 = decodeBase64Bytes(trimmed);
  if (base64 && base64.length === 64) {
    return base64;
  }
  const hex = decodeHexBytes(trimmed);
  if (hex && hex.length === 64) {
    return hex;
  }
  return null;
}

export function toBase58Signature(value: unknown): string {
  const direct = viewToBytes(value);
  if (direct && direct.length === 64) {
    return bs58.encode(direct);
  }
  if (typeof value === "string") {
    const decoded = decodeSignatureString(value);
    if (decoded) {
      return bs58.encode(decoded);
    }
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (Array.isArray(rec.data) && rec.data.every((item) => typeof item === "number")) {
      const bytes = Uint8Array.from(rec.data);
      if (bytes.length === 64) {
        return bs58.encode(bytes);
      }
    }
    for (const key of ["signature", "sig", "data"] as const) {
      if (key in rec && rec[key] !== value) {
        try {
          return toBase58Signature(rec[key]);
        } catch {
          // Try the next wrapper field.
        }
      }
    }
  }
  throw new Error("OrbitX wallet did not return a valid signature.");
}

export function utf8ToBase64(value: string): string {
  return Buffer.from(new TextEncoder().encode(value)).toString("base64");
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

function isMwaWalletName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("mobile wallet adapter") || lower === "mwa";
}

function walletNameMatches(name: string, id: WalletId): boolean {
  const lower = name.toLowerCase();
  if (id === "jupiter") {
    return lower.includes("jupiter") || lower === "jup";
  }
  return lower.includes("phantom");
}

function isRetryableSignError(text: string): boolean {
  return (
    /invalid account/i.test(text) ||
    /publickey/i.test(text) ||
    /cannot read properties of undefined/i.test(text) ||
    /not connected/i.test(text)
  );
}

function decodeAddressBytes(address: string): Uint8Array | null {
  try {
    const decoded = bs58.decode(address.trim());
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Address may be base64 (Mobile Wallet Adapter).
  }

  try {
    const normalized = address.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes.length === 32) {
      return bytes;
    }
  } catch {
    // Not a 32-byte address.
  }

  return null;
}

function ensureAccountPublicKey(account: StandardAccount): StandardAccount {
  if (account.publicKey && account.publicKey.length === 32) {
    return account;
  }
  const bytes = decodeAddressBytes(account.address);
  if (bytes) {
    account.publicKey = bytes;
  }
  return account;
}

function readInjectedPubkey(injected: InjectedProvider): string | null {
  try {
    return injected.publicKey ? pubkeyFromKey(injected.publicKey) : null;
  } catch {
    return null;
  }
}

async function connectInjectedProvider(injected: InjectedProvider): Promise<string> {
  const existing = readInjectedPubkey(injected);
  if (existing) {
    return existing;
  }

  const response = await injected.connect();
  if (response && typeof response === "object" && response.publicKey) {
    return pubkeyFromKey(response.publicKey);
  }

  const afterConnect = readInjectedPubkey(injected);
  if (afterConnect) {
    return afterConnect;
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    await sleep(80);
    const pubkey = readInjectedPubkey(injected);
    if (pubkey) {
      return pubkey;
    }
  }

  throw new Error("Wallet did not return a public key. Approve the connect request and try again.");
}

async function signInjectedProvider(
  injected: InjectedProvider,
  message: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(message);

  const attempt = async (): Promise<string> => {
    const raw = await injected.signMessage(bytes, "utf8");
    return bs58.encode(toBytes(raw));
  };

  if (!readInjectedPubkey(injected)) {
    await connectInjectedProvider(injected);
  }
  if (!readInjectedPubkey(injected)) {
    throw new Error("Wallet connected but is not ready to sign. Approve again.");
  }

  try {
    return await attempt();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!isRetryableSignError(text)) {
      throw error instanceof Error ? error : new Error(text);
    }
    await connectInjectedProvider(injected);
    return attempt();
  }
}

const standardWallets = new Map<string, StandardWallet>();

function rememberStandardWallet(wallet: StandardWallet): void {
  if (wallet && typeof wallet.name === "string") {
    standardWallets.set(wallet.name, wallet);
  }
}

export function prepareWalletStandard(): void {
  ensureStandardListeners();
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

function findStandardWallet(id: WalletId, allowMwa: boolean): StandardWallet | null {
  const wallets = discoverStandardWallets();
  const named = wallets.find((item) => walletNameMatches(item.name, id));
  if (named) {
    return named;
  }
  if (!allowMwa) {
    return null;
  }
  return wallets.find((item) => isMwaWalletName(item.name)) ?? null;
}

function extractSignature(signed: unknown): Uint8Array | null {
  const source = Array.isArray(signed) ? signed[0] : signed;
  if (!source || typeof source !== "object" || !("signature" in source)) {
    return null;
  }
  try {
    return toBytes((source as { signature: unknown }).signature);
  } catch {
    return null;
  }
}

async function invokeSignMessage(
  wallet: StandardWallet,
  account: StandardAccount,
  message: Uint8Array,
): Promise<Uint8Array> {
  const signFeature = getStandardFeature<{
    signMessage: (...args: unknown[]) => Promise<unknown>;
  }>(wallet, "solana:signMessage");

  if (!signFeature?.signMessage) {
    throw new Error(`${wallet.name} does not support message signing.`);
  }

  const input = { account: ensureAccountPublicKey(account), message };
  // Mobile Wallet Adapter implements rest args (`signMessage(input)`), while
  // Phantom/Jupiter follow the Wallet Standard array form (`signMessage([input])`).
  const calls = isMwaWalletName(wallet.name)
    ? [() => signFeature.signMessage(input), () => signFeature.signMessage([input])]
    : [() => signFeature.signMessage([input]), () => signFeature.signMessage(input)];

  let lastError: Error | null = null;
  for (const call of calls) {
    try {
      const signature = extractSignature(await call());
      if (signature) {
        return signature;
      }
      lastError = new Error(`${wallet.name} did not return a signature.`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableSignError(lastError.message)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`${wallet.name} did not return a signature.`);
}

async function connectStandard(
  id: WalletId,
  options?: { allowMwa?: boolean },
): Promise<{ pubkey: string; wallet: StandardWallet; account: StandardAccount }> {
  const allowMwa = options?.allowMwa ?? !isInsideWalletBrowser(id);
  const wallet = findStandardWallet(id, allowMwa);
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
  if (!wallet.accounts[0]?.address) {
    const connectFeature = getStandardFeature<{ connect: () => Promise<unknown> }>(
      wallet,
      "standard:connect",
    );
    if (connectFeature?.connect) {
      await connectFeature.connect();
    }
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
      const signature = await invokeSignMessage(wallet, candidate, bytes);
      return bs58.encode(signature);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(text);
      if (!isRetryableSignError(text)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`${wallet.name} did not return a signature.`);
}

let standardSession: { id: WalletId; wallet: StandardWallet; account: StandardAccount } | null = null;

export function isMwaStandardAvailable(): boolean {
  if (isInsideWalletBrowser()) {
    return false;
  }
  return discoverStandardWallets().some((wallet) => isMwaWalletName(wallet.name));
}

export function isWalletInjected(id: WalletId): boolean {
  if (getInjectedById(id)) {
    return true;
  }
  return discoverStandardWallets().some(
    (wallet) => walletNameMatches(wallet.name, id) && !isMwaWalletName(wallet.name),
  );
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
    const pubkey = await connectInjectedProvider(injected);
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
    return signInjectedProvider(injected, message);
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
