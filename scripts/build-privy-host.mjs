import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = join(root, "public", "privy-host.js");

mkdirSync(dirname(outfile), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, "privy-host", "main.tsx")],
  outfile,
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
});

console.log(`Wrote ${outfile}`);
