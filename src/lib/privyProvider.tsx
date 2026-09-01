import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/expo";

import { privyAppId, privyClientId } from "./env";

/**
 * Native Privy provider — wraps the app so screens can use Privy's real
 * React Native hooks (useLoginWithEmail, useLoginWithSMS,
 * useEmbeddedSolanaWallet, etc.) for true in-app authentication, instead of
 * redirecting out to the hosted ogscan.fun browser page. Wallet export still
 * intentionally uses that hosted page — this only covers login.
 */
export function OrbitxPrivyProvider({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    return <>{children}</>;
  }
  return (
    <PrivyProvider appId={privyAppId} clientId={privyClientId || undefined}>
      {children}
    </PrivyProvider>
  );
}
