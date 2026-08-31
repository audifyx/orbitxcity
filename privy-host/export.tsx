import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useExportWallet, useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";

import {
  formatPrivyOriginBlock,
  PRIVY_DOMAINS_DASHBOARD_URL,
  readPrivyDashboardStatus,
  REQUIRED_PRIVY_ORIGINS,
} from "../src/lib/privyDashboard";

const DEFAULT_APP_ID = "cmtdqdoj0043z0dlabgpr7l6g";
const EXPORT_CHANNEL = "orbitx-export-v1";

type ExportParams = {
  appId: string;
  address: string;
};

function readParams(): ExportParams {
  const search = new URLSearchParams(window.location.search);
  return {
    appId: (search.get("appId") ?? DEFAULT_APP_ID).trim() || DEFAULT_APP_ID,
    address: (search.get("address") ?? "").trim(),
  };
}

function isSolanaPubkey(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

function postExportResult(message: {
  status: "success" | "error" | "closed";
  error?: string;
}): void {
  const payload = JSON.stringify({
    source: EXPORT_CHANNEL,
    status: message.status,
    error: message.error,
  });
  const webView = (
    window as Window & { ReactNativeWebView?: { postMessage: (value: string) => void } }
  ).ReactNativeWebView;
  if (webView && typeof webView.postMessage === "function") {
    webView.postMessage(payload);
  }
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

function ExportPage({ address }: { address: string }) {
  const { ready, authenticated, login, error: privyError } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { exportWallet } = useExportWallet();
  const [status, setStatus] = useState("Preparing Privy export…");
  const [error, setError] = useState<string | null>(null);
  const loginOpened = useRef(false);
  const exporting = useRef(false);

  const expected = address && isSolanaPubkey(address) ? address : "";

  const matchingWallet = useMemo(() => {
    const embedded = wallets.filter(isEmbeddedSolanaWallet);
    if (expected) {
      return (
        embedded.find((wallet) => wallet.address === expected) ??
        wallets.find((wallet) => wallet.address === expected)
      );
    }
    return embedded[0] ?? wallets[0];
  }, [expected, wallets]);

  const openLogin = useCallback(() => {
    setError(null);
    setStatus("Confirm the same email or phone. OrbitX never sees your key.");
    try {
      login({ loginMethods: ["email", "sms"] });
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Could not open Privy login.",
      );
      setStatus("");
    }
  }, [login]);

  const startExport = useCallback(async () => {
    if (exporting.current) {
      return;
    }
    if (!matchingWallet) {
      setError(
        expected
          ? "This login does not own the OrbitX wallet on this phone. Use the same email or phone."
          : "No Privy Solana wallet is attached to this login.",
      );
      setStatus("");
      return;
    }

    exporting.current = true;
    setError(null);
    setStatus("Privy is opening the secret-key window…");

    try {
      await exportWallet({ address: matchingWallet.address });
      postExportResult({ status: "success" });
      setStatus("Done. OrbitX never received your key.");
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Privy could not export this wallet.";
      setError(message);
      setStatus("");
      postExportResult({ status: "error", error: message });
    } finally {
      exporting.current = false;
    }
  }, [expected, exportWallet, matchingWallet]);

  useEffect(() => {
    if (privyError) {
      setError(privyError.message);
      setStatus("");
    }
  }, [privyError]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (authenticated) {
      return;
    }
    if (loginOpened.current) {
      return;
    }
    loginOpened.current = true;
    openLogin();
  }, [authenticated, openLogin, ready]);

  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || exporting.current) {
      return;
    }
    if (!matchingWallet) {
      setError(
        expected
          ? "This login does not own the OrbitX wallet on this phone. Use the same email or phone."
          : "No Privy Solana wallet is attached to this login.",
      );
      setStatus("");
      return;
    }
    void startExport();
  }, [authenticated, expected, matchingWallet, ready, startExport, walletsReady]);

  if (!ready) {
    return (
      <div style={styles.page}>
        <div style={styles.title}>Export wallet</div>
        <div style={styles.body}>Loading Privy…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.kicker}>PRIVY · USER-CONTROLLED</div>
      <div style={styles.title}>Export your secret key</div>
      <div style={styles.body}>
        {error ??
          status ??
          "Privy shows the key in its own window. OrbitX cannot read it."}
      </div>
      {expected ? (
        <div style={styles.address}>{expected}</div>
      ) : null}
      {!authenticated ? (
        <button type="button" onClick={openLogin} style={styles.primary}>
          Confirm email or phone
        </button>
      ) : (
        <button type="button" onClick={() => void startExport()} style={styles.primary}>
          Show key in Privy
        </button>
      )}
      <button
        type="button"
        onClick={() => postExportResult({ status: "closed" })}
        style={styles.ghost}
      >
        Close
      </button>
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
    <div style={styles.page}>
      <div style={styles.title}>Privy origin is wrong</div>
      <div style={styles.body}>{message}</div>
      <div style={styles.mono}>
        {REQUIRED_PRIVY_ORIGINS.map((origin) => (
          <div key={origin}>{origin}</div>
        ))}
      </div>
      <a href={PRIVY_DOMAINS_DASHBOARD_URL} target="_blank" rel="noreferrer" style={styles.primaryLink}>
        Open Privy Domains
      </a>
      <button type="button" onClick={onRecheck} style={styles.ghost}>
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
      <div style={{ ...styles.page, color: "#ff9a9a" }}>
        OrbitX is missing the Privy App ID on this build.
      </div>
    );
  }

  if (dashboardError) {
    return <DashboardBlock message={dashboardError} onRecheck={checkDashboard} />;
  }

  if (dashboardError === undefined) {
    return (
      <div style={styles.page}>
        <div style={styles.body}>Checking Privy dashboard settings…</div>
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
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <ExportPage address={params.address} />
    </PrivyProvider>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
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
    fontFamily: "Inter, system-ui, sans-serif",
  },
  kicker: {
    color: "#7EB6FF",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 500,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
  },
  body: {
    color: "rgba(176, 198, 232, 0.72)",
    lineHeight: 1.5,
    maxWidth: 420,
    whiteSpace: "pre-wrap",
  },
  address: {
    color: "#C9E3FF",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    wordBreak: "break-all",
    maxWidth: 420,
  },
  mono: {
    color: "#f4f7ff",
    lineHeight: 1.7,
    maxWidth: 460,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
  },
  primary: {
    minHeight: 48,
    minWidth: 220,
    border: 0,
    borderRadius: 14,
    background: "#7EB6FF",
    color: "#000",
    fontSize: 16,
    fontWeight: 500,
    cursor: "pointer",
  },
  primaryLink: {
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
  },
  ghost: {
    minHeight: 44,
    minWidth: 220,
    border: "1px solid rgba(126, 182, 255, 0.45)",
    borderRadius: 14,
    background: "transparent",
    color: "#7EB6FF",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
  },
};

const root = document.getElementById("root");
if (!root) {
  throw new Error("OrbitX export page is missing #root.");
}

createRoot(root).render(<Root />);
