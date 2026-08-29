import { privyAppId, privyClientId } from "./env";
import { isSolanaPubkey, isSolanaSignature, type WalletId } from "./wallets";

const CHANNEL = "orbitx-privy-v1";
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

function waitForPopupResult(popup: Window): Promise<HostDone> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedWatch);
      window.clearTimeout(timeout);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      if (!popup.closed) {
        popup.close();
      }
      reject(new Error("Wallet connect timed out. Try again."));
    }, 120_000);

    const closedWatch = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Wallet connect was cancelled."));
      }
    }, 400);

    function onMessage(event: MessageEvent<{ source?: string; type?: string; pubkey?: string; signature?: string; message?: string; address?: string }>) {
      if (event.origin !== window.location.origin || event.data?.source !== CHANNEL) {
        return;
      }

      if (event.data.type === "connected" && event.data.address && isSolanaPubkey(event.data.address)) {
        return;
      }

      if (event.data.type === "done" && event.data.pubkey && event.data.signature) {
        if (!isSolanaPubkey(event.data.pubkey) || !isSolanaSignature(event.data.signature)) {
          cleanup();
          reject(new Error("Wallet did not return a valid sign-in."));
          return;
        }
        cleanup();
        if (!popup.closed) {
          popup.close();
        }
        resolve({ pubkey: event.data.pubkey, signature: event.data.signature });
        return;
      }

      if (event.data.type === "error") {
        cleanup();
        if (!popup.closed) {
          popup.close();
        }
        reject(new Error(event.data.message || "Wallet connection failed."));
      }
    }

    window.addEventListener("message", onMessage);
  });
}

export async function connectWithPrivy(walletId: WalletId): Promise<HostDone> {
  if (!isPrivyConfigured()) {
    throw new Error(
      "OrbitX is missing the Privy App ID on this build. Set PRIVY_APP_ID or EXPO_PUBLIC_PRIVY_APP_ID on Vercel.",
    );
  }

  const url = hostUrl(walletId);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile) {
    const popup = window.open(url, "orbitx-privy", "popup,width=420,height=740");
    if (popup) {
      popup.focus();
      return waitForPopupResult(popup);
    }
  }

  window.location.assign(url);
  await new Promise<HostDone>(() => undefined);
  throw new Error("Opening wallet connect…");
}
