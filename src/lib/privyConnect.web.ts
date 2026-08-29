import { privyAppId, privyClientId } from "./env";
import { isSolanaPubkey, isSolanaSignature, type WalletId } from "./wallets";

const RESULT_KEY = "orbitx-privy-result";
const ERROR_KEY = "orbitx-privy-error";

type HostDone = { pubkey: string; signature: string };

export function isPrivyConfigured(): boolean {
  return privyAppId.length > 0;
}

export function consumePrivyHostResult(): HostDone | null {
  if (typeof window === "undefined") {
    return null;
  }

  const error = window.sessionStorage.getItem(ERROR_KEY);
  if (error) {
    window.sessionStorage.removeItem(ERROR_KEY);
    throw new Error(error);
  }

  const raw = window.sessionStorage.getItem(RESULT_KEY);
  if (!raw) {
    return null;
  }
  window.sessionStorage.removeItem(RESULT_KEY);

  const parsed = JSON.parse(raw) as { pubkey?: unknown; signature?: unknown };
  if (
    typeof parsed.pubkey !== "string" ||
    typeof parsed.signature !== "string" ||
    !isSolanaPubkey(parsed.pubkey) ||
    !isSolanaSignature(parsed.signature)
  ) {
    throw new Error("Wallet did not finish sign-in. Try Connect Wallet again.");
  }

  return { pubkey: parsed.pubkey, signature: parsed.signature };
}

function hostUrl(walletId: WalletId): string {
  const url = new URL("/privy-host.html", window.location.origin);
  url.searchParams.set("appId", privyAppId);
  url.searchParams.set("wallet", walletId);
  if (privyClientId) {
    url.searchParams.set("clientId", privyClientId);
  }
  return url.toString();
}

export async function connectWithPrivy(walletId: WalletId): Promise<HostDone> {
  if (!isPrivyConfigured()) {
    throw new Error(
      "OrbitX is missing the Privy App ID on this build. Set PRIVY_APP_ID or EXPO_PUBLIC_PRIVY_APP_ID on Vercel.",
    );
  }

  // Same tab only. Wallet extensions cannot connect from a popup, which is
  // what produced Privy's "Can't connect" error.
  window.location.assign(hostUrl(walletId));
  await new Promise<HostDone>(() => undefined);
  throw new Error("Opening wallet connect…");
}
