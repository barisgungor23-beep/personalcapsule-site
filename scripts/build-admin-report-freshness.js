#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_INDEX_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-index.json");
const FRESHNESS_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-freshness-report.json");
const STALE_AFTER_MINUTES = 10;

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function timestampValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function main() {
  const index = readJsonIfExists(REPORT_INDEX_FILE);
  const blockers = [];
  const warnings = [];

  if (!index || !Array.isArray(index.items)) {
    blockers.push({
      scope: "admin_report_index",
      message: "Admin report index is missing or invalid. Run build-admin-report-index.js first.",
    });
  }

  const items = index && Array.isArray(index.items) ? index.items : [];
  const generatedTimes = items
    .map((item) => timestampValue(item.generatedAt || item.modifiedAt))
    .filter((value) => value !== null);
  const newestTime = generatedTimes.length ? Math.max(...generatedTimes) : null;

  const freshness = items.map((item) => {
    const itemTime = timestampValue(item.generatedAt || item.modifiedAt);
    const ageMinutes = newestTime && itemTime ? Math.round((newestTime - itemTime) / 60000) : null;
    const stale = ageMinutes !== null && ageMinutes > STALE_AFTER_MINUTES;
    return {
      id: item.id,
      label: item.label,
      path: item.path,
      exists: item.exists,
      status: item.status,
      generatedAt: item.generatedAt,
      ageMinutes,
      freshness: !item.exists ? "missing" : stale ? "stale" : "fresh",
    };
  });

  const missing = freshness.filter((item) => item.freshness === "missing");
  const stale = freshness.filter((item) => item.freshness === "stale");

  if (stale.length > 0) {
    warnings.push({
      scope: "freshness",
      message: `${stale.length} report(s) look stale compared with the newest admin report.`,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      reports: freshness.length,
      fresh: freshness.filter((item) => item.freshness === "fresh").length,
      stale: stale.length,
      missing: missing.length,
      blockers: blockers.length,
      warnings: warnings.length,
      staleAfterMinutes: STALE_AFTER_MINUTES,
    },
    nextAction:
      blockers.length > 0
        ? "Regenerate the report index first."
        : stale.length > 0
          ? "Run the full control check to refresh stale reports."
          : "Reports are fresh enough to trust after the latest control check.",
    blockers,
    warnings,
    freshness,
    guarantee:
      "Read-only report freshness check. This script reads local admin report metadata and writes a local freshness report only. It does not edit content, publish files, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(FRESHNESS_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Report Freshness");
  console.log("======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Reports: ${report.summary.reports}`);
  console.log(`Fresh: ${report.summary.fresh}`);
  console.log(`Stale: ${report.summary.stale}`);
  console.log(`Missing: ${report.summary.missing}`);
  console.log(`Report: ${relative(FRESHNESS_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
