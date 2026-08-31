import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  useCreateWallet,
  useExportWallet,
  useSignMessage,
  useWallets,
} from "@privy-io/react-auth/solana";
import bs58 from "bs58";

import {
  formatPrivyOriginBlock,
  PRIVY_DOMAINS_DASHBOARD_URL,
  readPrivyDashboardStatus,
  REQUIRED_PRIVY_ORIGINS,
} from "../src/lib/privyDashboard";

const CHANNEL = "orbitx-privy-v1";
const RESULT_KEY = "orbitx-privy-result";
const ERROR_KEY = "orbitx-privy-error";
const DEFAULT_APP_ID = "cmtdqdoj0043z0dlabgpr7l6g";
const SUPABASE_URL = "https://ffjipnkhcebjvttliptb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2VianZ0dGxpcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjc5NDgsImV4cCI6MjA5MzEwMzk0OH0.aXu8bbpVVwc8KOJf1-lHqO3cz_0GZD10_TE0GlKQ1BI";

type HostFlow = "signin" | "export";

type HostParams = {
  appId: string;
  returnTo: string;
  flow: HostFlow;
};

function readParams(): HostParams {
  const search = new URLSearchParams(window.location.search);
  const flow = (search.get("flow") ?? "").trim().toLowerCase();
  return {
    appId: (search.get("appId") ?? DEFAULT_APP_ID).trim() || DEFAULT_APP_ID,
    returnTo: (search.get("return") ?? "").trim(),
    flow: flow === "export" ? "export" : "signin",
  };
}

function originBlockMessage(): string {
  return formatPrivyOriginBlock({
    allowedDomains: [],
    currentOrigin: window.location.origin,
    requiredOriginsMissing: [...REQUIRED_PRIVY_ORIGINS],
  });
}

function isOriginError(error: unknown): boolean {
  const rec =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = String(rec.privyErrorCode ?? rec.code ?? "");
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const lower = `${code} ${message}`.toLowerCase();
  return (
    code === "invalid_origin" ||
    lower.includes("invalid_origin") ||
    lower.includes("allowed origin") ||
    lower.includes("allowlisted") ||
    lower.includes("allow-listed")
  );
}

function isSafeHostReturn(value: string): boolean {
  if (!value || value.length > 2048) {
    return false;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      return false;
    }
    if (url.protocol === "orbitx:") {
      const path = `${url.host}${url.pathname}`.replace(/\/+$/, "");
      return path === "auth" || path === "/auth" || path.endsWith("/auth");
    }
    if (url.protocol === "exp:" || url.protocol === "exps:") {
      return url.href.includes("/auth");
    }
    if (url.protocol === "https:" || url.protocol === "http:") {
      return (
        url.origin === window.location.origin &&
        url.pathname.replace(/\/+$/, "") === "/auth"
      );
    }
  } catch {
    return false;
  }
  return false;
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
    throw new Error("OrbitX wallet did not return a valid signature.");
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

function finishInOpenerOrReturn(
  payload: Record<string, string>,
  returnTo: string,
): void {
  if (payload.pubkey && payload.signature && isSafeHostReturn(returnTo)) {
    const url = new URL(returnTo);
    url.searchParams.set("pubkey", payload.pubkey);
    url.searchParams.set("signature", payload.signature);
    window.location.replace(url.toString());
    return;
  }
  if (postToOpener(payload)) {
    window.close();
    return;
  }
  if (payload.type === "error") {
    window.sessionStorage.setItem(ERROR_KEY, payload.message ?? "Sign-in failed.");
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

function friendlyHostError(error: unknown): string {
  if (isOriginError(error)) {
    return originBlockMessage();
  }
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Sign-in failed.";
  const lower = message.toLowerCase();
  if (
    lower.includes("something went wrong") ||
    lower.includes("try again later")
  ) {
    return originBlockMessage();
  }
  if (
    lower.includes("declined") ||
    lower.includes("rejected") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return "Sign-in was cancelled. Use your email or phone and try again.";
  }
  if (lower.includes("invalid phone") || lower.includes("phone number")) {
    return "Enter a valid phone number, including country code.";
  }
  if (lower.includes("invalid email") || lower.includes("email")) {
    return "Enter a valid email address and try again.";
  }
  return message;
}

function isEmbeddedSolanaWallet(wallet: {
  address: string;
  walletClientType?: string;
  standardWallet?: { name?: string };
}): boolean {
  const client = (wallet.walletClientType ?? "").toLowerCase();
  const name = (wallet.standardWallet?.name ?? "").toLowerCase();
  return (
    client === "privy" ||
    name.includes("privy") ||
    name.includes("embedded")
  );
}

function HostApp({ params }: { params: HostParams }) {
  const { ready, authenticated, login, error: privyError } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signMessage } = useSignMessage();
  const [status, setStatus] = useState("Starting email or phone sign-in…");
  const [error, setError] = useState<string | null>(null);
  const loginOpened = useRef(false);
  const finishing = useRef(false);
  const walletsRef = useRef(wallets);
  const signMessageRef = useRef(signMessage);
  const createWalletRef = useRef(createWallet);
  walletsRef.current = wallets;
  signMessageRef.current = signMessage;
  createWalletRef.current = createWallet;

  const pickEmbedded = () => {
    const current = walletsRef.current;
    return (
      current.find((item) => isEmbeddedSolanaWallet(item) && isSolanaPubkey(item.address)) ??
      current.find((item) => isSolanaPubkey(item.address))
    );
  };

  const finishOrbitxSession = async (): Promise<void> => {
    if (finishing.current) {
      return;
    }
    finishing.current = true;
    setError(null);
    setStatus("Creating your OrbitX wallet…");

    try {
      const deadline = Date.now() + 45_000;
      let wallet = pickEmbedded();
      if (!wallet) {
        try {
          await createWalletRef.current();
        } catch (createError) {
          const text =
            createError instanceof Error ? createError.message.toLowerCase() : "";
          if (!text.includes("already")) {
            throw createError;
          }
        }
      }
      while (!wallet && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        wallet = pickEmbedded();
      }
      if (!wallet || !isSolanaPubkey(wallet.address)) {
        throw new Error("Could not create your OrbitX wallet. Try email or phone again.");
      }

      const pubkey = wallet.address.trim();
      setStatus("Approve the sign-in. This is not a transaction.");
      const nonceData = await walletAuth("nonce", { pubkey });
      const message = nonceData.message;
      if (typeof message !== "string") {
        throw new Error("wallet-auth nonce response is invalid.");
      }
      const signed = toBase58Signature(
        await signMessageRef.current({
          message: new TextEncoder().encode(message),
          wallet,
          options: {
            uiOptions: {
              title: "Sign in to OrbitX",
              description: "This signs you into OrbitX. It is not a transaction.",
            },
          },
        }),
      );
      finishInOpenerOrReturn({ type: "done", pubkey, signature: signed }, params.returnTo);
    } catch (finishError) {
      const message = friendlyHostError(finishError);
      setError(message);
      setStatus("");
      finishing.current = false;
    }
  };

  const openLogin = (): void => {
    setError(null);
    setStatus("Enter your email or phone. OrbitX will create your wallet.");
    try {
      login({
        loginMethods: ["email", "sms"],
      });
    } catch (loginError) {
      setError(friendlyHostError(loginError));
      setStatus("");
    }
  };

  useEffect(() => {
    postToOpener({ type: "ready" });
  }, []);

  useEffect(() => {
    if (privyError) {
      setError(friendlyHostError(privyError));
      setStatus("");
    }
  }, [privyError]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (authenticated) {
      void finishOrbitxSession();
      return;
    }
    if (loginOpened.current) {
      return;
    }
    loginOpened.current = true;
    openLogin();
  }, [authenticated, ready]);

  useEffect(() => {
    if (authenticated && walletsReady && !finishing.current && pickEmbedded()) {
      void finishOrbitxSession();
    }
  }, [authenticated, wallets, walletsReady]);

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
        gap: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600 }}>Sign in to OrbitX</div>
      <div style={{ color: "rgba(176, 198, 232, 0.72)", lineHeight: 1.5, maxWidth: 420, whiteSpace: "pre-wrap" }}>
        {error ??
          status ??
          "Use your email or phone. OrbitX creates an in-app wallet for this account."}
      </div>
      {ready && !finishing.current ? (
        <button
          type="button"
          onClick={openLogin}
          style={{
            minHeight: 48,
            minWidth: 220,
            border: 0,
            borderRadius: 14,
            background: "#7EB6FF",
            color: "#000",
            fontSize: 16,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Continue with email or phone
        </button>
      ) : null}
    </div>
  );
}

function ExportApp() {
  const { ready, authenticated, login, error: privyError } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const [status, setStatus] = useState(
    "Sign in to reveal your OrbitX wallet private key.",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loginOpened = useRef(false);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  const pickEmbedded = () => {
    const current = walletsRef.current;
    return (
      current.find(
        (item) => isEmbeddedSolanaWallet(item) && isSolanaPubkey(item.address),
      ) ?? current.find((item) => isSolanaPubkey(item.address))
    );
  };

  const openLogin = (): void => {
    setError(null);
    setStatus("Enter your email or phone to unlock export.");
    try {
      login({ loginMethods: ["email", "sms"] });
    } catch (loginError) {
      setError(friendlyHostError(loginError));
    }
  };

  const runExport = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Preparing your wallet…");
    try {
      let wallet = pickEmbedded();
      const deadline = Date.now() + 30_000;
      if (!wallet) {
        try {
          await createWallet();
        } catch (createError) {
          const text =
            createError instanceof Error
              ? createError.message.toLowerCase()
              : "";
          if (!text.includes("already")) {
            throw createError;
          }
        }
      }
      while (!wallet && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        wallet = pickEmbedded();
      }
      if (!wallet || !isSolanaPubkey(wallet.address)) {
        throw new Error("No OrbitX wallet found to export.");
      }
      setStatus("Opening Privy's secure export window…");
      await exportWallet({ address: wallet.address });
      setStatus(
        "Done. Your private key was shown in Privy's secure window. Never share it with anyone — OrbitX will never ask for it.",
      );
    } catch (exportError) {
      setError(friendlyHostError(exportError));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    postToOpener({ type: "ready" });
  }, []);

  useEffect(() => {
    if (privyError) {
      setError(friendlyHostError(privyError));
    }
  }, [privyError]);

  useEffect(() => {
    if (!ready || authenticated || loginOpened.current) {
      return;
    }
    loginOpened.current = true;
    openLogin();
  }, [ready, authenticated]);

  const canExport = ready && authenticated && walletsReady && !busy;

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
        gap: 16,
        textAlign: "center",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600 }}>Export OrbitX wallet</div>
      <div
        style={{
          color: "rgba(176, 198, 232, 0.72)",
          lineHeight: 1.5,
          maxWidth: 440,
          whiteSpace: "pre-wrap",
        }}
      >
        {error ?? status}
      </div>
      <div
        style={{
          color: "#E8C17A",
          fontSize: 13,
          lineHeight: 1.5,
          maxWidth: 440,
        }}
      >
        Your key loads inside Privy&apos;s isolated iframe. OrbitX never sees it.
        Anyone with this key controls your wallet.
      </div>
      {authenticated ? (
        <button
          type="button"
          onClick={() => void runExport()}
          disabled={!canExport}
          style={{
            minHeight: 48,
            minWidth: 240,
            border: 0,
            borderRadius: 14,
            background: canExport ? "#7EB6FF" : "rgba(126, 182, 255, 0.4)",
            color: "#000",
            fontSize: 16,
            fontWeight: 500,
            cursor: canExport ? "pointer" : "default",
          }}
        >
          {busy ? "Working…" : "Reveal private key"}
        </button>
      ) : ready ? (
        <button
          type="button"
          onClick={openLogin}
          style={{
            minHeight: 48,
            minWidth: 240,
            border: 0,
            borderRadius: 14,
            background: "#7EB6FF",
            color: "#000",
            fontSize: 16,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Continue with email or phone
        </button>
      ) : null}
    </div>
  );
}

function DashboardBlock({
  message,
  onRecheck,
}: {
  message: string;
  onRecheck: () => void;
}) {
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
        gap: 16,
        textAlign: "center",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600 }}>Privy origin is wrong</div>
      <div style={{ color: "rgba(176, 198, 232, 0.72)", lineHeight: 1.5, maxWidth: 460 }}>
        {message}
      </div>
      <div
        style={{
          color: "#f4f7ff",
          lineHeight: 1.7,
          maxWidth: 460,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
        }}
      >
        {REQUIRED_PRIVY_ORIGINS.map((origin) => (
          <div key={origin}>{origin}</div>
        ))}
      </div>
      <a
        href={PRIVY_DOMAINS_DASHBOARD_URL}
        target="_blank"
        rel="noreferrer"
        style={{
          minHeight: 48,
          minWidth: 220,
          borderRadius: 14,
          background: "#7EB6FF",
          color: "#000",
          fontSize: 16,
          fontWeight: 500,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
        }}
      >
        Open Privy Domains
      </a>
      <button
        type="button"
        onClick={onRecheck}
        style={{
          minHeight: 48,
          minWidth: 220,
          border: "1px solid rgba(126, 182, 255, 0.45)",
          borderRadius: 14,
          background: "transparent",
          color: "#7EB6FF",
          fontSize: 16,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        I added the HTTPS origins
      </button>
    </div>
  );
}

function Root() {
  const params = readParams();
  const [dashboardError, setDashboardError] = useState<string | null | undefined>(
    undefined,
  );

  const checkDashboard = (): void => {
    setDashboardError(undefined);
    void readPrivyDashboardStatus(params.appId, window.location.origin)
      .then((status) => {
        setDashboardError(status?.message ?? null);
      })
      .catch(() => {
        setDashboardError(null);
      });
  };

  useEffect(() => {
    checkDashboard();
  }, [params.appId]);

  if (!params.appId) {
    return (
      <div style={{ color: "#ff9a9a", padding: 28, fontFamily: "system-ui" }}>
        OrbitX is missing the Privy App ID on this build.
      </div>
    );
  }

  if (dashboardError) {
    return <DashboardBlock message={dashboardError} onRecheck={checkDashboard} />;
  }

  if (dashboardError === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          color: "rgba(176, 198, 232, 0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}
      >
        Checking Privy dashboard settings…
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={params.appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7EB6FF",
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "sms"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "all-users" },
        },
      }}
    >
      {params.flow === "export" ? <ExportApp /> : <HostApp params={params} />}
    </PrivyProvider>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("OrbitX sign-in host is missing #root.");
}

createRoot(root).render(<Root />);
