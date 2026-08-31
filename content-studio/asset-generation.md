# Screenshot production checklist

The content agent should use the actual OrbitX app with `EXPO_PUBLIC_CONTENT_DEMO=true` and capture 75 real screenshots: 3 for each post.

Naming: `post-01-01.png` through `post-25-03.png`.

For every post:
1. Product / market intelligence screen.
2. Agent terminal / tool-call screen.
3. OrbitX City / social / world screen.

All screenshots must visibly show `CONTENT DEMO` or `MOCK DATA`. Use fictional assets and balances only. Do not connect Privy, Phantom, Jupiter execution, a private key, or any real authentication session.

Use 1600×1000 or higher where practical. Keep the UI itself authentic; do not fabricate a screenshot by drawing a fake browser chrome around unrelated content. Store the PNGs under `content-studio/assets/` and add an `asset-index.md` mapping each post to its three images.
