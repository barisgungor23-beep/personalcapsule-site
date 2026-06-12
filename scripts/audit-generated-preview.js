#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "outputs/generated");

const report = {
  critical: [],
  warnings: [],
  notes: [],
};

function add(level, file, message) {
  report[level].push({ file, message });
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function attr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = tag.match(pattern);
  return match ? match[1] : "";
}

function matchAll(text, pattern) {
  return Array.from(text.matchAll(pattern));
}

function getTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function getMeta(html, selectorName, selectorValue) {
  const metas = matchAll(html, /<meta\b[^>]*>/gi).map((m) => m[0]);
  for (const tag of metas) {
    if (attr(tag, selectorName) === selectorValue) return attr(tag, "content");
  }
  return "";
}

function countTags(html, tag) {
  return (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
}

function getJsonLdBlocks(html) {
  return matchAll(
    html,
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ).map((m) => m[1].trim());
}

function pageStats(html) {
  return {
    title: getTitle(html),
    h1: countTags(html, "h1"),
    h2: countTags(html, "h2"),
    h3: countTags(html, "h3"),
    links: countTags(html, "a"),
  };
}

function generatedHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return generatedHtmlFiles(entryPath);
    return entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function livePathForGenerated(filePath) {
  const relative = rel(filePath);
  if (relative.startsWith("outputs/generated/category/")) {
    return path.join(ROOT, "blog/category", path.basename(filePath));
  }
  return path.join(ROOT, "blog", path.basename(filePath));
}

function compareWithLivePage(filePath, html) {
  const file = rel(filePath);
  const liveFile = livePathForGenerated(filePath);
  if (!fs.existsSync(liveFile)) {
    add("warnings", file, "No matching live blog page exists for comparison.");
    return;
  }

  const liveStats = pageStats(read(liveFile));
  const generatedStats = pageStats(html);
  const isCategoryPreview = file.includes("/category/");
  const keys = isCategoryPreview ? ["title", "h1"] : ["title", "h1", "h2", "h3", "links"];

  for (const key of keys) {
    if (liveStats[key] !== generatedStats[key]) {
      add(
        "warnings",
        file,
        `Generated ${key} differs from current page. current=${liveStats[key]} generated=${generatedStats[key]}`
      );
    }
  }

  if (isCategoryPreview && liveStats.links !== generatedStats.links) {
    add(
      "notes",
      file,
      `Generated category link count differs because only migrated JSON articles are included. current=${liveStats.links} generated=${generatedStats.links}`
    );
  }
}

function auditGeneratedFile(filePath) {
  const file = rel(filePath);
  const html = read(filePath);
  const title = getTitle(html);
  const description = getMeta(html, "name", "description");
  const canonical = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [""])[0];

  if (!title) add("critical", file, "Missing title.");
  if (title.length > 65) add("warnings", file, `Long title (${title.length} chars).`);
  if (!description) add("critical", file, "Missing meta description.");
  if (!canonical) add("critical", file, "Missing canonical.");
  if (countTags(html, "h1") !== 1) add("critical", file, "Generated page must have exactly one H1.");

  const jsonLdBlocks = getJsonLdBlocks(html);
  if (jsonLdBlocks.length === 0) add("critical", file, "Generated page has no JSON-LD.");
  for (const block of jsonLdBlocks) {
    try {
      JSON.parse(block);
    } catch (error) {
      add("critical", file, `Invalid JSON-LD: ${error.message}`);
    }
  }

  compareWithLivePage(filePath, html);
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
  if (!fs.existsSync(OUTPUT_DIR)) {
    add("critical", "outputs/generated", "Generated output directory does not exist.");
  } else {
    const files = generatedHtmlFiles(OUTPUT_DIR);
    if (files.length === 0) {
      add("critical", "outputs/generated", "No generated HTML files found.");
    }
    for (const filePath of files) auditGeneratedFile(filePath);
  }

  console.log("PersonalCapsule Generated Preview Audit");
  console.log("=======================================");
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Notes: ${report.notes.length}`);
  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);
  printSection("Notes", report.notes);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
