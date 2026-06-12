#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CATEGORIES_DIR = path.join(ROOT, "content", "categories");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));
}

function listDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".draft.json"))
    .sort()
    .map((name) => path.join(DRAFTS_DIR, name));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function lengthStatus(value, min, max) {
  const length = typeof value === "string" ? value.trim().length : 0;
  if (length === 0) return "missing";
  if (length < min) return "short";
  if (length > max) return "long";
  return "ok";
}

function hasPlaceholderText(value) {
  if (typeof value === "string") {
    return /\bdraft\b|placeholder|replace this|new article title/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasPlaceholderText(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasPlaceholderText(item));
  }
  return false;
}

function publicDraftContent(draft) {
  const {
    draftKind,
    draftPublishIntent,
    draftOf,
    draftCreatedAt,
    draftUpdatedAt,
    draftSourcePath,
    draftNote,
    status,
    ...content
  } = draft;
  return content;
}

function check(label, passed, severity, fix) {
  return {
    label,
    passed,
    severity,
    fix,
  };
}

function scoreChecks(checks) {
  const rawScore = checks.reduce((score, item) => {
    if (item.passed) return score + 10;
    if (item.severity === "warning") return score + 4;
    return score;
  }, 0);
  const maxScore = checks.length * 10;
  const normalized = Math.round((rawScore / maxScore) * 100);
  const blockers = checks.filter((item) => !item.passed && item.severity === "blocker").length;
  const warnings = checks.filter((item) => !item.passed && item.severity === "warning").length;
  if (blockers > 0) return Math.min(normalized, 69);
  if (warnings > 0) return Math.min(normalized, 89);
  return normalized;
}

function qualityStatus(checks) {
  const blockers = checks.filter((item) => !item.passed && item.severity === "blocker").length;
  const warnings = checks.filter((item) => !item.passed && item.severity === "warning").length;
  if (blockers > 0) return "blocked";
  if (warnings > 0) return "review";
  return "ready";
}

function main() {
  const categories = new Set(
    listJson(CATEGORIES_DIR)
      .map(readJsonIfExists)
      .filter(Boolean)
      .map((category) => category.id)
  );
  const articles = new Set(
    listJson(ARTICLES_DIR)
      .map(readJsonIfExists)
      .filter(Boolean)
      .map((article) => article.id)
  );
  const draftFiles = listDrafts();
  const items = [];

  for (const draftFile of draftFiles) {
    const draft = readJsonIfExists(draftFile);
    const draftPath = relative(draftFile);
    if (!draft) {
      items.push({
        id: path.basename(draftFile, ".draft.json"),
        title: "Unreadable draft",
        draft: draftPath,
        status: "blocked",
        score: 0,
        checks: [
          check("Readable JSON", false, "blocker", "Fix invalid JSON before any preview or publish step."),
        ],
      });
      continue;
    }

    const isNewArticleDraft = draft.draftKind === "new_article";
    const titleStatus = lengthStatus(draft.title, 10, 80);
    const seoTitleStatus = lengthStatus(draft.seoTitle, 10, 65);
    const descriptionStatus = lengthStatus(draft.description, 70, 165);
    const bodyCount = Array.isArray(draft.body) ? draft.body.length : 0;
    const faqCount = Array.isArray(draft.faq) ? draft.faq.length : 0;
    const related = Array.isArray(draft.related) ? draft.related : [];
    const relatedTargetsExist = related.every((item) => item && item.id && articles.has(item.id));

    const checks = [
      check("Draft status", draft.status === "draft", "blocker", "Set status to draft."),
      check("Category exists", Boolean(draft.category && categories.has(draft.category)), "blocker", "Use one of the existing category IDs."),
      check("Title length", titleStatus === "ok", "warning", "Use a clear title between 10 and 80 characters."),
      check("SEO title length", seoTitleStatus === "ok", "warning", "Keep the SEO title clear and under 65 characters."),
      check("Meta description length", descriptionStatus === "ok", "warning", "Write a natural 70-165 character description."),
      check("Keyword coverage", Array.isArray(draft.keywords) && draft.keywords.length >= 5, "warning", "Add at least 5 focused keywords."),
      check("Content depth", bodyCount >= 8, "warning", "Add enough body blocks to fully answer the topic."),
      check("FAQ coverage", faqCount >= 1, "warning", "Add at least one useful FAQ answer."),
      check("Related links", related.length >= 2, "blocker", "Add at least two related internal links."),
      check("Related link targets", relatedTargetsExist, "blocker", "Every related link must point to an existing article ID."),
      check("No placeholder text", !hasPlaceholderText(publicDraftContent(draft)), "blocker", "Replace all draft, placeholder, and replace-this text."),
    ];

    if (isNewArticleDraft) {
      checks.push(
        check(
          "New article publish intent",
          draft.draftPublishIntent === "ready",
          "blocker",
          "Keep draftPublishIntent as editing while writing; set it to ready only after final review."
        )
      );
      checks.push(
        check(
          "No published duplicate",
          !articles.has(draft.id),
          "blocker",
          "A new article draft must not duplicate an existing published article ID."
        )
      );
    } else {
      checks.push(
        check(
          "Existing source article",
          Boolean(draft.draftOf && articles.has(draft.draftOf)),
          "blocker",
          "Drafts for existing articles must point to a published source article."
        )
      );
    }

    const failed = checks.filter((item) => !item.passed);
    items.push({
      id: draft.id,
      title: draft.title,
      draft: draftPath,
      kind: isNewArticleDraft ? "new_article" : "existing_article",
      publishIntent: draft.draftPublishIntent || null,
      status: qualityStatus(checks),
      score: scoreChecks(checks),
      blockers: failed.filter((item) => item.severity === "blocker").length,
      warnings: failed.filter((item) => item.severity === "warning").length,
      checks,
      fixes: failed.map((item) => ({
        label: item.label,
        severity: item.severity,
        fix: item.fix,
      })),
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: items.some((item) => item.status === "blocked") ? "blocked" : items.some((item) => item.status === "review") ? "review" : "passed",
      drafts: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      review: items.filter((item) => item.status === "review").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      totalBlockers: items.reduce((total, item) => total + item.blockers, 0),
      totalWarnings: items.reduce((total, item) => total + item.warnings, 0),
    },
    items,
    guarantee:
      "Read-only quality audit. This script only reads draft JSON files and writes a local report. It does not edit drafts, publish files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Quality Audit");
  console.log("===================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Drafts: ${report.summary.drafts}`);
  console.log(`Ready: ${report.summary.ready}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Blockers: ${report.summary.totalBlockers}`);
  console.log(`Warnings: ${report.summary.totalWarnings}`);
  console.log(`Report: ${relative(REPORT_FILE)}`);
}

main();
