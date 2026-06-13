#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const QUALITY_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");
const COMPARISON_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-comparison-report.json");
const READINESS_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-readiness-report.json");
const DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-dry-run-report.json");
const ROLLBACK_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-rollback-plan.json");
const BACKUP_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-dry-run-report.json");
const CHECKLIST_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function gate(id, label, status, detail, source) {
  return {
    id,
    label,
    status,
    detail,
    source,
  };
}

function statusFromReport(report) {
  if (!report || !report.summary) return "not_run";
  return report.summary.status === "passed" ? "passed" : "blocked";
}

function main() {
  const quality = readJsonIfExists(QUALITY_FILE);
  const comparison = readJsonIfExists(COMPARISON_FILE);
  const readiness = readJsonIfExists(READINESS_FILE);
  const dryRun = readJsonIfExists(DRY_RUN_FILE);
  const rollback = readJsonIfExists(ROLLBACK_FILE);
  const backup = readJsonIfExists(BACKUP_FILE);

  const readinessSummary = readiness && readiness.summary ? readiness.summary : {};
  const dryRunSummary = dryRun && dryRun.summary ? dryRun.summary : {};
  const rollbackSummary = rollback && rollback.summary ? rollback.summary : {};
  const backupSummary = backup && backup.summary ? backup.summary : {};
  const readyDrafts = readinessSummary.readyDrafts || 0;
  const blockedDrafts = readinessSummary.blockedDrafts || 0;
  const plannedOps = dryRunSummary.plannedFileOperations || 0;

  const gates = [
    gate(
      "draft_quality",
      "Draft quality",
      statusFromReport(quality),
      quality && quality.summary
        ? `${quality.summary.ready || 0} ready, ${quality.summary.blocked || 0} blocked.`
        : "Draft quality report has not been generated yet.",
      "outputs/admin/draft-quality-report.json"
    ),
    gate(
      "draft_comparison",
      "Draft comparison",
      statusFromReport(comparison),
      comparison && comparison.summary
        ? `${comparison.summary.changedDrafts || 0} changed draft(s), ${comparison.summary.critical || 0} critical change(s).`
        : "Draft comparison report has not been generated yet.",
      "outputs/admin/draft-comparison-report.json"
    ),
    gate(
      "publish_readiness",
      "Publish readiness",
      statusFromReport(readiness),
      readiness
        ? `${readyDrafts} ready, ${blockedDrafts} blocked.`
        : "Publish readiness report has not been generated yet.",
      "outputs/admin/publish-readiness-report.json"
    ),
    gate(
      "publish_dry_run",
      "Publish dry run",
      statusFromReport(dryRun),
      dryRun
        ? `${plannedOps} planned file operation(s).`
        : "Publish dry-run report has not been generated yet.",
      "outputs/admin/publish-dry-run-report.json"
    ),
    gate(
      "rollback_plan",
      "Rollback plan",
      statusFromReport(rollback),
      rollback
        ? `${rollbackSummary.backupPaths || 0} backup path(s), ${rollbackSummary.restorePaths || 0} restore path(s).`
        : "Rollback plan has not been generated yet.",
      "outputs/admin/publish-rollback-plan.json"
    ),
    gate(
      "backup_plan",
      "Backup plan",
      statusFromReport(backup),
      backup
        ? `${backupSummary.files || 0} file(s) planned for backup.`
        : "Backup dry-run report has not been generated yet.",
      "outputs/admin/backup-snapshot-dry-run-report.json"
    ),
  ];

  const hasActivePublishWork = readyDrafts > 0 || blockedDrafts > 0 || plannedOps > 0;
  const blockedGates = gates.filter((item) => item.status === "blocked");
  const missingGates = gates.filter((item) => item.status === "not_run");

  let status = "idle";
  let nextAction = "No active draft is waiting for publish.";

  if (blockedGates.length > 0) {
    status = "blocked";
    nextAction = `Fix this first: ${blockedGates[0].label}. ${blockedGates[0].detail}`;
  } else if (missingGates.length > 0) {
    status = "review";
    nextAction = `Run the full control check to refresh: ${missingGates[0].label}.`;
  } else if (readyDrafts > 0 && plannedOps > 0) {
    status = "ready";
    nextAction = "Create a confirmed backup snapshot, review changed files, then publish only if everything still looks correct.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      gates: gates.length,
      passed: gates.filter((item) => item.status === "passed").length,
      blocked: blockedGates.length,
      notRun: missingGates.length,
      readyDrafts,
      blockedDrafts,
      plannedFileOperations: plannedOps,
      hasActivePublishWork,
    },
    nextAction,
    gates,
    humanReview: [
      "Open the draft preview and read it like a first-time visitor.",
      "Check title, meta description, intro, CTA, FAQ, and related links.",
      "Confirm sitemap.xml and llms.txt are regenerated in the dry-run plan.",
      "Confirm a backup snapshot exists before any confirmed publish.",
      "Review git diff before push so no unrelated file goes live.",
    ],
    guarantee:
      "Read-only pre-publish checklist. This script reads local reports and writes a local checklist only. It does not edit drafts, publish files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(CHECKLIST_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Pre-Publish Checklist");
  console.log("=====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Gates: ${report.summary.gates}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Not run: ${report.summary.notRun}`);
  console.log(`Report: ${relative(CHECKLIST_FILE)}`);
}

main();
