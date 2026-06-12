#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");

const report = {
  critical: [],
  warnings: [],
};

function add(level, file, message) {
  report[level].push({ file, message });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    add("critical", path.relative(ROOT, filePath), `Invalid JSON: ${error.message}`);
    return null;
  }
}

function listDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".draft.json"))
    .map((name) => path.join(DRAFTS_DIR, name));
}

function validateDraft(filePath) {
  const relative = path.relative(ROOT, filePath);
  const draft = readJson(filePath);
  if (!draft) return;

  if (draft.status !== "draft") {
    add("critical", relative, `Draft status must be "draft", found "${draft.status}".`);
  }

  if (!draft.draftOf || typeof draft.draftOf !== "string") {
    add("critical", relative, "Missing draftOf.");
    return;
  }

  const sourcePath = path.join(ARTICLES_DIR, `${draft.draftOf}.json`);
  if (!fs.existsSync(sourcePath)) {
    add("critical", relative, `Published source is missing: content/articles/${draft.draftOf}.json`);
    return;
  }

  const source = readJson(sourcePath);
  if (!source) return;

  if (draft.id !== source.id) {
    add("critical", relative, `Draft id "${draft.id}" does not match source id "${source.id}".`);
  }

  if (draft.slug !== source.slug) {
    add("warnings", relative, "Draft slug differs from the published article slug.");
  }

  if (draft.category !== source.category) {
    add("warnings", relative, "Draft category differs from the published article category.");
  }
}

function printSection(title, items) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log("  None");
    return;
  }
  for (const item of items) {
    console.log(`  - ${item.file}: ${item.message}`);
  }
}

function main() {
  const drafts = listDrafts();
  for (const draftPath of drafts) validateDraft(draftPath);

  console.log("PersonalCapsule Draft Audit");
  console.log("===========================");
  console.log(`Drafts: ${drafts.length}`);
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
