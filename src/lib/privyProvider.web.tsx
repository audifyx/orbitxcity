import { useEffect, type ReactNode } from "react";
import { PrivyProvider, useConnectWallet, usePrivy } from "@privy-io/react-auth";
import {
  toSolanaWalletConnectors,
  useSignMessage,
  useWallets,
} from "@privy-io/react-auth/solana";

import { privyAppId, privyClientId } from "./env";
import { registerPrivyRuntime } from "./privyConnect.web";

function PrivyConnectBridge() {
  const { ready } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets, ready: walletsReady } = useWallets();
  const { signMessage } = useSignMessage();

  useEffect(() => {
    registerPrivyRuntime({
      ready: ready && walletsReady,
      connectWallet: (opts) => {
        void connectWallet({
          description: opts.description,
          walletList: opts.walletList,
          walletChainType: "solana-only",
        });
      },
      wallets: wallets.map((wallet) => ({
        address: wallet.address,
        standardWallet: wallet.standardWallet
          ? { name: wallet.standardWallet.name }
          : undefined,
      })),
      signMessage: async ({ message, wallet }) => {
        const match =
          wallets.find((item) => item.address === wallet.address) ?? wallets[0];
        if (!match) {
          throw new Error("Connect a wallet first.");
        }
        return signMessage({ message, wallet: match });
      },
    });

    return () => {
      registerPrivyRuntime(null);
    };
  }, [connectWallet, ready, signMessage, wallets, walletsReady]);

  return null;
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
        appearance: {
          theme: "dark",
          accentColor: "#7EB6FF",
          walletChainType: "solana-only",
          walletList: ["phantom", "jupiter"],
          showWalletLoginFirst: true,
        },
        loginMethods: ["wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
      }}
    >
      <PrivyConnectBridge />
      {children}
    </PrivyProvider>
  );
}
