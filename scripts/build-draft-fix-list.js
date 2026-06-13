#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const QUALITY_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");
const FIX_LIST_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-fix-list-report.json");

const priorityByLabel = new Map([
  ["Readable JSON", 1],
  ["Draft status", 2],
  ["Category exists", 3],
  ["No published duplicate", 4],
  ["Existing source article", 5],
  ["No placeholder text", 6],
  ["Related links", 7],
  ["Related link targets", 8],
  ["New article publish intent", 9],
  ["Meta description length", 10],
  ["SEO title length", 11],
  ["Title length", 12],
  ["Keyword coverage", 13],
  ["Content depth", 14],
  ["FAQ coverage", 15],
]);

const guidanceByLabel = {
  "Readable JSON": {
    field: "whole file",
    howToFix: "Fix the JSON formatting so the draft file can be read.",
    doneWhen: "The draft file opens as valid JSON and audit-article-drafts passes.",
  },
  "Draft status": {
    field: "status",
    howToFix: "Set status to draft.",
    doneWhen: "The draft status is exactly draft.",
  },
  "Category exists": {
    field: "category",
    howToFix: "Use an existing category ID from content/categories.",
    doneWhen: "The category value matches an existing category JSON file.",
  },
  "No published duplicate": {
    field: "id",
    howToFix: "Choose a new article ID that does not already exist in content/articles.",
    doneWhen: "No published article uses the same ID.",
  },
  "Existing source article": {
    field: "draftOf",
    howToFix: "Point draftOf to the existing published article ID.",
    doneWhen: "draftOf matches a file in content/articles.",
  },
  "No placeholder text": {
    field: "title, description, excerpt, body, faq, related, cta",
    howToFix: "Replace every placeholder, draft, and replace-this phrase with final reader-facing text.",
    doneWhen: "The draft contains no placeholder wording anywhere in public content fields.",
  },
  "Related links": {
    field: "related",
    howToFix: "Add at least two relevant internal article links.",
    doneWhen: "The related array has at least two items.",
  },
  "Related link targets": {
    field: "related[].id",
    howToFix: "Use IDs of articles that already exist in content/articles.",
    doneWhen: "Every related item points to an existing article ID.",
  },
  "New article publish intent": {
    field: "draftPublishIntent",
    howToFix: "Keep this as editing while writing; set it to ready only after every other fix is complete.",
    doneWhen: "draftPublishIntent is ready and all other blockers are gone.",
  },
  "Meta description length": {
    field: "description",
    howToFix: "Write a natural 70-165 character summary of the page.",
    doneWhen: "The description is clear, useful, and within the target length.",
  },
  "SEO title length": {
    field: "seoTitle",
    howToFix: "Keep the SEO title specific and under 65 characters.",
    doneWhen: "The SEO title is neither missing, too short, nor too long.",
  },
  "Title length": {
    field: "title",
    howToFix: "Use a clear title between 10 and 80 characters.",
    doneWhen: "The visible article title is clear and within the target length.",
  },
  "Keyword coverage": {
    field: "keywords",
    howToFix: "Add at least five focused keywords that match the article topic.",
    doneWhen: "The keywords array has at least five useful terms.",
  },
  "Content depth": {
    field: "body",
    howToFix: "Add enough paragraphs, headings, lists, or examples to answer the topic fully.",
    doneWhen: "The body has at least eight useful content blocks.",
  },
  "FAQ coverage": {
    field: "faq",
    howToFix: "Add at least one honest question and answer.",
    doneWhen: "The FAQ array has at least one useful item.",
  },
};

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function severityRank(severity) {
  return severity === "blocker" ? 0 : 1;
}

function buildFixItems(report) {
  const items = [];
  for (const draft of report.items || []) {
    for (const fix of draft.fixes || []) {
      const guidance = guidanceByLabel[fix.label] || {
        field: "unknown",
        howToFix: fix.fix,
        doneWhen: "Run the full control check and confirm this fix disappears.",
      };
      items.push({
        draftId: draft.id,
        draftTitle: draft.title,
        draftPath: draft.draft,
        draftStatus: draft.status,
        kind: draft.kind,
        label: fix.label,
        severity: fix.severity,
        fix: fix.fix,
        field: guidance.field,
        where: `${draft.draft} -> ${guidance.field}`,
        howToFix: guidance.howToFix,
        doneWhen: guidance.doneWhen,
        priority: priorityByLabel.get(fix.label) || 99,
      });
    }
  }

  return items.sort((a, b) => {
    if (severityRank(a.severity) !== severityRank(b.severity)) {
      return severityRank(a.severity) - severityRank(b.severity);
    }
    if (a.priority !== b.priority) return a.priority - b.priority;
    return `${a.draftTitle} ${a.label}`.localeCompare(`${b.draftTitle} ${b.label}`);
  });
}

function main() {
  const qualityReport = readJsonIfExists(QUALITY_REPORT_FILE);
  const blockers = [];
  const warnings = [];

  if (!qualityReport) {
    blockers.push({
      scope: "system",
      message: "Draft quality report is missing. Run audit-draft-quality.js first.",
    });
  }

  const fixes = qualityReport ? buildFixItems(qualityReport) : [];
  if (qualityReport && fixes.length === 0) {
    warnings.push({
      scope: "system",
      message: "No draft fixes are needed right now.",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : fixes.length > 0 ? "action_needed" : "passed",
      drafts: qualityReport && qualityReport.summary ? qualityReport.summary.drafts : 0,
      fixes: fixes.length,
      blockers: fixes.filter((item) => item.severity === "blocker").length,
      warnings: fixes.filter((item) => item.severity === "warning").length,
      systemBlockers: blockers.length,
    },
    blockers,
    warnings,
    fixes,
    nextAction:
      fixes.length > 0
        ? `Start with: ${fixes[0].draftTitle} — ${fixes[0].where}. ${fixes[0].howToFix}`
        : "No draft fixes are needed right now.",
    guarantee:
      "Read-only fix planning. This script only reads the draft quality report and writes a local fix list. It does not edit drafts, publish files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(FIX_LIST_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Fix List");
  console.log("==============================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Drafts: ${report.summary.drafts}`);
  console.log(`Fixes: ${report.summary.fixes}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(FIX_LIST_REPORT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
