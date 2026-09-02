# Jupiter Wallet integration findings

## Official sources

1. Jupiter Wallet Kit: https://dev.jup.ag/docs/tool-kits/wallet-kit
2. Jupiter Mobile wallet management and auto-approve: https://docs.jup.ag/user-docs/global/mobile/managing-wallets
3. Solana Mobile Expo setup: https://docs.solanamobile.com/react-native/expo

## Findings

Jupiter Wallet Kit supports Wallet Standard, a mobile-friendly connector, 20+ wallet adapters, and Jupiter Mobile Adapter QR connectivity. The official Wallet Kit page identifies `@jup-ag/jup-mobile-adapter` for Jupiter Mobile adapter integration and `@jup-ag/wallet-adapter` for the Jupiter Wallet extension path.

Jupiter Mobile is self-custodial. Its official documentation says auto-approve can sign transactions on selected sites without showing a confirmation prompt each time, and lists Jupiter and Meteora as supported sites. Auto-approve is configured in Jupiter Mobile under Settings → Security & Privacy → Signing & Permissions. This is a wallet-side permission and is not something OrbitX can silently enable.

The Solana Mobile Expo documentation says Mobile Wallet Adapter requires native dependencies and a custom development build rather than Expo Go. The documented dependencies include `@solana-mobile/mobile-wallet-adapter-protocol` and `@solana-mobile/mobile-wallet-adapter-protocol-web3js`.

The OrbitX repository now has those MWA packages installed and a native helper using `transact`, `authorize`, and `signAndSendTransactions`. Supabase remains the account/session authority; external Jupiter Wallet remains the signing authority.
