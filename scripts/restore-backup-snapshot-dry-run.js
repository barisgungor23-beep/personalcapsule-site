#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const SNAPSHOT_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-report.json");
const RESTORE_DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "restore-backup-dry-run-report.json");

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

function main() {
  const snapshot = readJsonIfExists(SNAPSHOT_REPORT_FILE);
  const blockers = [];
  const warnings = [];
  const restorePlan = [];

  if (!snapshot) {
    blockers.push({
      scope: "system",
      message: "Backup snapshot report is missing. Create a confirmed backup snapshot first.",
    });
  } else if (snapshot.summary.status !== "passed") {
    blockers.push({
      scope: "system",
      message: "Backup snapshot report did not pass.",
    });
  } else if (!Array.isArray(snapshot.copied) || snapshot.copied.length === 0) {
    warnings.push({
      scope: "system",
      message: "Backup snapshot has no copied files. There is nothing to restore.",
    });
  } else {
    for (const item of snapshot.copied) {
      if (!isInsideRoot(item.source) || !isInsideRoot(item.backup)) {
        blockers.push({
          scope: item.source || item.backup || "unknown",
          message: "Restore path is outside project root.",
        });
        continue;
      }

      const backupPath = path.join(ROOT, item.backup);
      const targetPath = path.join(ROOT, item.source);

      if (!fs.existsSync(backupPath)) {
        blockers.push({
          scope: item.backup,
          message: "Backup file is missing.",
        });
        continue;
      }

      const targetExists = fs.existsSync(targetPath);
      restorePlan.push({
        from: item.backup,
        to: item.source,
        backup: fileInfo(item.backup),
        currentTarget: targetExists ? fileInfo(item.source) : null,
        targetExists,
        action: targetExists ? "would_overwrite_target" : "would_recreate_missing_target",
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry_run",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      restoreOperations: restorePlan.length,
      missingTargets: restorePlan.filter((item) => !item.targetExists).length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    restorePlan,
    guarantee:
      "Dry-run only. This script does not restore, copy, overwrite, delete, commit, deploy, or publish anything.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESTORE_DRY_RUN_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Restore Backup Dry Run");
  console.log("======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Restore operations: ${report.summary.restoreOperations}`);
  console.log(`Missing targets: ${report.summary.missingTargets}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(RESTORE_DRY_RUN_FILE)}`);
  console.log("No files were restored.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
