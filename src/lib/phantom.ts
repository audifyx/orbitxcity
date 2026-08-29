import { Buffer } from "buffer";
import { publicAppUrl } from "./env";
import bs58 from "bs58";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import nacl from "tweetnacl";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

const DAPP_SECRET_KEY = "orbitx.phantom.dapp.secret";
const DAPP_PUBLIC_KEY = "orbitx.phantom.dapp.public";
const PHANTOM_REMOTE_PK_KEY = "orbitx.phantom.remote.pk";
const PHANTOM_SESSION_KEY = "orbitx.phantom.session";
export const WALLET_PUBKEY_KEY = "orbitx.wallet.pubkey";

const PHANTOM_UL_CONNECT = "https://phantom.app/ul/v1/connect";
const PHANTOM_UL_SIGN_MESSAGE = "https://phantom.app/ul/v1/signMessage";
const APP_URL = publicAppUrl;
const CLUSTER = "mainnet-beta";

function redirectLink(path: string): string {
  if (Platform.OS === "web") {
    const base = APP_URL.replace(/\/$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return Linking.createURL(path);
}

interface PhantomPublicKey {
  toString(): string;
  toBase58(): string;
}

interface PhantomSolanaProvider {
  isPhantom?: boolean;
  publicKey: PhantomPublicKey | null;
  connect(): Promise<{ publicKey: PhantomPublicKey }>;
  signMessage(
    message: Uint8Array,
    display?: "utf8" | "hex",
  ): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?: (
    transaction: unknown,
  ) => Promise<{ signature: string } | string>;
}

interface PhantomWindow extends Window {
  phantom?: { solana?: PhantomSolanaProvider };
  solana?: PhantomSolanaProvider;
}

interface ConnectPayload {
  public_key: string;
  session: string;
}

interface SignMessagePayload {
  signature: string;
}

function getInjectedProvider(): PhantomSolanaProvider | null {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  const phantomWindow = window as PhantomWindow;
  return phantomWindow.phantom?.solana ?? phantomWindow.solana ?? null;
}

async function getOrCreateDappKeyPair(): Promise<nacl.BoxKeyPair> {
  const existingSecret = await SecureStore.getItemAsync(DAPP_SECRET_KEY);
  const existingPublic = await SecureStore.getItemAsync(DAPP_PUBLIC_KEY);

  if (existingSecret && existingPublic) {
    return {
      secretKey: bs58.decode(existingSecret),
      publicKey: bs58.decode(existingPublic),
    };
  }

  const keyPair = nacl.box.keyPair();
  await SecureStore.setItemAsync(DAPP_SECRET_KEY, bs58.encode(keyPair.secretKey));
  await SecureStore.setItemAsync(DAPP_PUBLIC_KEY, bs58.encode(keyPair.publicKey));
  return keyPair;
}

async function getDappKeyPair(): Promise<nacl.BoxKeyPair> {
  const secret = await SecureStore.getItemAsync(DAPP_SECRET_KEY);
  const publicKey = await SecureStore.getItemAsync(DAPP_PUBLIC_KEY);

  if (!secret || !publicKey) {
    throw new Error("Phantom dapp encryption keys are missing. Connect again.");
  }

  return {
    secretKey: bs58.decode(secret),
    publicKey: bs58.decode(publicKey),
  };
}

function parseRedirectParams(url: string): URLSearchParams {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("data") || parsed.searchParams.get("errorCode")) {
      return parsed.searchParams;
    }
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    if (hash.includes("=")) {
      return new URLSearchParams(hash);
    }
  } catch {
    // Expo Go sometimes hands back a non-standard deep link.
  }
  const query = url.split("?")[1] ?? url.split("#")[1] ?? "";
  return new URLSearchParams(query);
}

function assertNoPhantomError(params: URLSearchParams): void {
  const errorCode = params.get("errorCode");
  if (errorCode) {
    throw new Error(
      params.get("errorMessage") ??
        `Phantom request failed (${errorCode})`,
    );
  }
}

function decryptPhantomPayload(
  data: string,
  nonce: string,
  phantomPk: Uint8Array,
  dappSecret: Uint8Array,
): Uint8Array {
  const decrypted = nacl.box.open(
    bs58.decode(data),
    bs58.decode(nonce),
    phantomPk,
    dappSecret,
  );

  if (!decrypted) {
    throw new Error("Unable to decrypt Phantom response.");
  }

  return decrypted;
}

export function isPhantomInjected(): boolean {
  return getInjectedProvider() !== null;
}

export function getInjectedPhantom(): PhantomSolanaProvider | null {
  return getInjectedProvider();
}

export async function connectInjected(): Promise<{ pubkey: string }> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("Phantom not found. Install Phantom and try again.");
  }

  const response = await provider.connect();
  const pubkey =
    response.publicKey.toBase58?.() ?? response.publicKey.toString();

  if (!pubkey) {
    throw new Error("Phantom did not return a public key.");
  }

  return { pubkey };
}

export async function signInjected(message: string): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("Phantom not found. Install Phantom and try again.");
  }

  const messageBytes = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(messageBytes, "utf8");
  return bs58.encode(signature);
}

export async function startNativeConnect(): Promise<void> {
  const dappKeyPair = await getOrCreateDappKeyPair();

  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
    cluster: CLUSTER,
    app_url: APP_URL,
    redirect_link: redirectLink("/onconnect"),
  });

  await Linking.openURL(`${PHANTOM_UL_CONNECT}?${params.toString()}`);
}

export async function handleNativeConnectRedirect(
  url: string,
): Promise<{ pubkey: string; session: string }> {
  const params = parseRedirectParams(url);
  assertNoPhantomError(params);

  const data = params.get("data");
  const nonce = params.get("nonce");
  const phantomEncryptionPublicKey = params.get("phantom_encryption_public_key");

  if (!data || !nonce || !phantomEncryptionPublicKey) {
    throw new Error("Invalid Phantom connect redirect.");
  }

  const dappKeyPair = await getDappKeyPair();
  const decrypted = decryptPhantomPayload(
    data,
    nonce,
    bs58.decode(phantomEncryptionPublicKey),
    dappKeyPair.secretKey,
  );

  const connectData = JSON.parse(
    Buffer.from(decrypted).toString("utf8"),
  ) as ConnectPayload;

  if (!connectData.public_key || !connectData.session) {
    throw new Error("Phantom connect response is missing wallet data.");
  }

  await SecureStore.setItemAsync(
    PHANTOM_REMOTE_PK_KEY,
    phantomEncryptionPublicKey,
  );
  await SecureStore.setItemAsync(PHANTOM_SESSION_KEY, connectData.session);
  await SecureStore.setItemAsync(WALLET_PUBKEY_KEY, connectData.public_key);

  return {
    pubkey: connectData.public_key,
    session: connectData.session,
  };
}

export async function startNativeSign(message: string): Promise<void> {
  const session = await SecureStore.getItemAsync(PHANTOM_SESSION_KEY);
  const phantomRemotePk = await SecureStore.getItemAsync(PHANTOM_REMOTE_PK_KEY);

  if (!session || !phantomRemotePk) {
    throw new Error("Phantom session is missing. Connect your wallet first.");
  }

  const dappKeyPair = await getDappKeyPair();
  const messageBytes = new TextEncoder().encode(message);
  const payload = {
    session,
    message: bs58.encode(messageBytes),
    display: "utf8" as const,
  };

  const nonce = nacl.randomBytes(24);
  const encryptedPayload = nacl.box(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    bs58.decode(phantomRemotePk),
    dappKeyPair.secretKey,
  );

  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
    nonce: bs58.encode(nonce),
    redirect_link: redirectLink("/onsign"),
    payload: bs58.encode(encryptedPayload),
  });

  await Linking.openURL(`${PHANTOM_UL_SIGN_MESSAGE}?${params.toString()}`);
}

export async function handleNativeSignRedirect(
  url: string,
): Promise<{ signature: string }> {
  const params = parseRedirectParams(url);
  assertNoPhantomError(params);

  const data = params.get("data");
  const nonce = params.get("nonce");
  const phantomRemotePk = await SecureStore.getItemAsync(PHANTOM_REMOTE_PK_KEY);

  if (!data || !nonce || !phantomRemotePk) {
    throw new Error("Invalid Phantom sign redirect.");
  }

  const dappKeyPair = await getDappKeyPair();
  const decrypted = decryptPhantomPayload(
    data,
    nonce,
    bs58.decode(phantomRemotePk),
    dappKeyPair.secretKey,
  );

  const signData = JSON.parse(
    Buffer.from(decrypted).toString("utf8"),
  ) as SignMessagePayload;

  if (!signData.signature) {
    throw new Error("Phantom did not return a signature.");
  }

  return { signature: signData.signature };
}

export async function clearPhantomSecureStore(): Promise<void> {
  const keys = [
    DAPP_SECRET_KEY,
    DAPP_PUBLIC_KEY,
    PHANTOM_REMOTE_PK_KEY,
    PHANTOM_SESSION_KEY,
    WALLET_PUBKEY_KEY,
  ];

  await Promise.all(
    keys.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // SecureStore may be unavailable on web; ignore cleanup failures there.
      }
    }),
  );
}
