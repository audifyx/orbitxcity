import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

mkdirSync(join(root, "public"), { recursive: true });

const shared = {
  absWorkingDir: root,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"production"',
    global: "globalThis",
  },
  loader: {
    ".css": "empty",
  },
  alias: {
    "@solana-program/token": join(root, "privy-host", "solana-program-stub.js"),
    "@solana-program/token-2022": join(root, "privy-host", "solana-program-stub.js"),
    "@solana-program/compute-budget": join(root, "privy-host", "solana-program-stub.js"),
    "@solana-program/system": join(root, "privy-host", "solana-program-stub.js"),
    "@solana-program/memo": join(root, "privy-host", "solana-program-stub.js"),
  },
};

const builds = [
  {
    entryPoints: [join(root, "privy-host", "main.tsx")],
    outfile: join(root, "public", "privy-host.js"),
  },
  {
    entryPoints: [join(root, "privy-host", "export.tsx")],
    outfile: join(root, "public", "wallet-export.js"),
  },
];

for (const build of builds) {
  await esbuild.build({
    ...shared,
    ...build,
  });
  console.log(`Wrote ${build.outfile}`);
}
