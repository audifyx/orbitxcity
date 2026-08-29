import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = await mkdtemp(join(tmpdir(), "orbitx-planner-"));
const outfile = join(dir, "planner.mjs");

await build({
  entryPoints: ["src/brain/index.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
});

const brain = await import(pathToFileURL(outfile).href);
const { planFromUtterance, AGENTS, TOOLS, FULL_TOKEN_REPORT_TOOLS } = brain;

const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const agents = [...AGENTS];
const tools = [...TOOLS];

function assert(cond, label) {
  if (!cond) {
    throw new Error(label);
  }
  console.log(`ok  ${label}`);
}

const report = planFromUtterance(`hey tell me about ${mint}`, agents, tools);
assert(report.intent === "analyze_token", "tell me about → analyze_token");
for (const id of FULL_TOKEN_REPORT_TOOLS) {
  assert(report.toolIds.includes(id), `report includes ${id}`);
}

const launch = planFromUtterance("launch a coin named Orbit ticker ORB", agents, tools);
assert(launch.intent === "launch", "launch a coin → launch");
assert(launch.toolIds.includes("launch-coin"), "launch-coin planned");
assert(!launch.toolIds.includes("jupiter-swap"), "no auto swap on launch");

const nft = planFromUtterance("mint an NFT called Orbit Pass", agents, tools);
assert(nft.intent === "nft", "mint nft → nft");
assert(nft.toolIds.includes("nft-mint"), "nft-mint planned");

const casual = planFromUtterance("hey what's up", agents, tools);
assert(casual.toolIds.length === 0, "casual chat runs no tools");

const tokenData = planFromUtterance(`@token-data ${mint}`, agents, tools);
assert(tokenData.toolIds.includes("token-data"), "@token-data mention works");

await rm(dir, { recursive: true, force: true });
await writeFile("/tmp/orbitx-planner-ok", "ok\n");
console.log("planner checks passed");
