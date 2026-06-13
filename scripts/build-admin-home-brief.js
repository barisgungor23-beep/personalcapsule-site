#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-home-brief-report.json");

const DASHBOARD_SNAPSHOT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-dashboard-snapshot-report.json");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const BACKUP_RESTORE_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-restore-center-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function summaryOf(report) {
  return report && report.summary ? report.summary : {};
}

function decision(id, question, answer, status, detail, source) {
  return {
    id,
    question,
    answer,
    status,
    detail,
    source,
  };
}

function main() {
  const snapshot = readJsonIfExists(DASHBOARD_SNAPSHOT_FILE);
  const control = readJsonIfExists(CONTROL_FILE);
  const git = readJsonIfExists(GIT_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const backupRestore = readJsonIfExists(BACKUP_RESTORE_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);

  const snapshotSummary = summaryOf(snapshot);
  const controlSummary = summaryOf(control);
  const gitSummary = summaryOf(git);
  const deploymentSummary = summaryOf(deployment);
  const prePublishSummary = summaryOf(prePublish);
  const backupSummary = summaryOf(backupRestore);
  const pushSummary = summaryOf(pushPackage);

  const blockers = [];
  const warnings = [];

  if (!snapshot) {
    blockers.push({
      scope: "dashboard_snapshot",
      message: "Admin dashboard snapshot is missing. Run the full control check first.",
    });
  }

  if (!control || controlSummary.status !== "passed") {
    blockers.push({
      scope: "control",
      message: "Full control check is not passing. Do not publish or push.",
    });
  }

  const publishBlocked = (prePublishSummary.blockedDrafts || 0) > 0 || prePublishSummary.status === "blocked";
  const hasReadyDrafts = (prePublishSummary.readyDrafts || 0) > 0;
  const backupNeeded = backupSummary.status === "backup_needed";
  const gitNeedsReview = gitSummary.pushSafety && gitSummary.pushSafety !== "clean";
  const deploymentNeedsReview = deploymentSummary.status && deploymentSummary.status !== "ready";
  const pushNeedsReview = pushSummary.status && pushSummary.status !== "clean";

  if (gitNeedsReview) {
    warnings.push({
      scope: "git",
      message: `Git needs review before push: ${gitSummary.pushSafety}.`,
    });
  }

  if (deploymentNeedsReview) {
    warnings.push({
      scope: "deployment",
      message: deployment && deployment.nextAction ? deployment.nextAction : "Deployment readiness needs review.",
    });
  }

  if (pushNeedsReview) {
    warnings.push({
      scope: "push_package",
      message: `${pushSummary.ahead || 0} local commit(s) are waiting before GitHub push.`,
    });
  }

  const decisions = [
    decision(
      "site_health",
      "Is the website system healthy?",
      controlSummary.status === "passed" ? "Yes" : "No",
      controlSummary.status === "passed" ? "safe" : "blocked",
      `${controlSummary.passedSteps || 0} control step(s) passed, ${controlSummary.failedSteps || 0} failed.`,
      "outputs/admin/control-report.json"
    ),
    decision(
      "publish_now",
      "Can I publish content now?",
      publishBlocked ? "No" : hasReadyDrafts && !backupNeeded ? "Ready after human review" : "Nothing to publish",
      publishBlocked ? "blocked" : hasReadyDrafts ? "review" : "safe",
      hasReadyDrafts
        ? `${prePublishSummary.readyDrafts || 0} ready draft(s). Review preview, dry-run, and backup first.`
        : "There are no ready drafts waiting for publish.",
      "outputs/admin/pre-publish-checklist-report.json"
    ),
    decision(
      "push_now",
      "Can I push/deploy now?",
      gitNeedsReview || deploymentNeedsReview || pushNeedsReview ? "Review first" : "Yes, after final human review",
      gitNeedsReview || deploymentNeedsReview || pushNeedsReview ? "review" : "safe",
      deployment && deployment.nextAction
        ? deployment.nextAction
        : "Git, push package, and deployment readiness are clean.",
      "outputs/admin/deployment-readiness-report.json"
    ),
    decision(
      "backup_state",
      "Is backup/restore ready?",
      backupSummary.status === "restore_available" ? "Restore path is available" : backupNeeded ? "Backup needed" : "No action needed",
      backupNeeded ? "review" : "safe",
      `Confirmed backup files: ${backupSummary.copiedFiles || 0}. Restore operations: ${backupSummary.restoreOperations || 0}.`,
      "outputs/admin/backup-restore-center-report.json"
    ),
    decision(
      "next_content",
      "Should I write or wait?",
      hasReadyDrafts ? "Review existing draft first" : "Safe to plan the next draft",
      "safe",
      `${snapshotSummary.drafts || 0} draft(s), ${snapshotSummary.articles || 0} published article(s).`,
      "outputs/admin/admin-dashboard-snapshot-report.json"
    ),
  ];

  const blockedDecisions = decisions.filter((item) => item.status === "blocked");
  const reviewDecisions = decisions.filter((item) => item.status === "review");

  let status = "safe";
  let headline = "You can work calmly";
  let plainEnglish = "The website system is healthy. There is no content waiting for publish right now.";
  let primaryAction = "Use this time for content planning, not publishing.";

  if (blockers.length > 0 || blockedDecisions.length > 0) {
    status = "blocked";
    headline = "Stop before publishing or pushing";
    plainEnglish = "At least one core safety check is blocked. Fix that before any confirmed action.";
    primaryAction = blockers[0] ? blockers[0].message : blockedDecisions[0].detail;
  } else if (warnings.length > 0 || reviewDecisions.length > 0) {
    status = "review";
    headline = "Everything important works, but review before deploy";
    plainEnglish =
      "The site checks pass, but Git/push/deploy still need a human look before anything goes live.";
    primaryAction = warnings[0] ? warnings[0].message : reviewDecisions[0].detail;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      headline,
      decisions: decisions.length,
      safe: decisions.filter((item) => item.status === "safe").length,
      review: reviewDecisions.length,
      blocked: blockedDecisions.length,
      warnings: warnings.length,
      blockers: blockers.length,
      articles: snapshotSummary.articles || 0,
      pages: snapshotSummary.pages || 0,
      commitsAhead: snapshotSummary.commitsAhead || pushSummary.ahead || 0,
      changedFiles: snapshotSummary.changedFiles || gitSummary.totalChangedFiles || 0,
    },
    plainEnglish,
    primaryAction,
    decisions,
    blockers,
    warnings,
    safestRules: [
      "If this brief says blocked, do not publish and do not push.",
      "If this brief says review, inspect Git, Push Package, and Deployment Readiness first.",
      "If there is a ready draft, preview and backup before confirmed publish.",
      "If unsure, run node scripts/run-admin-control-check.js again.",
    ],
    sources: [
      relative(DASHBOARD_SNAPSHOT_FILE),
      relative(CONTROL_FILE),
      relative(GIT_FILE),
      relative(DEPLOYMENT_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(BACKUP_RESTORE_FILE),
      relative(PUSH_PACKAGE_FILE),
    ],
    guarantee:
      "Read-only admin home brief. This script reads local admin reports and writes a local founder-friendly summary only. It does not edit content, publish files, copy backups, restore files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Home Brief");
  console.log("================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Headline: ${report.summary.headline}`);
  console.log(`Decisions: ${report.summary.decisions}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (status === "blocked") {
    process.exitCode = 1;
  }
}

main();
