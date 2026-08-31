import { useEffect, useState } from "react";

import { useAuth } from "./auth";
import { usePrivyAuthState } from "./privyProvider";

export function useUnlockedSession(): { unlocked: boolean; waiting: boolean } {
  const { signedIn, loading } = useAuth();
  const privy = usePrivyAuthState();
  const [privyWaitExpired, setPrivyWaitExpired] = useState(false);

  useEffect(() => {
    if (!privy.configured || privy.ready || privyWaitExpired) {
      return;
    }
    const timeout = setTimeout(() => setPrivyWaitExpired(true), 8000);
    return () => clearTimeout(timeout);
  }, [privy.configured, privy.ready, privyWaitExpired]);

  const waiting =
    loading || (privy.configured && !privy.ready && !privyWaitExpired);
  const unlocked =
    signedIn &&
    (!privy.configured ||
      privy.authenticated ||
      (!privy.ready && !privyWaitExpired));
  return { unlocked, waiting };
}
