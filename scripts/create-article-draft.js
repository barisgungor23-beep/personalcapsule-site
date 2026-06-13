#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/create-article-draft.js <article-id> --dry-run");
  console.log("  node scripts/create-article-draft.js <article-id> --confirm");
  console.log("  node scripts/create-article-draft.js <article-id> --confirm --force");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const articleId = process.argv[2];
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");
  const confirmed = process.argv.includes("--confirm");

  if (!articleId || articleId.startsWith("--")) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!dryRun && !confirmed) {
    usage();
    console.error("\nBlocked:");
    console.error("- Creating an edit draft requires --confirm. Use --dry-run to preview only.");
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
    draftKind: "existing_article",
    draftPublishIntent: "editing",
    draftOf: article.id,
    draftCreatedAt: article.draftCreatedAt || now,
    draftUpdatedAt: now,
    draftSourcePath: `content/articles/${articleId}.json`,
    draftOriginalModifiedAt: article.dateModified || null,
    draftNote: "Private edit draft copied from a published article. Edit this draft, then preview and audit before publishing.",
  };

  if (dryRun) {
    console.log("Existing article edit draft dry run passed");
    console.log(`Source: content/articles/${articleId}.json`);
    console.log(`Draft:  content/drafts/articles/${articleId}.draft.json`);
    console.log("No file was created.");
    return;
  }

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  console.log("Existing article edit draft created");
  console.log(`Source: content/articles/${articleId}.json`);
  console.log(`Draft:  content/drafts/articles/${articleId}.draft.json`);
  console.log("Status: draft");
  console.log("Publish intent: editing");
  console.log("No public article was changed.");
}

main();
