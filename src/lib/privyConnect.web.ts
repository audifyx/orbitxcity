import { isSafeAppReturn, privyHostUrl } from "./hostedAuth";
import { privyAppId } from "./env";
import { isSolanaPubkey, isSolanaSignature } from "./wallets";

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
    throw new Error("Sign-in did not finish. Use your email or phone again.");
  }

  return { pubkey: parsed.pubkey, signature: parsed.signature };
}

function currentReturnParam(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("return") ?? "";
}

export async function connectWithPrivy(): Promise<HostDone> {
  if (!isPrivyConfigured()) {
    throw new Error(
      "OrbitX is missing the Privy App ID on this build. Set PRIVY_APP_ID or EXPO_PUBLIC_PRIVY_APP_ID on Vercel.",
    );
  }

  const returnTo = currentReturnParam();
  const url = privyHostUrl(
    returnTo && isSafeAppReturn(returnTo) ? returnTo : undefined,
  );

  window.location.assign(url);
  await new Promise<HostDone>(() => undefined);
  throw new Error("Opening email or phone sign-in…");
}
