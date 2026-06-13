#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const REPORT_INDEX_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-index.json");
const REPORT_FRESHNESS_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-freshness-report.json");
const GIT_STATUS_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-failure-playbook-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function addAction(actions, priority, scope, status, title, detail, source, command) {
  actions.push({ priority, scope, status, title, detail, source, command });
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const reportIndex = readJsonIfExists(REPORT_INDEX_FILE);
  const freshness = readJsonIfExists(REPORT_FRESHNESS_FILE);
  const gitStatus = readJsonIfExists(GIT_STATUS_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);

  const actions = [];
  const controlSummary = control && control.summary ? control.summary : {};
  const reportIndexSummary = reportIndex && reportIndex.summary ? reportIndex.summary : {};
  const freshnessSummary = freshness && freshness.summary ? freshness.summary : {};
  const gitSummary = gitStatus && gitStatus.summary ? gitStatus.summary : {};
  const pushSummary = pushPackage && pushPackage.summary ? pushPackage.summary : {};
  const deploymentSummary = deployment && deployment.summary ? deployment.summary : {};
  const prePublishSummary = prePublish && prePublish.summary ? prePublish.summary : {};

  if (!control) {
    addAction(actions, 1, "control", "blocked", "Full control report is missing", "Run the full control check first. Without this report, the panel cannot know whether the site is safe.", "outputs/admin/control-report.json", "node scripts/run-admin-control-check.js");
  } else if (controlSummary.status !== "passed") {
    addAction(actions, 1, "control", "blocked", "Full control check failed", `Start with the first failed step: ${controlSummary.firstFailedStep || "unknown"}.`, "outputs/admin/control-report.json", "node scripts/run-admin-control-check.js");
  }

  if (!reportIndex) {
    addAction(actions, 2, "report_index", "review", "Report index is missing", "Build the report index so every admin report is visible from one place.", "outputs/admin/admin-report-index.json", "node scripts/build-admin-report-index.js");
  } else if (reportIndexSummary.blocked > 0) {
    addAction(actions, 2, "report_index", "blocked", "A tracked admin report is blocked", reportIndex.nextAction || "Open the report index and inspect the blocked report.", "outputs/admin/admin-report-index.json", "node scripts/build-admin-report-index.js");
  } else if (reportIndexSummary.review > 0) {
    addAction(actions, 3, "report_index", "review", "Some admin reports need review", reportIndex.nextAction || "Review missing or review-status reports before deploy.", "outputs/admin/admin-report-index.json", "node scripts/build-admin-report-index.js");
  } else if (reportIndexSummary.missing > 0) {
    addAction(actions, 9, "report_index", "review", "Optional admin reports are missing", reportIndex.nextAction || "Missing reports are acceptable when their workflow has never been used.", "outputs/admin/admin-report-index.json", "node scripts/build-admin-report-index.js");
  }

  if (!freshness) {
    addAction(actions, 3, "freshness", "review", "Report freshness check is missing", "Run the freshness check so you know whether the panel is showing recent information.", "outputs/admin/admin-report-freshness-report.json", "node scripts/build-admin-report-freshness.js");
  } else if (freshnessSummary.missing > 0) {
    addAction(actions, 9, "freshness", "review", "Freshness check has missing reports", freshness.nextAction || "Refresh reports with the full control check.", "outputs/admin/admin-report-freshness-report.json", "node scripts/run-admin-control-check.js");
  } else if (freshnessSummary.stale > 0) {
    addAction(actions, 9, "freshness", "review", "Some reports may be stale", freshness.nextAction || "Refresh reports with the full control check.", "outputs/admin/admin-report-freshness-report.json", "node scripts/run-admin-control-check.js");
  }

  if (!gitStatus) {
    addAction(actions, 4, "git", "review", "Git status report is missing", "Build the Git status report before committing or pushing.", "outputs/admin/git-status-report.json", "node scripts/build-git-status-report.js");
  } else if (gitSummary.pushSafety === "blocked") {
    addAction(actions, 4, "git", "blocked", "Git status blocks push", gitStatus.nextAction || "Review changed files before any push.", "outputs/admin/git-status-report.json", "node scripts/build-git-status-report.js");
  } else if (gitSummary.pushSafety !== "clean") {
    addAction(actions, 5, "git", "review", "Git status needs human review", gitStatus.nextAction || "Review untracked or changed files before pushing.", "outputs/admin/git-status-report.json", "node scripts/build-git-status-report.js");
  }

  if (!pushPackage) {
    addAction(actions, 5, "push_package", "review", "Push package report is missing", "Build the push package report before sending commits to GitHub.", "outputs/admin/push-package-report.json", "node scripts/build-push-package-report.js");
  } else if (pushSummary.status === "blocked") {
    addAction(actions, 5, "push_package", "blocked", "Push package is blocked", pushPackage.nextAction || "Review local and remote branch state before pushing.", "outputs/admin/push-package-report.json", "node scripts/build-push-package-report.js");
  } else if (pushSummary.status === "review") {
    addAction(actions, 6, "push_package", "review", "Push package needs review", pushPackage.nextAction || "Review local commits before pushing.", "outputs/admin/push-package-report.json", "node scripts/build-push-package-report.js");
  }

  if (!deployment) {
    addAction(actions, 6, "deployment", "review", "Deployment readiness report is missing", "Build the deployment readiness report before any live deploy.", "outputs/admin/deployment-readiness-report.json", "node scripts/build-deployment-readiness.js");
  } else if (deploymentSummary.status === "blocked" || deploymentSummary.status === "not_ready") {
    addAction(actions, 6, "deployment", "blocked", "Deployment is not ready", deployment.nextAction || "Resolve deployment blockers before pushing.", "outputs/admin/deployment-readiness-report.json", "node scripts/build-deployment-readiness.js");
  } else if (deploymentSummary.status === "review") {
    addAction(actions, 7, "deployment", "review", "Deployment needs final review", deployment.nextAction || "Review deployment readiness before pushing.", "outputs/admin/deployment-readiness-report.json", "node scripts/build-deployment-readiness.js");
  }

  if (!prePublish) {
    addAction(actions, 7, "pre_publish", "review", "Pre-publish checklist is missing", "Build the checklist before publishing draft content.", "outputs/admin/pre-publish-checklist-report.json", "node scripts/build-pre-publish-checklist.js");
  } else if (prePublishSummary.status === "blocked") {
    addAction(actions, 7, "pre_publish", "blocked", "Draft publish is blocked", prePublish.nextAction || "Fix draft blockers before publishing.", "outputs/admin/pre-publish-checklist-report.json", "node scripts/build-pre-publish-checklist.js");
  } else if (prePublishSummary.status === "ready" || prePublishSummary.status === "review") {
    addAction(actions, 8, "pre_publish", "review", "Draft publish needs human confirmation", prePublish.nextAction || "Review ready drafts, backup plan, and previews before publishing.", "outputs/admin/pre-publish-checklist-report.json", "node scripts/build-pre-publish-checklist.js");
  }

  actions.sort((a, b) => a.priority - b.priority || a.scope.localeCompare(b.scope));

  const blocked = actions.filter((item) => item.status === "blocked");
  const review = actions.filter((item) => item.status === "review");
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blocked.length > 0 ? "blocked" : review.length > 0 ? "review" : "passed",
      actions: actions.length,
      blocked: blocked.length,
      review: review.length,
      firstAction: actions[0] ? actions[0].title : "No failure response needed.",
    },
    nextAction:
      actions.length > 0
        ? `${actions[0].title}: ${actions[0].detail}`
        : "No failure response needed. Keep using the full control check before every publish or push.",
    actions,
    recoveryOrder: [
      "Run the full control check.",
      "If it fails, fix the first failed step before looking at later reports.",
      "Refresh report index and freshness after the control check.",
      "Review Git status before commit or push.",
      "Review push package and deployment readiness before live deploy.",
      "Publish drafts only after pre-publish, backup, rollback, and human review checks are clean.",
    ],
    guarantee:
      "Read-only failure playbook. This script reads local admin reports and writes a local response guide only. It does not edit content, publish files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Failure Playbook");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Actions: ${report.summary.actions}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
