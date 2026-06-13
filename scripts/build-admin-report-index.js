#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const INDEX_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-index.json");

const reports = [
  ["admin_read_model", "Admin read model", "admin-read-model.json"],
  ["control", "Full control report", "control-report.json"],
  ["home_brief", "Admin home brief", "admin-home-brief-report.json"],
  ["dashboard_snapshot", "Admin dashboard snapshot", "admin-dashboard-snapshot-report.json"],
  ["system_overview", "Admin system overview", "admin-system-overview-report.json"],
  ["failure_playbook", "Admin failure playbook", "admin-failure-playbook-report.json"],
  ["dependency_map", "Admin dependency map", "admin-dependency-map-report.json"],
  ["report_detail_viewer", "Admin report detail viewer", "admin-report-detail-viewer-report.json"],
  ["quick_start", "Admin quick start", "admin-quick-start-report.json"],
  ["command_guide", "Admin command guide", "admin-command-guide-report.json"],
  ["action_flow", "Admin action flow", "admin-action-flow-report.json"],
  ["operations_manual", "Admin operations manual", "admin-operations-manual-report.json"],
  ["git_status", "Git status", "git-status-report.json"],
  ["push_package", "Push package", "push-package-report.json"],
  ["deployment_readiness", "Deployment readiness", "deployment-readiness-report.json"],
  ["draft_quality", "Draft quality", "draft-quality-report.json"],
  ["draft_fix_list", "Draft fix list", "draft-fix-list-report.json"],
  ["draft_edit_plan", "Draft edit plan", "draft-edit-plan-report.json"],
  ["draft_edit_guide", "Draft edit guide", "draft-edit-guide-report.json"],
  ["draft_comparison", "Draft comparison", "draft-comparison-report.json"],
  ["publish_readiness", "Publish readiness", "publish-readiness-report.json"],
  ["publish_dry_run", "Publish dry run", "publish-dry-run-report.json"],
  ["publish_rollback", "Publish rollback plan", "publish-rollback-plan.json"],
  ["backup_dry_run", "Backup snapshot dry run", "backup-snapshot-dry-run-report.json"],
  ["pre_publish", "Pre-publish checklist", "pre-publish-checklist-report.json"],
  ["draft_publish_simulation", "Draft publish simulation summary", "draft-publish-simulation-summary-report.json"],
  ["backup_restore_center", "Backup / Restore Center", "backup-restore-center-report.json"],
  ["restore_dry_run", "Restore dry run", "restore-backup-dry-run-report.json"],
  ["publish_result", "Publish result", "publish-report.json"],
  ["restore_result", "Restore result", "restore-backup-report.json"],
  ["backup_result", "Backup result", "backup-snapshot-report.json"],
];

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function fileInfo(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function summaryStatus(report) {
  if (!report) return "missing";
  if (report.summary && report.summary.overallStatus) return report.summary.overallStatus;
  if (report.summary && report.summary.status) return report.summary.status;
  if (report.mode) return report.mode;
  return "present";
}

function main() {
  const items = reports.map(([id, label, fileName]) => {
    const filePath = path.join(ADMIN_OUTPUT_DIR, fileName);
    const info = fileInfo(filePath);
    const report = readJsonIfExists(filePath);

    return {
      id,
      label,
      path: relative(filePath),
      exists: Boolean(info),
      status: summaryStatus(report),
      generatedAt: report && report.generatedAt ? report.generatedAt : null,
      modifiedAt: info ? info.modifiedAt : null,
      sizeBytes: info ? info.sizeBytes : 0,
    };
  });

  const missing = items.filter((item) => !item.exists);
  const review = items.filter((item) => ["review", "action_needed", "not_ready"].includes(item.status));
  const blocked = items.filter((item) => ["failed", "blocked"].includes(item.status));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blocked.length > 0 ? "review" : "passed",
      reports: items.length,
      existing: items.filter((item) => item.exists).length,
      missing: missing.length,
      review: review.length,
      blocked: blocked.length,
    },
    items,
    nextAction:
      blocked.length > 0
        ? `Review blocked report first: ${blocked[0].label}.`
        : review.length > 0
          ? `Review report status before deploy: ${review[0].label}.`
          : missing.length > 0
            ? `Missing report is acceptable only if its workflow has never been used: ${missing[0].label}.`
            : "All tracked reports exist and have no blocked status.",
    guarantee:
      "Read-only report index. This script reads local admin reports and writes a local index only. It does not edit content, publish files, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Report Index");
  console.log("==================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Reports: ${report.summary.reports}`);
  console.log(`Existing: ${report.summary.existing}`);
  console.log(`Missing: ${report.summary.missing}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Report: ${relative(INDEX_FILE)}`);

  if (blocked.length > 0) {
    process.exitCode = 1;
  }
}

main();
