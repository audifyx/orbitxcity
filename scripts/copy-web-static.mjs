import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(join(dist, "export"), { recursive: true });

const files = [
  [join(root, "web-static", "index.html"), "index.html"],
  [join(root, "public", "privy-host.html"), "privy-host.html"],
  [join(root, "public", "privy-host.js"), "privy-host.js"],
  [join(root, "public", "wallet-export.html"), "wallet-export.html"],
  [join(root, "public", "wallet-export.js"), "wallet-export.js"],
  [join(root, "public", "export", "index.html"), "export/index.html"],
  [join(root, "public", "wallet-export.js"), "export/wallet-export.js"],
];

for (const [from, toName] of files) {
  if (!existsSync(from)) {
    continue;
  }
  const to = join(dist, toName);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`Copied ${from.replace(root + "/", "")} → dist/${toName}`);
}
