import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(join(dist, "export"), { recursive: true });

const files = [
  ["index.html", "index.html"],
  ["privy-host.html", "privy-host.html"],
  ["privy-host.js", "privy-host.js"],
  ["wallet-export.html", "wallet-export.html"],
  ["wallet-export.js", "wallet-export.js"],
  ["export/index.html", "export/index.html"],
  ["wallet-export.js", "export/wallet-export.js"],
];

for (const [fromName, toName] of files) {
  const from = join(root, "public", fromName);
  if (!existsSync(from)) {
    continue;
  }
  const to = join(dist, toName);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`Copied ${fromName} → dist/${toName}`);
}
