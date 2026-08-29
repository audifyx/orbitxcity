import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, useConnectWallet, usePrivy } from "@privy-io/react-auth";
import {
  toSolanaWalletConnectors,
  useSignMessage,
  useWallets,
} from "@privy-io/react-auth/solana";
import bs58 from "bs58";

const CHANNEL = "orbitx-privy-v1";
const RESULT_KEY = "orbitx-privy-result";
const ERROR_KEY = "orbitx-privy-error";
const SUPABASE_URL = "https://ffjipnkhcebjvttliptb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2VianZ0dGxpcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjc5NDgsImV4cCI6MjA5MzEwMzk0OH0.aXu8bbpVVwc8KOJf1-lHqO3cz_0GZD10_TE0GlKQ1BI";

type WalletId = "phantom" | "jupiter";

type HostParams = {
  appId: string;
  clientId: string;
  walletId: WalletId;
};

function readParams(): HostParams {
  const search = new URLSearchParams(window.location.search);
  const wallet = search.get("wallet");
  return {
    appId: (search.get("appId") ?? "").trim(),
    clientId: (search.get("clientId") ?? "").trim(),
    walletId: wallet === "jupiter" ? "jupiter" : "phantom",
  };
}

function isSolanaPubkey(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

function isSolanaSignature(value: string): boolean {
  try {
    return bs58.decode(value).length === 64;
  } catch {
    return false;
  }
}

function toBase58Signature(result: { signature: Uint8Array } | Uint8Array): string {
  const bytes = result instanceof Uint8Array ? result : result.signature;
  const encoded = bs58.encode(bytes);
  if (!isSolanaSignature(encoded)) {
    throw new Error("Wallet did not return a valid signature.");
  }
  return encoded;
}

function postToOpener(payload: Record<string, unknown>): boolean {
  if (!window.opener || window.opener.closed) {
    return false;
  }
  window.opener.postMessage({ source: CHANNEL, ...payload }, window.location.origin);
  return true;
}

function finishInOpenerOrReturn(payload: Record<string, string>): void {
  if (postToOpener(payload)) {
    window.close();
    return;
  }
  if (payload.type === "error") {
    window.sessionStorage.setItem(ERROR_KEY, payload.message ?? "Wallet connection failed.");
    window.sessionStorage.removeItem(RESULT_KEY);
  } else if (payload.pubkey && payload.signature) {
    window.sessionStorage.setItem(
      RESULT_KEY,
      JSON.stringify({ pubkey: payload.pubkey, signature: payload.signature }),
    );
    window.sessionStorage.removeItem(ERROR_KEY);
  }
  window.location.replace("/connect");
}

async function walletAuth(
  action: "nonce" | "verify",
  payload: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-auth`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `wallet-auth ${action} failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function walletNameMatches(name: string, walletId: WalletId): boolean {
  const lower = name.toLowerCase();
  if (walletId === "phantom") {
    return lower.includes("phantom");
  }
  return lower.includes("jupiter") || lower.includes("jup");
}

function HostApp({ params }: { params: HostParams }) {
  const { ready } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets, ready: walletsReady } = useWallets();
  const { signMessage } = useSignMessage();
  const [status, setStatus] = useState("Starting wallet connect…");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  useEffect(() => {
    postToOpener({ type: "ready" });
  }, []);

  useEffect(() => {
    if (!ready || !walletsReady || started.current) {
      return;
    }
    started.current = true;

    const pickWallet = () =>
      walletsRef.current.find((wallet) =>
        walletNameMatches(wallet.standardWallet?.name ?? "", params.walletId),
      ) ?? walletsRef.current.find((wallet) => isSolanaPubkey(wallet.address));

    void (async () => {
      try {
        let wallet = pickWallet();
        if (!wallet) {
          setStatus(
            params.walletId === "jupiter"
              ? "Opening Jupiter… approve connect, then sign. This is not a transaction."
              : "Opening Phantom… approve connect, then sign. This is not a transaction.",
          );
          await connectWallet({
            description: "Connect to OrbitX. This request will not send a transaction.",
            walletList: [params.walletId],
            walletChainType: "solana-only",
          });
        }

        const deadline = Date.now() + 90_000;
        while (!wallet && Date.now() < deadline) {
          wallet = pickWallet();
          if (!wallet) {
            await new Promise((resolve) => window.setTimeout(resolve, 80));
          }
        }

        if (!wallet || !isSolanaPubkey(wallet.address)) {
          throw new Error("Wallet did not connect. Pick Phantom or Jupiter and approve.");
        }

        const pubkey = wallet.address.trim();
        setStatus("Connected. Approve the sign-in. This is not a transaction.");

        const nonceData = await walletAuth("nonce", { pubkey });
        const message = nonceData.message;
        if (typeof message !== "string") {
          throw new Error("wallet-auth nonce response is invalid.");
        }
        const signed = toBase58Signature(
          await signMessage({
            message: new TextEncoder().encode(message),
            wallet,
          }),
        );
        finishInOpenerOrReturn({ type: "done", pubkey, signature: signed });
      } catch (connectError) {
        const message =
          connectError instanceof Error
            ? connectError.message
            : "Wallet connection failed.";
        setError(message);
        setStatus("");
        finishInOpenerOrReturn({ type: "error", message });
      }
    })();
  }, [connectWallet, params.walletId, ready, signMessage, walletsReady]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#f4f7ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600 }}>OrbitX</div>
      <div style={{ color: "rgba(176, 198, 232, 0.72)", lineHeight: 1.5, maxWidth: 360 }}>
        {error ?? status}
      </div>
    </div>
  );
}

function Root() {
  const params = readParams();
  if (!params.appId) {
    return (
      <div style={{ color: "#ff9a9a", padding: 28, fontFamily: "system-ui" }}>
        OrbitX is missing the Privy App ID on this build.
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={params.appId}
      {...(params.clientId ? { clientId: params.clientId } : {})}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7EB6FF",
          walletChainType: "solana-only",
          walletList: ["phantom", "jupiter"],
          showWalletLoginFirst: true,
        },
        loginMethods: ["wallet"],
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
      }}
    >
      <HostApp params={params} />
    </PrivyProvider>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("OrbitX wallet host is missing #root.");
}

createRoot(root).render(<Root />);
