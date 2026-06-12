#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");
const OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(OUTPUT_DIR, "draft-comparison-report.json");

const ignoredFields = new Set([
  "status",
  "draftOf",
  "draftCreatedAt",
  "draftUpdatedAt",
  "draftSourcePath",
  "draftNote",
]);

const fieldRisk = {
  id: "critical",
  type: "critical",
  slug: "critical",
  url: "critical",
  category: "warning",
  seoTitle: "warning",
  description: "warning",
  related: "warning",
  cta: "warning",
  datePublished: "warning",
  title: "info",
  excerpt: "info",
  keywords: "info",
  body: "info",
  faq: "info",
  dateModified: "info",
  readTime: "info",
  schemaAbout: "info",
  eyebrow: "info",
  breadcrumbOpenWhen: "info",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".draft.json"))
    .sort()
    .map((name) => path.join(DRAFTS_DIR, name));
}

function stable(value) {
  return JSON.stringify(value);
}

function summarize(value) {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value && typeof value === "object") return `${Object.keys(value).length} keys`;
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 87)}...` : value;
  if (value === undefined) return "undefined";
  return String(value);
}

function compareArticle(source, draft) {
  const keys = new Set([...Object.keys(source), ...Object.keys(draft)]);
  const changes = [];

  for (const key of Array.from(keys).sort()) {
    if (ignoredFields.has(key)) continue;
    if (stable(source[key]) === stable(draft[key])) continue;

    const risk = fieldRisk[key] || "warning";
    changes.push({
      field: key,
      risk,
      before: summarize(source[key]),
      after: summarize(draft[key]),
    });
  }

  return changes;
}

function main() {
  const drafts = listDrafts();
  const comparisons = [];
  const critical = [];
  const warnings = [];

  for (const draftPath of drafts) {
    const draft = readJson(draftPath);
    const draftFile = path.relative(ROOT, draftPath).replace(/\\/g, "/");
    const sourceId = draft.draftOf || draft.id;
    const sourcePath = path.join(ARTICLES_DIR, `${sourceId}.json`);

    if (!fs.existsSync(sourcePath)) {
      critical.push({
        draft: draftFile,
        message: `Published source is missing: content/articles/${sourceId}.json`,
      });
      continue;
    }

    const source = readJson(sourcePath);
    const changes = compareArticle(source, draft);
    const criticalChanges = changes.filter((change) => change.risk === "critical");
    const warningChanges = changes.filter((change) => change.risk === "warning");

    if (criticalChanges.length > 0) {
      critical.push({
        draft: draftFile,
        message: "Draft changes high-risk identity, URL, or type fields.",
        fields: criticalChanges.map((change) => change.field),
      });
    }

    if (warningChanges.length > 0) {
      warnings.push({
        draft: draftFile,
        message: "Draft changes SEO, category, date, CTA, or internal-link fields.",
        fields: warningChanges.map((change) => change.field),
      });
    }

    comparisons.push({
      id: source.id,
      draft: draftFile,
      source: path.relative(ROOT, sourcePath).replace(/\\/g, "/"),
      title: draft.title || source.title,
      slug: draft.slug || source.slug,
      changedFields: changes.map((change) => change.field),
      changeCount: changes.length,
      criticalChangeCount: criticalChanges.length,
      warningChangeCount: warningChanges.length,
      changes,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: critical.length === 0 ? "passed" : "failed",
      drafts: drafts.length,
      changedDrafts: comparisons.filter((item) => item.changeCount > 0).length,
      totalChanges: comparisons.reduce((total, item) => total + item.changeCount, 0),
      critical: critical.length,
      warnings: warnings.length,
    },
    critical,
    warnings,
    comparisons,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Comparison");
  console.log("================================");
  console.log(`Drafts: ${report.summary.drafts}`);
  console.log(`Changed drafts: ${report.summary.changedDrafts}`);
  console.log(`Total changes: ${report.summary.totalChanges}`);
  console.log(`Critical: ${report.summary.critical}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_FILE)}`);

  if (critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
