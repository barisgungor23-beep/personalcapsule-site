#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_INDEX_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-index.json");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-detail-viewer-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === "number") return value;
  }
  return 0;
}

function summaryStatus(report) {
  if (!report) return "missing";
  if (report.summary && report.summary.overallStatus) return report.summary.overallStatus;
  if (report.summary && report.summary.status) return report.summary.status;
  if (report.mode) return report.mode;
  return "present";
}

function firstReadableDetail(report, item) {
  if (!report) return "Report file does not exist yet.";
  const summary = report.summary || {};

  if (report.nextAction) return report.nextAction;
  if (report.recommendedAction) return report.recommendedAction;
  if (summary.firstAction) return summary.firstAction;
  if (summary.firstFailedStep) return `First failed step: ${summary.firstFailedStep}.`;
  if (Array.isArray(report.blockers) && report.blockers.length > 0) return report.blockers[0].message || "A blocker needs review.";
  if (Array.isArray(report.warnings) && report.warnings.length > 0) return report.warnings[0].message || "A warning needs review.";
  if (Array.isArray(report.actions) && report.actions.length > 0) return report.actions[0].detail || report.actions[0].title;
  if (Array.isArray(report.gates) && report.gates.length > 0) return report.gates[0].detail || report.gates[0].label;
  if (Array.isArray(report.checks) && report.checks.length > 0) return report.checks[0].detail || report.checks[0].label;
  if (Array.isArray(report.items) && report.items.length > 0) return `${report.items.length} item(s) are listed in this report.`;
  return `${item.label} is available and has no urgent message.`;
}

function reportImportance(item) {
  const critical = new Set([
    "control",
    "deployment_readiness",
    "git_status",
    "push_package",
    "pre_publish",
    "publish_readiness",
    "publish_dry_run",
    "failure_playbook",
  ]);
  const medium = new Set([
    "admin_read_model",
    "system_overview",
    "dependency_map",
    "draft_quality",
    "draft_fix_list",
    "draft_edit_plan",
    "draft_edit_guide",
    "draft_comparison",
    "backup_dry_run",
    "publish_rollback",
  ]);

  if (critical.has(item.id)) return "high";
  if (medium.has(item.id)) return "medium";
  return "normal";
}

function whyItMatters(item) {
  const explanations = {
    control: "This is the main safety result. If it fails, the admin panel should not be trusted for publish decisions.",
    deployment_readiness: "This tells whether local work is safe to send toward GitHub and Cloudflare.",
    git_status: "This shows whether there are changed or untracked files that need human review.",
    push_package: "This shows which local commits would be sent to GitHub.",
    pre_publish: "This protects draft publishing by checking readiness, backup, rollback, and human review gates.",
    publish_readiness: "This tells whether a draft is actually ready to enter the publish flow.",
    publish_dry_run: "This shows what would change before the real publish command touches live files.",
    failure_playbook: "This gives the first response path when something looks wrong.",
    dependency_map: "This explains how admin reports depend on each other.",
    admin_read_model: "This is the structured model that the admin preview reads.",
    system_overview: "This gives the founder-level health summary.",
  };

  return explanations[item.id] || "This report supports local review and keeps the admin workflow understandable.";
}

function main() {
  const index = readJsonIfExists(REPORT_INDEX_FILE);
  const blockers = [];
  const warnings = [];

  if (!index) {
    blockers.push({
      scope: "report_index",
      message: "Admin report index is missing. Run build-admin-report-index.js first.",
    });
  }

  const items = index && Array.isArray(index.items) ? index.items : [];
  const details = items.map((item) => {
    const reportPath = path.join(ROOT, item.path);
    const report = readJsonIfExists(reportPath);
    const summary = report && report.summary ? report.summary : {};
    const isCurrentReport = item.id === "report_detail_viewer";
    const exists = item.exists || isCurrentReport;

    return {
      id: item.id,
      label: item.label,
      path: item.path,
      exists,
      status: isCurrentReport && !report ? "generating" : summaryStatus(report),
      importance: reportImportance(item),
      generatedAt: report && report.generatedAt ? report.generatedAt : item.generatedAt || null,
      modifiedAt: item.modifiedAt || null,
      sizeBytes: item.sizeBytes || 0,
      primaryDetail: isCurrentReport && !report ? "This report is being generated now." : firstReadableDetail(report, item),
      whyItMatters: whyItMatters(item),
      counts: {
        blockers: firstNumber(summary.blockers, report && Array.isArray(report.blockers) ? report.blockers.length : undefined),
        warnings: firstNumber(summary.warnings, report && Array.isArray(report.warnings) ? report.warnings.length : undefined),
        review: firstNumber(summary.review),
        missing: firstNumber(summary.missing, summary.missingOutputs),
        failed: firstNumber(summary.failedSteps),
        passed: firstNumber(summary.passedSteps, summary.passed),
      },
    };
  });

  const highImportanceReview = details.filter((item) => item.importance === "high" && item.status !== "passed" && item.status !== "ready" && item.status !== "clean");
  const missing = details.filter((item) => !item.exists);

  if (missing.length > 0) {
    warnings.push({
      scope: "missing_reports",
      message: `${missing.length} report(s) are missing. This is acceptable only when that workflow has not been used yet.`,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      reports: details.length,
      highImportance: details.filter((item) => item.importance === "high").length,
      highImportanceReview: highImportanceReview.length,
      missing: missing.length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    details,
    nextAction:
      highImportanceReview.length > 0
        ? `Review high-importance report first: ${highImportanceReview[0].label}.`
        : missing.length > 0
          ? `Missing report is acceptable only if unused: ${missing[0].label}.`
          : "Report details are available. Use this viewer when a panel card needs more context.",
    guarantee:
      "Read-only report detail viewer. This script reads local admin reports and writes a local detail summary only. It does not edit content, publish files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Report Detail Viewer");
  console.log("===========================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Reports: ${report.summary.reports}`);
  console.log(`High-importance: ${report.summary.highImportance}`);
  console.log(`High-importance review: ${report.summary.highImportanceReview}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
