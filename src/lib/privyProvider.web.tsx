import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";

import { privyAppId } from "./env";

type PrivyTreeComponent = (props: { children: ReactNode }) => ReactNode;

class PrivyErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Privy failed to start", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function OrbitxPrivyProvider({ children }: { children: ReactNode }) {
  const [Tree, setTree] = useState<PrivyTreeComponent | null>(null);

  useEffect(() => {
    if (!privyAppId) {
      return;
    }
    let cancelled = false;
    void import("./privyTree.web")
      .then((mod) => {
        if (!cancelled) {
          setTree(() => mod.PrivyTree);
        }
      })
      .catch((error: unknown) => {
        console.error("Privy failed to load", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Tree) {
    return <>{children}</>;
  }

  return (
    <PrivyErrorBoundary fallback={children}>
      <Tree>{children}</Tree>
    </PrivyErrorBoundary>
  );
}
