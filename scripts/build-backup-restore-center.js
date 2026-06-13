#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-restore-center-report.json");

const PUBLISH_ROLLBACK_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-rollback-plan.json");
const BACKUP_DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-dry-run-report.json");
const BACKUP_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-report.json");
const RESTORE_DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "restore-backup-dry-run-report.json");
const RESTORE_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "restore-backup-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function statusOf(report) {
  if (!report) return "missing";
  if (report.summary && report.summary.status) return report.summary.status;
  if (report.summary && report.summary.overallStatus) return report.summary.overallStatus;
  if (report.mode) return report.mode;
  return "present";
}

function numberFrom(report, key) {
  return report && report.summary && Number.isFinite(Number(report.summary[key])) ? Number(report.summary[key]) : 0;
}

function backupCopiedCount(report) {
  if (!report) return 0;
  if (report.summary && Number.isFinite(Number(report.summary.copiedFiles))) return Number(report.summary.copiedFiles);
  if (report.summary && Number.isFinite(Number(report.summary.filesCopied))) return Number(report.summary.filesCopied);
  if (Array.isArray(report.copiedFiles)) return report.copiedFiles.length;
  if (Array.isArray(report.copied)) return report.copied.length;
  return 0;
}

function collectProblems(report, type, scope) {
  if (!report) return [];
  const items = Array.isArray(report[type]) ? report[type] : [];
  return items.map((item) => ({
    scope,
    message: typeof item === "string" ? item : item.message || item.reason || JSON.stringify(item),
  }));
}

function backupFolder(report) {
  if (!report) return null;
  if (report.backupRoot) return report.backupRoot;
  if (report.summary && report.summary.backupRoot) return report.summary.backupRoot;

  const copied = Array.isArray(report.copiedFiles) ? report.copiedFiles : [];
  const legacyCopied = Array.isArray(report.copied) ? report.copied : [];
  const firstCopy = [...copied, ...legacyCopied].find((item) => item.to || item.backup);
  if (!firstCopy) return null;
  const backupPath = firstCopy.to || firstCopy.backup;
  const parts = backupPath.split("/");
  const backupIndex = parts.indexOf("backups");
  if (backupIndex === -1 || parts.length <= backupIndex + 1) return null;
  return parts.slice(0, backupIndex + 2).join("/");
}

function main() {
  const rollback = readJsonIfExists(PUBLISH_ROLLBACK_FILE);
  const backupDryRun = readJsonIfExists(BACKUP_DRY_RUN_FILE);
  const backupReport = readJsonIfExists(BACKUP_REPORT_FILE);
  const restoreDryRun = readJsonIfExists(RESTORE_DRY_RUN_FILE);
  const restoreReport = readJsonIfExists(RESTORE_REPORT_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);

  const blockers = [
    ...collectProblems(backupDryRun, "blockers", "backup_dry_run"),
    ...collectProblems(restoreDryRun, "blockers", "restore_dry_run"),
  ];
  const warnings = [
    ...collectProblems(rollback, "warnings", "publish_rollback"),
    ...collectProblems(backupDryRun, "warnings", "backup_dry_run"),
    ...collectProblems(restoreDryRun, "warnings", "restore_dry_run"),
  ];

  if (!rollback) {
    warnings.push({
      scope: "publish_rollback",
      message: "Publish rollback plan is missing. Run the full control check before publishing.",
    });
  }

  if (!backupDryRun) {
    warnings.push({
      scope: "backup_dry_run",
      message: "Backup dry-run report is missing. Run the full control check before publishing.",
    });
  }

  if (!restoreDryRun) {
    warnings.push({
      scope: "restore_dry_run",
      message: "Restore dry-run report is missing. This is acceptable until a confirmed backup exists.",
    });
  }

  const rollbackBackupPaths = numberFrom(rollback, "backupPaths");
  const readyToPublish =
    prePublish && prePublish.summary && (prePublish.summary.status === "ready" || prePublish.summary.status === "review");
  const backupFilesPlanned = numberFrom(backupDryRun, "files");
  const backupBytesPlanned = numberFrom(backupDryRun, "totalBytes");
  const copiedFiles = backupCopiedCount(backupReport);
  const restoreOperations = numberFrom(restoreDryRun, "restoreOperations");
  const missingTargets = numberFrom(restoreDryRun, "missingTargets");
  const confirmedBackupAvailable = Boolean(backupReport && copiedFiles > 0);
  const restoreResultAvailable = Boolean(restoreReport);
  const backupNeeded = readyToPublish || rollbackBackupPaths > 0 || backupFilesPlanned > 0;

  let status = "idle";
  let nextAction = "No backup action needed right now.";

  if (blockers.length > 0) {
    status = "blocked";
    nextAction = `Fix this first: ${blockers[0].message}`;
  } else if (backupNeeded && !confirmedBackupAvailable) {
    status = "backup_needed";
    nextAction = "Create a confirmed backup snapshot before publish.";
  } else if (confirmedBackupAvailable && restoreOperations > 0) {
    status = "restore_available";
    nextAction = "Use restore dry-run before any confirmed restore.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      backupDryRunStatus: statusOf(backupDryRun),
      backupFilesPlanned,
      backupBytesPlanned,
      confirmedBackupAvailable,
      copiedFiles,
      restoreDryRunStatus: statusOf(restoreDryRun),
      restoreOperations,
      missingTargets,
      restoreResultAvailable,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    nextAction,
    backupState: {
      rollbackPlanStatus: statusOf(rollback),
      rollbackBackupPaths,
      backupDryRunReport: backupDryRun ? relative(BACKUP_DRY_RUN_FILE) : null,
      confirmedBackupReport: backupReport ? relative(BACKUP_REPORT_FILE) : null,
      confirmedBackupFolder: backupFolder(backupReport),
      backupNeeded,
    },
    restoreState: {
      restoreDryRunReport: restoreDryRun ? relative(RESTORE_DRY_RUN_FILE) : null,
      confirmedRestoreReport: restoreReport ? relative(RESTORE_REPORT_FILE) : null,
      restoreOperations,
      missingTargets,
      restoreResultAvailable,
    },
    blockers,
    warnings,
    safetyRules: [
      "Never publish without a clean full control check.",
      "Create a confirmed backup snapshot before confirmed publish.",
      "Run restore dry-run before confirmed restore.",
      "Do not restore from a backup folder unless you recognize the timestamp and planned target files.",
      "Keep Git status clean except intentionally ignored local files before deploy.",
    ],
    guarantee:
      "Read-only backup and restore center. This script reads local admin reports and writes a local status summary only. It does not copy, restore, edit, delete, publish, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Backup / Restore Center");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Backup files planned: ${report.summary.backupFilesPlanned}`);
  console.log(`Confirmed backup available: ${report.summary.confirmedBackupAvailable ? "yes" : "no"}`);
  console.log(`Restore operations: ${report.summary.restoreOperations}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (status === "blocked") {
    process.exitCode = 1;
  }
}

main();
