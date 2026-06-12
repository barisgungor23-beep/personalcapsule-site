#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const ROLLBACK_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-rollback-plan.json");
const SNAPSHOT_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-dry-run-report.json");

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

function expandPath(pattern) {
  if (!pattern.includes("*")) {
    const fullPath = path.join(ROOT, pattern);
    return fs.existsSync(fullPath) ? [pattern] : [];
  }

  const directory = path.dirname(pattern);
  const basename = path.basename(pattern);
  if (basename !== "*.html") return [];

  const fullDirectory = path.join(ROOT, directory);
  if (!fs.existsSync(fullDirectory)) return [];

  return fs
    .readdirSync(fullDirectory)
    .filter((name) => name.endsWith(".html"))
    .sort()
    .map((name) => `${directory}/${name}`.replace(/\\/g, "/"));
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
  const rollback = readJsonIfExists(ROLLBACK_FILE);
  const blockers = [];
  const warnings = [];
  const snapshotItems = [];

  if (!rollback) {
    blockers.push({
      scope: "system",
      message: "Rollback plan is missing. Run plan-publish-rollback before backup snapshot dry-run.",
    });
  } else if (rollback.summary.status !== "passed") {
    blockers.push({
      scope: "system",
      message: "Rollback plan did not pass. Backup snapshot dry-run cannot be trusted yet.",
    });
  } else {
    for (const item of rollback.backupBeforePublish || []) {
      if (!isInsideRoot(item.path)) {
        blockers.push({
          scope: item.path,
          message: "Backup path is outside project root.",
        });
        continue;
      }

      const expanded = expandPath(item.path);
      if (expanded.length === 0) {
        warnings.push({
          scope: item.path,
          message: "Backup path does not currently exist or wildcard matched no files.",
        });
        continue;
      }

      for (const filePath of expanded) {
        snapshotItems.push({
          ...fileInfo(filePath),
          sourcePattern: item.path,
          reason: item.reason,
        });
      }
    }
  }

  const uniqueItems = Array.from(new Map(snapshotItems.map((item) => [item.path, item])).values());
  const totalBytes = uniqueItems.reduce((total, item) => total + item.sizeBytes, 0);

  if (uniqueItems.length === 0 && blockers.length === 0) {
    warnings.push({
      scope: "system",
      message: "No files need a backup snapshot right now because there are no ready drafts.",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry_run",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      files: uniqueItems.length,
      totalBytes,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    files: uniqueItems,
    guarantee:
      "Dry-run only. This script does not create backup folders, copy files, overwrite files, delete files, commit, deploy, or restore anything.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Backup Snapshot Dry Run");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Files: ${report.summary.files}`);
  console.log(`Total bytes: ${report.summary.totalBytes}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(SNAPSHOT_FILE)}`);
  console.log("No backup files were created.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
