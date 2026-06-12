#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "outputs", "drafts");

const report = {
  critical: [],
  warnings: [],
};

function add(level, file, message) {
  report[level].push({ file, message });
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countTags(html, tag) {
  return (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
}

function getTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function getDraftPreviews() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs
    .readdirSync(OUTPUT_DIR)
    .filter((name) => name.endsWith(".draft.html"))
    .map((name) => path.join(OUTPUT_DIR, name));
}

function auditFile(filePath) {
  const file = rel(filePath);
  const html = read(filePath);
  const title = getTitle(html);

  if (!title) add("critical", file, "Missing title.");
  if (countTags(html, "h1") !== 1) add("critical", file, "Draft preview must have exactly one H1.");
  if (!html.includes('<meta name="description"')) add("critical", file, "Missing meta description.");
  if (!html.includes('rel="canonical"')) add("critical", file, "Missing canonical link.");
  if (!html.includes("application/ld+json")) add("critical", file, "Missing JSON-LD.");
  if (!html.includes("PersonalCapsule")) add("warnings", file, "Preview does not mention PersonalCapsule.");
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
  const files = getDraftPreviews();
  for (const filePath of files) auditFile(filePath);

  console.log("PersonalCapsule Draft Preview Audit");
  console.log("===================================");
  console.log(`Draft previews: ${files.length}`);
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
