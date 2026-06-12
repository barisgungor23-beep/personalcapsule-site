#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://personalcapsule.app";
const APPROVED_APP_STORE_LINK_PREFIXES = [
  "https://apps.apple.com/app/apple-store/id6773064012?pt=128571836&ct=website&mt=8",
  "https://apps.apple.com/app/apple-store/id6773064012?pt=128571836&ct=website_open_when&mt=8",
];

const report = {
  summary: {
    htmlPages: 0,
    critical: 0,
    warnings: 0,
    notes: 0,
  },
  critical: [],
  warnings: [],
  notes: [],
};

function add(level, file, message) {
  const bucket = level === "warning" ? "warnings" : level;
  if (!report[bucket]) {
    throw new Error(`Unknown audit level: ${level}`);
  }
  report[bucket].push({ file, message });
  report.summary[bucket] += 1;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
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

function getCanonical(html) {
  const links = matchAll(html, /<link\b[^>]*>/gi).map((m) => m[0]);
  for (const tag of links) {
    if (attr(tag, "rel") === "canonical") return attr(tag, "href");
  }
  return "";
}

function getH1s(html) {
  return matchAll(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map((m) => stripTags(m[1]));
}

function getAnchors(html) {
  return matchAll(html, /<a\b[^>]*>/gi)
    .map((m) => m[0])
    .map((tag) => attr(tag, "href"))
    .filter(Boolean);
}

function getJsonLdBlocks(html) {
  return matchAll(
    html,
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ).map((m) => m[1].trim());
}

function pageUrlFromFile(filePath) {
  const relative = rel(filePath);
  if (relative === "index.html") return `${SITE_URL}/`;
  if (relative.endsWith("/index.html")) {
    return `${SITE_URL}/${relative.replace(/\/index\.html$/, "/")}`;
  }
  return `${SITE_URL}/${relative.replace(/\.html$/, "")}`;
}

function localCandidates(fromFile, href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || clean.startsWith("mailto:") || clean.startsWith("tel:")) return [];
  if (/^(https?:)?\/\//i.test(clean)) return [];
  if (clean.startsWith("javascript:")) return [];

  const base = clean.startsWith("/")
    ? path.join(ROOT, clean)
    : path.join(path.dirname(fromFile), clean);

  const ext = path.extname(base);
  if (ext) return [base];
  return [base, `${base}.html`, path.join(base, "index.html")];
}

function parseSitemap() {
  const filePath = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(filePath)) {
    add("critical", "sitemap.xml", "sitemap.xml is missing.");
    return new Set();
  }
  const xml = read(filePath);
  const urls = matchAll(xml, /<loc>([\s\S]*?)<\/loc>/gi).map((m) => m[1].trim());
  const seen = new Set();
  for (const url of urls) {
    if (seen.has(url)) add("critical", "sitemap.xml", `Duplicate sitemap URL: ${url}`);
    seen.add(url);
  }
  if (!xml.includes("</urlset>")) {
    add("critical", "sitemap.xml", "sitemap.xml does not appear to close urlset.");
  }
  return seen;
}

function parseLlms() {
  const filePath = path.join(ROOT, "llms.txt");
  if (!fs.existsSync(filePath)) {
    add("warning", "llms.txt", "llms.txt is missing.");
    return "";
  }
  return read(filePath);
}

function auditHtmlPage(filePath, sitemapUrls, llmsText) {
  const file = rel(filePath);
  const html = read(filePath);
  const url = pageUrlFromFile(filePath);

  const title = getTitle(html);
  if (!title) add("critical", file, "Missing <title>.");
  else if (title.length > 65) add("warning", file, `SEO title is long (${title.length} chars).`);

  const description = getMeta(html, "name", "description");
  if (!description) add("critical", file, "Missing meta description.");
  else if (description.length < 70) add("warning", file, `Meta description is short (${description.length} chars).`);
  else if (description.length > 165) add("warning", file, `Meta description is long (${description.length} chars).`);

  const canonical = getCanonical(html);
  if (!canonical) add("critical", file, "Missing canonical URL.");
  else if (!canonical.startsWith(SITE_URL)) add("critical", file, `Canonical does not use primary domain: ${canonical}`);

  const h1s = getH1s(html);
  if (h1s.length !== 1) add("critical", file, `Expected exactly one H1, found ${h1s.length}.`);

  const ogTitle = getMeta(html, "property", "og:title");
  const ogDescription = getMeta(html, "property", "og:description");
  const ogImage = getMeta(html, "property", "og:image");
  const twitterCard = getMeta(html, "name", "twitter:card");

  if (!ogTitle) add("warning", file, "Missing og:title.");
  if (!ogDescription) add("warning", file, "Missing og:description.");
  if (!ogImage) add("warning", file, "Missing og:image.");
  if (!twitterCard) add("warning", file, "Missing twitter:card.");

  const jsonLdBlocks = getJsonLdBlocks(html);
  if (!jsonLdBlocks.length) {
    add("warning", file, "No JSON-LD structured data found.");
  }
  for (const block of jsonLdBlocks) {
    try {
      JSON.parse(block);
    } catch (error) {
      add("critical", file, `Invalid JSON-LD: ${error.message}`);
    }
  }

  const anchors = getAnchors(html);
  for (const href of anchors) {
    if (href.includes("barisgungor23-beep.github.io")) {
      add("critical", file, `Old GitHub Pages link found: ${href}`);
    }
    if (href.includes("apps.apple.com")) {
      const approved = APPROVED_APP_STORE_LINK_PREFIXES.some((prefix) => href.startsWith(prefix));
      if (!approved) add("critical", file, `Unapproved App Store tracking link: ${href}`);
    }
    const candidates = localCandidates(filePath, href);
    if (candidates.length && !candidates.some((candidate) => fs.existsSync(candidate))) {
      add("critical", file, `Broken internal link: ${href}`);
    }
  }

  if (!sitemapUrls.has(url)) {
    const isUtility = ["privacy.html", "terms.html"].includes(file);
    if (!isUtility) add("critical", file, `Published page missing from sitemap: ${url}`);
  }

  const isImportantForLlms =
    file === "index.html" ||
    file.startsWith("about/") ||
    file.startsWith("blog/") ||
    file.startsWith("open-when-capsule/");

  if (isImportantForLlms && !llmsText.includes(url)) {
    add("warning", file, `Important page may be missing from llms.txt: ${url}`);
  }
}

function auditRobots() {
  const file = "robots.txt";
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    add("critical", file, "robots.txt is missing.");
    return;
  }
  const robots = read(filePath);
  if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
    add("critical", file, "robots.txt does not reference the primary sitemap.");
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
  const htmlFiles = walk(ROOT, (file) => file.endsWith(".html"));
  const sitemapUrls = parseSitemap();
  const llmsText = parseLlms();

  report.summary.htmlPages = htmlFiles.length;

  for (const filePath of htmlFiles) {
    auditHtmlPage(filePath, sitemapUrls, llmsText);
  }
  auditRobots();

  console.log("PersonalCapsule Website Audit");
  console.log("=============================");
  console.log(`HTML pages: ${report.summary.htmlPages}`);
  console.log(`Critical: ${report.summary.critical}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Notes: ${report.summary.notes}`);

  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);
  printSection("Notes", report.notes);

  if (report.summary.critical > 0) {
    process.exitCode = 1;
  }
}

main();
