# OrbitX City Content Agent — execution brief

You are the OrbitX City content-production agent. Work inside `audifyx/orbitxcity`.

## Objective

Create a safe, polished one-week marketing package: **25 X posts + 3 screenshots/images per post = 75 media assets**. The media must show the actual OrbitX City interface wherever possible, using a dedicated content-demo mode. Do not connect a real wallet, create a real authentication session, sign transactions, spend SOL, call a real trading execution endpoint, or expose credentials.

## Demo account requirements

Create a local deterministic identity:

`orbitx-content-demo`

It must have:
- auth provider: `none`
- session/JWT: `null`
- wallet provider: `mock`
- wallet address: `null`
- private key: never generated
- connected: `false`
- fictional balance only
- execution/network trades: disabled

The content-demo switch must be opt-in, e.g. `EXPO_PUBLIC_CONTENT_DEMO=true`, and the normal production path must remain unchanged when false.

## Mock data

Use obviously fictional symbols/data such as NOVA, ORBIT, CLAW and CITY. Use believable UI values for visual richness, but **always label the screenshots `CONTENT DEMO` or `MOCK DATA`**. Never imply the numbers are live performance, real P&L, real volume, real users, or executed trades.

## Screenshot production

Run the app locally with the content-demo flag. Capture clean, high-resolution screenshots from the actual app UI—not hand-drawn replicas—covering:

1. Market/intelligence dashboard
2. Agent tool terminal / tool calls
3. OrbitX City / world / social view

Produce three distinct media assets for every numbered post. Keep the visual language consistent: dark premium UI, restrained blue/ice accents, crisp typography, generous spacing, minimal clutter.

File naming:

`content-studio/assets/post-01-01.png` through `post-25-03.png`

Also create a contact sheet or index mapping every post to its three assets.

## Post sequence

Use `posts.json` and `weekly-plan.md`. The 25 posts are deliberately sequenced so the account tells one continuous product story: idea → intelligence → trading → agents → social → prediction/launching → City/world → safe demo → mobile → vision.

## X-ready copy

Keep each post in Unicode styling where useful, but do not turn every character into exotic Unicode. Preserve readability. Use strong hooks, short paragraphs, intentional whitespace, and 1–3 relevant hashtags. Avoid fake scarcity, fake traction, fake partnerships, fake user counts, fake revenue, fake trading results, and guaranteed-profit language.

## Final repository structure

`content-studio/`

- `README.md`
- `AGENT_BRIEF.md`
- `demo-account.json`
- `demo-data.json`
- `posts.json`
- `posts/post-01.md` … `post-25.md`
- `assets/post-01-01.png` … `post-25-03.png`
- `asset-index.md`
- `weekly-plan.md`

## Verification before commit

1. `npm install`
2. `EXPO_PUBLIC_CONTENT_DEMO=true npx expo start --web` (or the project’s normal preview command)
3. Confirm the demo screen works without login.
4. Confirm no wallet modal appears.
5. Confirm no transaction/signature can execute in demo mode.
6. Confirm all 75 images exist and open.
7. Confirm every post has exactly three images.
8. Confirm all demo screenshots visibly identify mock/demo data.
9. Run the project’s available TypeScript/lint/build checks.
10. Commit everything to `main` with a clear message such as `feat(content): add safe demo mode and 25-post OrbitX content pack`.

Do not overwrite unrelated product work. Preserve the existing OrbitX agent/tool-terminal changes.