# OrbitX content agent — execution brief

You are the OrbitX content-production agent. Work inside `audifyx/orbitxcity`.

> Scope: the content is about the **OrbitX app** (AI-native crypto intelligence
> and trading on Solana) — **not** "OrbitX City", which is a separate product.

## Objective

Produce a safe, polished one-week marketing package: **25 X posts + 3 images
per post = 75 media assets**. Media must show the actual OrbitX interface using
a dedicated content-demo identity. Never connect a real wallet, create a real
auth session, sign a transaction, spend SOL, call a real execution endpoint, or
expose credentials.

## Demo identity (`orbitx-content-demo`)

- auth provider: `none` · session: `null`
- wallet provider: `mock` · address: `null` · private key: never generated
- fictional balances only · execution/network trades: disabled

A login-less preview is exposed at the `/content-demo` route. The normal
production paths are unchanged.

## Mock data

Use fictional symbols only (NOVA, ORBIT, CLAW, CITY) and believable-but-fake
values. Every image must visibly carry `CONTENT DEMO · MOCK DATA`. Never imply
demo numbers are live performance, real P&L, real volume, real users, or
executed trades.

## Screenshots

Capture from the real OrbitX components (see `asset-generation.md`). Three
images per post, in order: interface view → agent/tooling view → feature view.
Files: `assets/post-01-01.png` … `assets/post-25-03.png`, mapped in
`asset-index.md`.

## Copy

Posts live in `posts.source.json` and are compiled by `build-content.mjs`.
Keep Unicode styling on headers only; body stays readable. Strong hooks, short
paragraphs, intentional whitespace, 1–3 hashtags. No fake scarcity, traction,
partnerships, user counts, revenue, or guaranteed-profit language.

## Regenerate

```bash
node content-studio/build-content.mjs
```

## Status

Fulfilled: 25 OrbitX posts + 75 labeled mock-data screenshots + login-less
demo route. Do not overwrite unrelated product work.
