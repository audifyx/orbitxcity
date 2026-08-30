import type { ReactNode } from "react";

export async function logoutPrivySession(): Promise<void> {
  return;
}

export function OrbitxPrivyProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
