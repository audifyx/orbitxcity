# How the images were produced

The 75 images in `assets/` are captured from the **real OrbitX UI components**
(the same code that ships in the app) rendered with the `orbitx-content-demo`
mock data — not hand-drawn mockups.

Pipeline:

1. A React harness renders each OrbitX surface inside a phone frame with a
   `CONTENT DEMO · MOCK DATA` badge and the post caption.
2. Scenes reuse the shipping components: `PortfolioView`, `ProfileView`,
   `SettingsView`, `ToolTerminal`, `TokenCard`, `WalletCard`, `TxPreview`,
   `AlertCard`, `AgentCard`, `EmptyHome`, `MessageList`, `Composer`, the
   `ContentDemoScreen`, plus the `SKILLS` registry — bundled for web via
   `react-native-web`.
3. Headless Chrome screenshots each scene at 2× into
   `assets/post-NN-0M.png`.

To change the imagery, edit the scene mapping in `posts.source.json`
(`assets: [interface, agent, feature]` per post) and re-render.

Mock data only: fictional symbols (NOVA, ORBIT, CLAW, CITY), fictional
balances, no wallet, no auth, no signatures, no network trades.
