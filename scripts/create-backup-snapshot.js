#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const BACKUPS_DIR = path.join(ROOT, "outputs", "backups");
const DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-dry-run-report.json");
const SNAPSHOT_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-report.json");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/create-backup-snapshot.js --confirm");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function copyIntoSnapshot(snapshotDir, filePath) {
  const sourcePath = path.join(ROOT, filePath);
  const targetPath = path.join(snapshotDir, filePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  const stat = fs.statSync(targetPath);
  return {
    source: filePath,
    backup: relative(targetPath),
    sizeBytes: stat.size,
  };
}

function main() {
  const confirmed = process.argv.includes("--confirm");
  if (!confirmed) {
    usage();
    console.error("Backup snapshot creation requires --confirm.");
    process.exitCode = 1;
    return;
  }

  const dryRun = readJsonIfExists(DRY_RUN_FILE);
  const blockers = [];
  const warnings = [];
  const copied = [];

  if (!dryRun) {
    blockers.push({
      scope: "system",
      message: "Backup snapshot dry-run report is missing. Run full control check first.",
    });
  } else if (dryRun.summary.status !== "passed") {
    blockers.push({
      scope: "system",
      message: "Backup snapshot dry-run did not pass.",
    });
  } else if (!Array.isArray(dryRun.files) || dryRun.files.length === 0) {
    warnings.push({
      scope: "system",
      message: "No files need a backup snapshot right now because there are no ready drafts.",
    });
  } else {
    const snapshotId = timestamp();
    const snapshotDir = path.join(BACKUPS_DIR, snapshotId);

    for (const item of dryRun.files) {
      const sourcePath = path.join(ROOT, item.path);
      if (!fs.existsSync(sourcePath)) {
        blockers.push({
          scope: item.path,
          message: "Source file disappeared before backup snapshot could be created.",
        });
        continue;
      }
      copied.push(copyIntoSnapshot(snapshotDir, item.path));
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "confirmed_backup_snapshot",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      filesCopied: copied.length,
      totalBytes: copied.reduce((total, item) => total + item.sizeBytes, 0),
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    copied,
    guarantee:
      "Backup only. This script copies files into outputs/backups. It does not publish, overwrite source files, delete files, commit, deploy, or restore anything.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Backup Snapshot");
  console.log("==============================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Files copied: ${report.summary.filesCopied}`);
  console.log(`Total bytes: ${report.summary.totalBytes}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(SNAPSHOT_REPORT_FILE)}`);
  console.log("No files were published.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
