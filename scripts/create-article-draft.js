#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/create-article-draft.js <article-id>");
  console.log("  node scripts/create-article-draft.js <article-id> --dry-run");
  console.log("  node scripts/create-article-draft.js <article-id> --force");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const articleId = process.argv[2];
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  if (!articleId || articleId.startsWith("--")) {
    usage();
    process.exitCode = 1;
    return;
  }

  const sourcePath = path.join(ARTICLES_DIR, `${articleId}.json`);
  const draftPath = path.join(DRAFTS_DIR, `${articleId}.draft.json`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Article not found: content/articles/${articleId}.json`);
    process.exitCode = 1;
    return;
  }

  if (fs.existsSync(draftPath) && !force) {
    console.error(`Draft already exists: content/drafts/articles/${articleId}.draft.json`);
    console.error("Use --force only if you intentionally want to replace the draft.");
    process.exitCode = 1;
    return;
  }

  const article = readJson(sourcePath);
  const now = new Date().toISOString();
  const draft = {
    ...article,
    status: "draft",
    draftOf: article.id,
    draftCreatedAt: article.draftCreatedAt || now,
    draftUpdatedAt: now,
    draftSourcePath: `content/articles/${articleId}.json`,
    draftNote: "Private draft copy. Preview and audit before publishing.",
  };

  if (dryRun) {
    console.log("Draft dry run passed");
    console.log(`Source: content/articles/${articleId}.json`);
    console.log(`Draft:  content/drafts/articles/${articleId}.draft.json`);
    return;
  }

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  console.log("Draft created");
  console.log(`Source: content/articles/${articleId}.json`);
  console.log(`Draft:  content/drafts/articles/${articleId}.draft.json`);
}

main();
