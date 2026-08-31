import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = await mkdtemp(join(tmpdir(), "orbitx-skills-"));
const outfile = join(dir, "brain.mjs");

await build({
  entryPoints: ["src/brain/index.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
});

const brain = await import(pathToFileURL(outfile).href);
const { SKILLS, SKILL_COUNT, TOOLS, AGENTS, skillCategoryCounts } = brain;

let passed = 0;
function assert(cond, label) {
  if (!cond) {
    throw new Error(label);
  }
  passed += 1;
  console.log(`ok  ${label}`);
}

const EXPECTED = 250;
const VALID_CATEGORIES = new Set([
  "trading", "defi", "intelligence", "security", "wallet", "portfolio",
  "social", "create", "monitor", "knowledge", "system",
]);
const VALID_KINDS = new Set(["knowledge", "analysis", "action", "automation"]);
const VALID_LEVELS = new Set(["core", "advanced", "expert"]);

assert(Array.isArray(SKILLS), "SKILLS is an array");
assert(SKILLS.length === EXPECTED, `SKILLS.length === ${EXPECTED} (got ${SKILLS.length})`);
assert(SKILL_COUNT === EXPECTED, `SKILL_COUNT === ${EXPECTED} (got ${SKILL_COUNT})`);

const toolIds = new Set(TOOLS.map((t) => t.id));
const agentIds = new Set(AGENTS.map((a) => a.id));
const ids = new Set();

for (const skill of SKILLS) {
  if (ids.has(skill.id)) {
    throw new Error(`Duplicate skill id: ${skill.id}`);
  }
  ids.add(skill.id);

  if (!skill.id || !skill.name || !skill.summary) {
    throw new Error(`Skill missing core fields: ${JSON.stringify(skill)}`);
  }
  if (!VALID_CATEGORIES.has(skill.category)) {
    throw new Error(`Skill ${skill.id} has invalid category: ${skill.category}`);
  }
  if (!VALID_KINDS.has(skill.kind)) {
    throw new Error(`Skill ${skill.id} has invalid kind: ${skill.kind}`);
  }
  if (!VALID_LEVELS.has(skill.level)) {
    throw new Error(`Skill ${skill.id} has invalid level: ${skill.level}`);
  }
  if (!Array.isArray(skill.toolIds)) {
    throw new Error(`Skill ${skill.id} toolIds not an array`);
  }
  for (const toolId of skill.toolIds) {
    if (!toolIds.has(toolId)) {
      throw new Error(`Skill ${skill.id} references unknown tool: ${toolId}`);
    }
  }
  if (skill.agentId && !agentIds.has(skill.agentId)) {
    throw new Error(`Skill ${skill.id} references unknown agent: ${skill.agentId}`);
  }
}

assert(ids.size === EXPECTED, `all ${EXPECTED} skill ids are unique`);
assert(
  SKILLS.every((s) => s.toolIds.every((t) => toolIds.has(t))),
  "every skill toolId references a real tool",
);
assert(
  SKILLS.every((s) => !s.agentId || agentIds.has(s.agentId)),
  "every skill agentId references a real agent",
);

const withTools = SKILLS.filter((s) => s.toolIds.length > 0).length;
assert(withTools >= 150, `at least 150 skills orchestrate real tools (got ${withTools})`);

const counts = skillCategoryCounts();
const total = counts.reduce((sum, c) => sum + c.count, 0);
assert(total === EXPECTED, "category counts sum to the skill total");
assert(counts.length >= 8, `skills span at least 8 categories (got ${counts.length})`);

console.log("\ncategory breakdown:");
for (const c of counts.sort((a, b) => b.count - a.count)) {
  console.log(`  ${c.category.padEnd(14)} ${c.count}`);
}

await rm(dir, { recursive: true, force: true });
await writeFile("/tmp/orbitx-skills-ok", "ok\n");
console.log(`\nskills checks passed (${passed} assertions, ${SKILLS.length} skills)`);
