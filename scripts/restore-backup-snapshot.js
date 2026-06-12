#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const RESTORE_DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "restore-backup-dry-run-report.json");
const RESTORE_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "restore-backup-report.json");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/restore-backup-snapshot.js --confirm");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function isInsideRoot(filePath) {
  const resolvedRoot = `${ROOT}${path.sep}`;
  const resolvedPath = path.resolve(ROOT, filePath);
  return resolvedPath === ROOT || resolvedPath.startsWith(resolvedRoot);
}

function fileInfo(filePath) {
  const fullPath = path.join(ROOT, filePath);
  const stat = fs.statSync(fullPath);
  return {
    path: filePath,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function restoreFile(from, to) {
  const sourcePath = path.join(ROOT, from);
  const targetPath = path.join(ROOT, to);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return {
    from,
    to,
    restored: fileInfo(to),
  };
}

function main() {
  const confirmed = process.argv.includes("--confirm");
  if (!confirmed) {
    usage();
    console.error("Backup restore requires --confirm.");
    process.exitCode = 1;
    return;
  }

  const dryRun = readJsonIfExists(RESTORE_DRY_RUN_FILE);
  const blockers = [];
  const warnings = [];
  const restored = [];

  if (!dryRun) {
    blockers.push({
      scope: "system",
      message: "Restore dry-run report is missing. Run restore-backup-snapshot-dry-run.js first.",
    });
  } else if (!dryRun.summary || dryRun.summary.status !== "passed") {
    blockers.push({
      scope: "system",
      message: "Restore dry-run report did not pass.",
    });
  } else if (!Array.isArray(dryRun.restorePlan) || dryRun.restorePlan.length === 0) {
    warnings.push({
      scope: "system",
      message: "Restore dry-run has no restore operations. There is nothing to restore.",
    });
  } else {
    for (const item of dryRun.restorePlan) {
      if (!item.from || !item.to) {
        blockers.push({
          scope: "restorePlan",
          message: "Restore plan item is missing a source or target path.",
        });
        continue;
      }

      if (!isInsideRoot(item.from) || !isInsideRoot(item.to)) {
        blockers.push({
          scope: item.to,
          message: "Restore path is outside project root.",
        });
        continue;
      }

      const backupPath = path.join(ROOT, item.from);
      if (!fs.existsSync(backupPath)) {
        blockers.push({
          scope: item.from,
          message: "Backup file is missing.",
        });
      }
    }
  }

  if (blockers.length === 0 && dryRun && Array.isArray(dryRun.restorePlan)) {
    try {
      for (const item of dryRun.restorePlan) {
        restored.push(restoreFile(item.from, item.to));
      }
    } catch (error) {
      blockers.push({
        scope: "restore",
        message: error.message,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "confirmed_restore",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      filesRestored: restored.length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    restored,
    guarantee:
      "Local restore only. This script copies files from outputs/backups back into local project files. It does not commit to Git, push to GitHub, deploy to Cloudflare, publish content, or delete backups.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESTORE_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Backup Restore");
  console.log("==============================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Files restored: ${report.summary.filesRestored}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(RESTORE_REPORT_FILE)}`);
  console.log("No Git commit, push, or Cloudflare deploy was performed.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
