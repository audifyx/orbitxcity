export const REQUIRED_PRIVY_ORIGINS = [
  "https://orbitxcity.vercel.app",
  "https://ogscan.fun",
  "https://www.ogscan.fun",
] as const;

export const PRIVY_DOMAINS_DASHBOARD_URL =
  "https://dashboard.privy.io/apps?setting=domains&page=settings";

export type PrivyDashboardStatus = {
  allowedDomains: string[];
  emailAuth: boolean;
  smsAuth: boolean;
  solanaCreateOnLogin: string;
  currentOrigin: string;
  originAllowed: boolean;
  requiredOriginsMissing: string[];
  message: string | null;
};

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function isOriginListed(allowedDomains: string[], origin: string): boolean {
  const needle = normalizeOrigin(origin);
  return allowedDomains.some((item) => normalizeOrigin(item) === needle);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function formatPrivyOriginBlock(status: {
  allowedDomains: string[];
  currentOrigin: string;
  requiredOriginsMissing: string[];
}): string {
  const listed =
    status.allowedDomains.length > 0
      ? status.allowedDomains.join(", ")
      : "(none)";
  const needed = new Set<string>(
    status.requiredOriginsMissing.length > 0
      ? status.requiredOriginsMissing
      : [...REQUIRED_PRIVY_ORIGINS],
  );
  if (
    status.currentOrigin.startsWith("https://") &&
    !isOriginListed(status.allowedDomains, status.currentOrigin)
  ) {
    needed.add(status.currentOrigin);
  }
  const here = status.currentOrigin || "this page";
  return [
    `Privy blocked ${here}. Email and SMS are already on. Allowed origins are still ${listed}.`,
    `In the Orbitx app open Configuration → App settings → Domains → Web & mobile web and add these exact HTTPS origins: ${[...needed].join(", ")}.`,
    "HTTP, orbitx.world, and og-scan.fun (with the hyphen) do not match this site.",
  ].join(" ");
}

export async function readPrivyDashboardStatus(
  appId: string,
  currentOrigin = "",
): Promise<PrivyDashboardStatus | null> {
  const privyAppId = appId.trim();
  if (!privyAppId) {
    return null;
  }

  const response = await fetch(
    `https://auth.privy.io/api/v1/apps/${encodeURIComponent(privyAppId)}`,
    {
      cache: "no-store",
      headers: {
        "privy-app-id": privyAppId,
      },
    },
  );
  if (!response.ok) {
    return null;
  }

  const data = asRecord(await response.json());
  const allowedDomains = Array.isArray(data.allowed_domains)
    ? data.allowed_domains.filter((item): item is string => typeof item === "string")
    : [];
  const wallets = asRecord(data.embedded_wallet_config);
  const solana = asRecord(wallets.solana);
  const solanaCreateOnLogin =
    typeof solana.create_on_login === "string"
      ? solana.create_on_login
      : typeof wallets.create_on_login === "string"
        ? wallets.create_on_login
        : "off";
  const requiredOriginsMissing = REQUIRED_PRIVY_ORIGINS.filter(
    (origin) => !isOriginListed(allowedDomains, origin),
  );
  const originAllowed = currentOrigin
    ? isOriginListed(allowedDomains, currentOrigin)
    : isOriginListed(allowedDomains, "https://orbitxcity.vercel.app");
  const status: PrivyDashboardStatus = {
    allowedDomains,
    emailAuth: data.email_auth === true,
    smsAuth: data.sms_auth === true,
    solanaCreateOnLogin,
    currentOrigin,
    originAllowed,
    requiredOriginsMissing,
    message: null,
  };

  if (!originAllowed) {
    status.message = formatPrivyOriginBlock(status);
  }

  return status;
}
