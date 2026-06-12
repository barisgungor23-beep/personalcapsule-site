#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { renderPage } = require("./generate-article-preview");

const ROOT = path.resolve(__dirname, "..");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");
const OUTPUT_DIR = path.join(ROOT, "outputs", "drafts");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/generate-draft-preview.js <article-id>");
  console.log("  node scripts/generate-draft-preview.js --all");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function draftIds() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".draft.json"))
    .map((name) => name.replace(/\.draft\.json$/, ""));
}

function cleanDraftPreviews() {
  if (!fs.existsSync(OUTPUT_DIR)) return;
  for (const name of fs.readdirSync(OUTPUT_DIR)) {
    if (name.endsWith(".draft.html")) {
      fs.unlinkSync(path.join(OUTPUT_DIR, name));
    }
  }
}

function renderDraft(articleId) {
  const draftPath = path.join(DRAFTS_DIR, `${articleId}.draft.json`);
  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft not found: content/drafts/articles/${articleId}.draft.json`);
  }

  const draft = readJson(draftPath);
  if (draft.status !== "draft") {
    throw new Error(`Draft status must be "draft": ${articleId}`);
  }

  const category = readJson(path.join(ROOT, "content", "categories", `${draft.category}.json`));
  const html = renderPage(draft, category);
  const outputPath = path.join(OUTPUT_DIR, `${draft.slug}.draft.html`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(outputPath, html);
  console.log(`Generated ${path.relative(ROOT, outputPath)}`);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    usage();
    process.exitCode = 1;
    return;
  }

  const ids = arg === "--all" ? draftIds() : [arg];
  if (arg === "--all") cleanDraftPreviews();
  if (arg === "--all" && ids.length === 0) {
    console.log("No article drafts found.");
    return;
  }

  for (const id of ids) renderDraft(id);
}

main();
