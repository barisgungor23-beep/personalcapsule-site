#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "outputs/generated/discovery");

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

function sitemapUrls(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const xml = read(filePath);
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)).map((match) =>
    match[1].trim().replace(/&amp;/g, "&")
  );
}

function auditSitemap() {
  const livePath = path.join(ROOT, "sitemap.xml");
  const generatedPath = path.join(OUTPUT_DIR, "sitemap.xml");
  const liveUrls = sitemapUrls(livePath);
  const generatedUrls = sitemapUrls(generatedPath);

  if (!generatedUrls) {
    add("critical", "outputs/generated/discovery/sitemap.xml", "Generated sitemap is missing.");
    return;
  }

  const seen = new Set();
  for (const url of generatedUrls) {
    if (seen.has(url)) add("critical", "outputs/generated/discovery/sitemap.xml", `Duplicate URL: ${url}`);
    seen.add(url);
  }

  for (const url of liveUrls || []) {
    if (!seen.has(url)) {
      add("critical", "outputs/generated/discovery/sitemap.xml", `Generated sitemap dropped live URL: ${url}`);
    }
  }

  if (liveUrls && generatedUrls.length !== liveUrls.length) {
    add(
      "notes",
      "outputs/generated/discovery/sitemap.xml",
      `Generated sitemap URL count differs from live sitemap. live=${liveUrls.length} generated=${generatedUrls.length}`
    );
  }
}

function auditLlms() {
  const livePath = path.join(ROOT, "llms.txt");
  const generatedPath = path.join(OUTPUT_DIR, "llms.txt");

  if (!fs.existsSync(generatedPath)) {
    add("critical", "outputs/generated/discovery/llms.txt", "Generated llms.txt is missing.");
    return;
  }

  const liveText = read(livePath);
  const generatedText = read(generatedPath);
  const importantUrls = [
    "https://personalcapsule.app/",
    "https://personalcapsule.app/about/",
    "https://personalcapsule.app/changelog/",
    "https://personalcapsule.app/open-when-capsule/",
    "https://personalcapsule.app/blog/",
    "https://personalcapsule.app/blog/category/open-when-letters",
  ];

  for (const url of importantUrls) {
    if (!generatedText.includes(url)) {
      add("critical", "outputs/generated/discovery/llms.txt", `Important URL missing: ${url}`);
    }
  }

  const liveOpenWhenCount = (liveText.match(/https:\/\/personalcapsule\.app\/blog\/open-when/g) || []).length;
  const generatedOpenWhenCount =
    (generatedText.match(/https:\/\/personalcapsule\.app\/blog\/open-when/g) || []).length;
  if (generatedOpenWhenCount < liveOpenWhenCount) {
    add(
      "critical",
      "outputs/generated/discovery/llms.txt",
      `Generated llms.txt has fewer Open When article links. live=${liveOpenWhenCount} generated=${generatedOpenWhenCount}`
    );
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
  auditSitemap();
  auditLlms();

  console.log("PersonalCapsule Discovery Preview Audit");
  console.log("=======================================");
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Notes: ${report.notes.length}`);
  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);
  printSection("Notes", report.notes);

  if (report.critical.length > 0) process.exitCode = 1;
}

main();
