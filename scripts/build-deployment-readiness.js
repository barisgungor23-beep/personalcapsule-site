#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function check(id, label, status, detail, source) {
  return {
    id,
    label,
    status,
    detail,
    source,
  };
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const git = readJsonIfExists(GIT_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);

  const controlSummary = control && control.summary ? control.summary : {};
  const gitSummary = git && git.summary ? git.summary : {};
  const pushPackageSummary = pushPackage && pushPackage.summary ? pushPackage.summary : {};
  const prePublishSummary = prePublish && prePublish.summary ? prePublish.summary : {};

  const checks = [
    check(
      "control_check",
      "Full control check",
      controlSummary.status === "passed" ? "passed" : control ? "blocked" : "not_run",
      control
        ? `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed.`
        : "Full control report has not been generated yet.",
      "outputs/admin/control-report.json"
    ),
    check(
      "git_status",
      "Git status",
      gitSummary.status === "passed"
        ? gitSummary.pushSafety === "clean"
          ? "passed"
          : "review"
        : git
          ? "blocked"
          : "not_run",
      git
        ? `${gitSummary.totalChangedFiles || 0} changed file(s), push safety: ${gitSummary.pushSafety || "unknown"}.`
        : "Git status report has not been generated yet.",
      "outputs/admin/git-status-report.json"
    ),
    check(
      "push_package",
      "Push package",
      pushPackageSummary.status === "blocked"
        ? "blocked"
        : pushPackageSummary.status === "review"
          ? "review"
          : pushPackageSummary.status === "clean"
            ? "passed"
            : pushPackage
              ? "review"
              : "not_run",
      pushPackage
        ? `${pushPackageSummary.ahead || 0} commit(s) ahead, ${pushPackageSummary.behind || 0} behind.`
        : "Push package report has not been generated yet.",
      "outputs/admin/push-package-report.json"
    ),
    check(
      "pre_publish",
      "Pre-publish checklist",
      prePublishSummary.status === "blocked"
        ? "blocked"
        : prePublishSummary.status === "ready"
          ? "review"
          : prePublishSummary.status === "idle" || prePublishSummary.status === "passed"
            ? "passed"
            : prePublish
              ? "review"
              : "not_run",
      prePublish
        ? `${prePublishSummary.readyDrafts || 0} ready draft(s), ${prePublishSummary.blockedDrafts || 0} blocked draft(s).`
        : "Pre-publish checklist has not been generated yet.",
      "outputs/admin/pre-publish-checklist-report.json"
    ),
  ];

  const blocked = checks.filter((item) => item.status === "blocked");
  const notRun = checks.filter((item) => item.status === "not_run");
  const review = checks.filter((item) => item.status === "review");

  let status = "ready";
  let nextAction = "Deployment checks are clean. Review the final Git diff and push only when you intentionally want Cloudflare to deploy.";

  if (blocked.length > 0) {
    status = "blocked";
    nextAction = `Fix this before deploy: ${blocked[0].label}. ${blocked[0].detail}`;
  } else if (notRun.length > 0) {
    status = "not_ready";
    nextAction = `Run the full control check to refresh: ${notRun[0].label}.`;
  } else if (review.length > 0) {
    status = "review";
    nextAction = `Review this before deploy: ${review[0].label}. ${review[0].detail}`;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      checks: checks.length,
      passed: checks.filter((item) => item.status === "passed").length,
      review: review.length,
      blocked: blocked.length,
      notRun: notRun.length,
      branch: gitSummary.branch || null,
      latestCommit: gitSummary.latestCommit || null,
      pushSafety: gitSummary.pushSafety || null,
      pushPackageStatus: pushPackageSummary.status || null,
      commitsAhead: pushPackageSummary.ahead || 0,
    },
    nextAction,
    checks,
    deploymentRules: [
      "Deploy only from an intentionally reviewed Git state.",
      "Do not push when the full control check is failing.",
      "Treat untracked files as review items, not automatic deploy content.",
      "If a ready draft exists, complete backup and human review before publish.",
      "Cloudflare deploy should happen only after the final commit is reviewed.",
    ],
    guarantee:
      "Read-only deployment readiness. This script reads local reports and writes a local summary only. It does not edit files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(DEPLOYMENT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Deployment Readiness");
  console.log("====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Checks: ${report.summary.checks}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(DEPLOYMENT_FILE)}`);
}

main();
