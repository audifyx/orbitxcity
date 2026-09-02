import { useEffect, useState, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { privyAppId, privyClientId } from "./env";
import { supabase } from "./supabase";

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
  const [supabaseLoading, setSupabaseLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().finally(() => {
      if (mounted) setSupabaseLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      if (mounted) setSupabaseLoading(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!privyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId || undefined}
      config={{
        customAuth: {
          isLoading: supabaseLoading,
          getCustomAccessToken: async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              console.warn("[OrbitX auth] Supabase token read failed", error.message);
              return undefined;
            }
            return data.session?.access_token;
          },
        },
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
