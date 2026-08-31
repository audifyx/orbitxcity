# OrbitX — Content Studio

A self-contained, one-week marketing pack for **OrbitX** — the AI-native crypto
intelligence and trading app in this repo (Solana, mobile-first, non-custodial).

> This pack is about the **OrbitX app**. It is not about "OrbitX City" (a
> separate product). Every post and screenshot describes real OrbitX features.

## What's inside

- `posts.source.json` — the editable source of truth for all 25 posts.
- `build-content.mjs` — regenerates every derived file from the source.
- `posts/post-01.txt … post-25.txt` — **copy-paste-ready** X posts (Unicode styled).
- `posts/post-01.md … post-25.md` — same posts with metadata + their 3 images.
- `posts.json` — machine-readable index (title, body, assets, tags).
- `posts.md` — human-readable master of all 25 posts.
- `assets/post-01-01.png … post-25-03.png` — **75 images** (3 per post).
- `asset-index.md` — maps every post to its three images.
- `weekly-plan.md` — 7-day posting sequence.
- `POSTING-CHECKLIST.md` — pre-publish checklist.
- `demo-account.json` / `demo-data.json` — the mock identity + data.

Regenerate text after editing the source:

```bash
node content-studio/build-content.mjs
```

## Safety / demo mode

All visuals use a local mock identity — **`orbitx-content-demo`**:

- auth provider: `none` · session: `null`
- wallet provider: `mock` · address: `null` · private key: never generated
- fictional balances only · no network trades · no signatures

The screenshots are captured from the **real OrbitX UI** with mock data, and
every image carries a visible `CONTENT DEMO · MOCK DATA` badge. Fictional
symbols only (NOVA, ORBIT, CLAW, CITY). Never present demo values as live
results, real P&L, real volume, or executed trades.

A login-less in-app preview lives at the `/content-demo` route (renders the
`orbitx-content-demo` screen without any wallet or auth).

## Note on handles/links

Posts link to `ogscan.fun`. Replace or add your X handle before publishing if
you want an @mention in the copy.
