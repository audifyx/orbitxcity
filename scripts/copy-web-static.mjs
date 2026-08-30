import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

const files = [
  "privy-host.html",
  "privy-host.js",
  "wallet-export.html",
  "wallet-export.js",
];

for (const name of files) {
  const from = join(root, "public", name);
  if (!existsSync(from)) {
    continue;
  }
  const to = join(dist, name);
  copyFileSync(from, to);
  console.log(`Copied ${name} → dist/${name}`);
}
