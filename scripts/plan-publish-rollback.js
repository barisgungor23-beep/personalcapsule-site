#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-dry-run-report.json");
const ROLLBACK_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-rollback-plan.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function uniqueByPath(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

function main() {
  const dryRun = readJsonIfExists(DRY_RUN_FILE);
  const blockers = [];
  const warnings = [];
  const backupBeforePublish = [];
  const restoreIfNeeded = [];

  if (!dryRun) {
    blockers.push({
      scope: "system",
      message: "Publish dry-run report is missing. Run publish dry-run before rollback planning.",
    });
  } else if (dryRun.summary.status !== "passed") {
    blockers.push({
      scope: "system",
      message: "Publish dry-run did not pass. Rollback plan cannot be trusted yet.",
    });
  } else {
    for (const item of dryRun.plan || []) {
      for (const operation of item.wouldUpdate || []) {
        backupBeforePublish.push({
          path: operation.to,
          reason: `Backup before ${operation.type} publish operation.`,
        });
        restoreIfNeeded.push({
          path: operation.to,
          reason: `Restore previous version if ${operation.type} publish result is wrong.`,
        });
      }

      for (const cleanup of item.wouldRemoveAfterPublish || []) {
        backupBeforePublish.push({
          path: cleanup.path,
          reason: "Keep a copy before cleanup in case the published result must be reviewed again.",
        });
        restoreIfNeeded.push({
          path: cleanup.path,
          reason: "Restore draft artifact if a publish needs to be inspected or retried.",
        });
      }
    }
  }

  if (backupBeforePublish.length === 0 && blockers.length === 0) {
    warnings.push({
      scope: "system",
      message: "No ready drafts. No rollback backup paths are needed right now.",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "plan_only",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      backupPaths: uniqueByPath(backupBeforePublish).length,
      restorePaths: uniqueByPath(restoreIfNeeded).length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    backupBeforePublish: uniqueByPath(backupBeforePublish),
    restoreIfNeeded: uniqueByPath(restoreIfNeeded),
    recommendedProcedure: [
      "Run the full control check.",
      "Review publish readiness.",
      "Review publish dry-run report.",
      "Create a backup snapshot of every listed path before real publish.",
      "Publish only after all blockers are zero.",
      "If the published result is wrong, restore the listed paths from the backup snapshot and run the full control check again.",
    ],
    guarantee:
      "Plan only. This script does not copy, overwrite, delete, commit, deploy, or restore files.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(ROLLBACK_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Publish Rollback Plan");
  console.log("=====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Backup paths: ${report.summary.backupPaths}`);
  console.log(`Restore paths: ${report.summary.restorePaths}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(ROLLBACK_FILE)}`);
  console.log("No files were copied, restored, or published.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
