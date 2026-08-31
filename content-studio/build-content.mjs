import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(readFileSync(join(root, "posts.source.json"), "utf8"));

// Unicode "Mathematical Sans-Serif Bold" so headers pop in the X timeline
// while the body stays fully readable.
function boldSans(input) {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCodePoint(0x1d5d4 + (code - 65));
    } else if (code >= 97 && code <= 122) {
      out += String.fromCodePoint(0x1d5ee + (code - 97));
    } else if (code >= 48 && code <= 57) {
      out += String.fromCodePoint(0x1d7ec + (code - 48));
    } else {
      out += ch;
    }
  }
  return out;
}

const pad2 = (n) => String(n).padStart(2, "0");

function composeBody(post) {
  const lines = [];
  lines.push(`${boldSans("ORBITX")} ◈ ${boldSans(post.title.toUpperCase())}`);
  lines.push("");
  lines.push(post.hook);
  lines.push("");
  for (const point of post.points) {
    lines.push(`▸ ${point}`);
  }
  lines.push("");
  if (post.why) {
    lines.push(`${boldSans("Why it matters")} — ${post.why}`);
    lines.push("");
  }
  lines.push(post.punch);
  lines.push("");
  lines.push(`→ Try it: ${source.link}   ·   Built on Solana`);
  lines.push(post.tags.join(" "));
  return lines.join("\n");
}

function assetFiles(post) {
  return post.assets.map((scene, i) => ({
    file: `assets/post-${pad2(post.n)}-${pad2(i + 1)}.png`,
    scene,
  }));
}

mkdirSync(join(root, "posts"), { recursive: true });
mkdirSync(join(root, "assets"), { recursive: true });

const LANES = ["interface", "agent", "feature"];
const jsonPosts = [];
const masterParts = [
  `${source.brand} — 25 X posts`,
  source.tagline,
  "",
  "All posts are about the OrbitX app. Copy the block under each post straight into X.",
  "Attach the three listed images in order.",
  "",
];
const indexParts = [
  `# ${source.brand} — asset index`,
  "",
  "Each post ships with three images (interface → agent → feature).",
  "",
  "| Post | Title | Image 1 | Image 2 | Image 3 |",
  "| --- | --- | --- | --- | --- |",
];

for (const post of source.posts) {
  const body = composeBody(post);
  const assets = assetFiles(post);

  // Pure copy/paste file
  writeFileSync(join(root, "posts", `post-${pad2(post.n)}.txt`), `${body}\n`);

  // Markdown file with metadata
  const md = [
    `# Post ${pad2(post.n)} — ${post.title}`,
    "",
    `- Day: ${post.day}`,
    `- Images: ${assets.map((a) => a.file.replace("assets/", "")).join(", ")}`,
    "",
    "## Copy-paste (X-ready)",
    "",
    "```",
    body,
    "```",
    "",
    "## Media (in order)",
    ...assets.map((a, i) => `${i + 1}. \`${a.file}\` — ${LANES[i]} · ${a.scene}`),
    "",
  ].join("\n");
  writeFileSync(join(root, "posts", `post-${pad2(post.n)}.md`), `${md}\n`);

  jsonPosts.push({
    n: post.n,
    day: post.day,
    title: post.title,
    body,
    assets: assets.map((a) => a.file),
    scenes: post.assets,
    tags: post.tags,
  });

  masterParts.push(`═══════════════════════  POST ${pad2(post.n)}  ·  ${post.day}  ═══════════════════════`);
  masterParts.push(`images: ${assets.map((a) => a.file.replace("assets/", "")).join("  ")}`);
  masterParts.push("");
  masterParts.push(body);
  masterParts.push("");
  masterParts.push("");

  indexParts.push(
    `| ${pad2(post.n)} | ${post.title} | ${assets
      .map((a) => a.file.replace("assets/", ""))
      .join(" | ")} |`,
  );
}

writeFileSync(
  join(root, "posts.json"),
  `${JSON.stringify({ brand: source.brand, tagline: source.tagline, link: source.link, count: jsonPosts.length, posts: jsonPosts }, null, 2)}\n`,
);
writeFileSync(join(root, "posts.md"), `${masterParts.join("\n")}\n`);
writeFileSync(join(root, "asset-index.md"), `${indexParts.join("\n")}\n`);

console.log(
  `Generated ${jsonPosts.length} posts → posts/*.txt, posts/*.md, posts.json, posts.md, asset-index.md`,
);
console.log(`Expected assets: ${jsonPosts.length * 3} (post-01-01 … post-25-03)`);
