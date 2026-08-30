import { useEffect, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/expo";

import { privyAppId, privyClientId } from "./env";

let logoutPrivyImpl: (() => Promise<void>) | null = null;

export async function logoutPrivySession(): Promise<void> {
  if (!logoutPrivyImpl) {
    return;
  }
  await logoutPrivyImpl();
}

function PrivySessionBinder({ children }: { children: ReactNode }) {
  const { logout } = usePrivy();

  useEffect(() => {
    logoutPrivyImpl = logout;
    return () => {
      if (logoutPrivyImpl === logout) {
        logoutPrivyImpl = null;
      }
    };
  }, [logout]);

  return <>{children}</>;
}

export function OrbitxPrivyProvider({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId || undefined}
      config={{
        embedded: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "all-users" },
        },
      }}
    >
      <PrivySessionBinder>{children}</PrivySessionBinder>
    </PrivyProvider>
  );
}
