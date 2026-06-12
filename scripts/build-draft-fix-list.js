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
      items.push({
        draftId: draft.id,
        draftTitle: draft.title,
        draftPath: draft.draft,
        draftStatus: draft.status,
        kind: draft.kind,
        label: fix.label,
        severity: fix.severity,
        fix: fix.fix,
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
        ? `Start with: ${fixes[0].draftTitle} — ${fixes[0].fix}`
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
