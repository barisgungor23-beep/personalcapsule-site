#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-wizard-report.json");

const DRAFT_QUALITY_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");
const DRAFT_COMPARISON_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-comparison-report.json");
const PUBLISH_READINESS_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-readiness-report.json");
const PUBLISH_DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-dry-run-report.json");
const PUBLISH_ROLLBACK_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-rollback-plan.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const BACKUP_RESTORE_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-restore-center-report.json");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function summaryOf(report) {
  return report && report.summary ? report.summary : {};
}

function step(id, label, status, detail, source, action) {
  return {
    id,
    label,
    status,
    detail,
    source,
    action,
  };
}

function statusFromReport(report) {
  if (!report) return "not_run";
  const summary = summaryOf(report);
  if (summary.status === "failed" || summary.status === "blocked") return "blocked";
  if (summary.status === "review" || summary.status === "backup_needed") return "review";
  if (summary.status === "ready") return "ready";
  if (summary.status === "restore_available") return "passed";
  if (summary.status === "idle") return "idle";
  if (summary.status === "passed") return "passed";
  return "review";
}

function main() {
  const draftQuality = readJsonIfExists(DRAFT_QUALITY_FILE);
  const draftComparison = readJsonIfExists(DRAFT_COMPARISON_FILE);
  const publishReadiness = readJsonIfExists(PUBLISH_READINESS_FILE);
  const publishDryRun = readJsonIfExists(PUBLISH_DRY_RUN_FILE);
  const publishRollback = readJsonIfExists(PUBLISH_ROLLBACK_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const backupRestore = readJsonIfExists(BACKUP_RESTORE_FILE);
  const control = readJsonIfExists(CONTROL_FILE);

  const qualitySummary = summaryOf(draftQuality);
  const comparisonSummary = summaryOf(draftComparison);
  const readinessSummary = summaryOf(publishReadiness);
  const dryRunSummary = summaryOf(publishDryRun);
  const rollbackSummary = summaryOf(publishRollback);
  const prePublishSummary = summaryOf(prePublish);
  const backupSummary = summaryOf(backupRestore);
  const controlSummary = summaryOf(control);

  const readyDrafts = readinessSummary.readyDrafts || prePublishSummary.readyDrafts || 0;
  const blockedDrafts = readinessSummary.blockedDrafts || prePublishSummary.blockedDrafts || 0;
  const plannedFileOperations = dryRunSummary.plannedFileOperations || prePublishSummary.plannedFileOperations || 0;
  const hasActivePublishWork = readyDrafts > 0 || blockedDrafts > 0 || plannedFileOperations > 0;

  const steps = [
    step(
      "draft_quality",
      "Draft quality",
      statusFromReport(draftQuality),
      `${qualitySummary.ready || 0} ready, ${qualitySummary.blocked || 0} blocked, ${qualitySummary.warnings || 0} warning(s).`,
      "outputs/admin/draft-quality-report.json",
      "Fix draft quality issues before publish."
    ),
    step(
      "draft_comparison",
      "Draft comparison",
      statusFromReport(draftComparison),
      `${comparisonSummary.changedDrafts || 0} changed draft(s), ${comparisonSummary.critical || 0} critical change(s).`,
      "outputs/admin/draft-comparison-report.json",
      "Confirm the draft changes match your intent."
    ),
    step(
      "publish_readiness",
      "Publish readiness",
      statusFromReport(publishReadiness),
      `${readyDrafts} ready draft(s), ${blockedDrafts} blocked draft(s).`,
      "outputs/admin/publish-readiness-report.json",
      "Only continue when blocked drafts are zero."
    ),
    step(
      "publish_dry_run",
      "Publish dry-run",
      statusFromReport(publishDryRun),
      `${plannedFileOperations} planned file operation(s).`,
      "outputs/admin/publish-dry-run-report.json",
      "Review every planned file before confirmed publish."
    ),
    step(
      "rollback_plan",
      "Rollback plan",
      statusFromReport(publishRollback),
      `${rollbackSummary.backupPaths || 0} backup path(s), ${rollbackSummary.restorePaths || 0} restore path(s).`,
      "outputs/admin/publish-rollback-plan.json",
      "A rollback plan should exist before confirmed publish."
    ),
    step(
      "backup_restore",
      "Backup / restore",
      statusFromReport(backupRestore),
      `Backup copied: ${backupSummary.copiedFiles || 0}, restore ops: ${backupSummary.restoreOperations || 0}.`,
      "outputs/admin/backup-restore-center-report.json",
      "Create a confirmed backup before confirmed publish."
    ),
    step(
      "final_control",
      "Final control check",
      statusFromReport(control),
      `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed.`,
      "outputs/admin/control-report.json",
      "Run the full control check immediately before and after publish."
    ),
  ];

  const blocked = steps.filter((item) => item.status === "blocked" || item.status === "not_run");
  const review = steps.filter((item) => item.status === "review");
  const ready = steps.filter((item) => item.status === "ready" || item.status === "passed" || item.status === "idle");

  let status = "idle";
  let currentStep = "create_or_prepare_draft";
  let nextAction = "No active draft is waiting for publish. Create or edit a draft first.";

  if (blocked.length > 0) {
    status = "blocked";
    currentStep = blocked[0].id;
    nextAction = `Fix this publish step first: ${blocked[0].label}. ${blocked[0].detail}`;
  } else if (hasActivePublishWork && review.length > 0) {
    status = "review";
    currentStep = review[0].id;
    nextAction = `Review this publish step before continuing: ${review[0].label}. ${review[0].detail}`;
  } else if (readyDrafts > 0 && plannedFileOperations > 0 && backupSummary.confirmedBackupAvailable) {
    status = "ready_for_human_publish_review";
    currentStep = "final_human_review";
    nextAction = "All wizard checks are ready. Do a final human review before confirmed publish.";
  } else if (readyDrafts > 0 || plannedFileOperations > 0) {
    status = "backup_or_review_needed";
    currentStep = "backup_restore";
    nextAction = "A draft appears ready, but backup and final review must be confirmed before publish.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      currentStep,
      steps: steps.length,
      readySteps: ready.length,
      reviewSteps: review.length,
      blockedSteps: blocked.length,
      readyDrafts,
      blockedDrafts,
      plannedFileOperations,
      hasActivePublishWork,
    },
    nextAction,
    steps,
    finalSafetyRules: [
      "Do not confirmed-publish from the wizard. The wizard is read-only guidance.",
      "Confirmed publish requires dry-run, rollback plan, backup, and human review.",
      "After confirmed publish, run the full control check again.",
      "Before push, review Git Status, Push Package, and Deployment Readiness.",
    ],
    sources: [
      relative(DRAFT_QUALITY_FILE),
      relative(DRAFT_COMPARISON_FILE),
      relative(PUBLISH_READINESS_FILE),
      relative(PUBLISH_DRY_RUN_FILE),
      relative(PUBLISH_ROLLBACK_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(BACKUP_RESTORE_FILE),
      relative(CONTROL_FILE),
    ],
    guarantee:
      "Read-only publish wizard. This script reads local admin reports and writes local publish guidance only. It does not edit drafts, publish files, copy backups, restore files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Publish Wizard");
  console.log("==============================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Current step: ${report.summary.currentStep}`);
  console.log(`Ready drafts: ${report.summary.readyDrafts}`);
  console.log(`Planned operations: ${report.summary.plannedFileOperations}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (status === "blocked") {
    process.exitCode = 1;
  }
}

main();
