#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-dashboard-snapshot-report.json");

const READ_MODEL_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-read-model.json");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const SYSTEM_OVERVIEW_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-system-overview-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const DRAFT_QUALITY_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const BACKUP_RESTORE_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-restore-center-report.json");
const REPORT_FRESHNESS_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-freshness-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function getSummary(report) {
  return report && report.summary ? report.summary : {};
}

function statusClass(status) {
  if (["passed", "ready", "clean", "healthy", "restore_available", "idle"].includes(status)) return "ok";
  if (["review", "backup_needed", "not_ready", "review_untracked", "review_changes"].includes(status)) return "review";
  if (["failed", "blocked"].includes(status)) return "blocked";
  return "unknown";
}

function card(id, label, status, detail, source, priority) {
  return {
    id,
    label,
    status,
    statusClass: statusClass(status),
    detail,
    source,
    priority,
  };
}

function firstByStatus(cards, className) {
  return cards.find((item) => item.statusClass === className);
}

function main() {
  const readModel = readJsonIfExists(READ_MODEL_FILE);
  const control = readJsonIfExists(CONTROL_FILE);
  const systemOverview = readJsonIfExists(SYSTEM_OVERVIEW_FILE);
  const git = readJsonIfExists(GIT_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const draftQuality = readJsonIfExists(DRAFT_QUALITY_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const backupRestore = readJsonIfExists(BACKUP_RESTORE_FILE);
  const freshness = readJsonIfExists(REPORT_FRESHNESS_FILE);

  const modelSummary = getSummary(readModel);
  const controlSummary = getSummary(control);
  const systemSummary = getSummary(systemOverview);
  const gitSummary = getSummary(git);
  const pushSummary = getSummary(pushPackage);
  const deploymentSummary = getSummary(deployment);
  const draftSummary = getSummary(draftQuality);
  const prePublishSummary = getSummary(prePublish);
  const backupSummary = getSummary(backupRestore);
  const freshnessSummary = getSummary(freshness);

  const cards = [
    card(
      "content",
      "Content",
      modelSummary.seoWarnings > 0 ? "review" : "healthy",
      `${modelSummary.totalBlogArticles || 0} articles, ${modelSummary.totalBlogCategories || 0} categories, ${modelSummary.seoWarnings || 0} SEO warning(s).`,
      "outputs/admin/admin-read-model.json",
      1
    ),
    card(
      "control",
      "Control check",
      controlSummary.status || "missing",
      `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed.`,
      "outputs/admin/control-report.json",
      2
    ),
    card(
      "drafts",
      "Drafts",
      draftSummary.status || "missing",
      `${draftSummary.drafts || 0} draft(s), ${draftSummary.ready || 0} ready, ${draftSummary.blocked || 0} blocked.`,
      "outputs/admin/draft-quality-report.json",
      3
    ),
    card(
      "publish_safety",
      "Publish safety",
      prePublishSummary.status || "missing",
      `${prePublishSummary.readyDrafts || 0} ready draft(s), ${prePublishSummary.blockedDrafts || 0} blocked draft(s).`,
      "outputs/admin/pre-publish-checklist-report.json",
      4
    ),
    card(
      "backup_restore",
      "Backup / restore",
      backupSummary.status || "missing",
      `Backup copied: ${backupSummary.copiedFiles || 0}, restore ops: ${backupSummary.restoreOperations || 0}.`,
      "outputs/admin/backup-restore-center-report.json",
      5
    ),
    card(
      "git",
      "Git",
      gitSummary.pushSafety || gitSummary.status || "missing",
      `${gitSummary.totalChangedFiles || 0} changed file(s), branch: ${gitSummary.branch || "unknown"}.`,
      "outputs/admin/git-status-report.json",
      6
    ),
    card(
      "push_package",
      "Push package",
      pushSummary.status || "missing",
      `${pushSummary.ahead || 0} commit(s) ahead, ${pushSummary.behind || 0} behind.`,
      "outputs/admin/push-package-report.json",
      7
    ),
    card(
      "deployment",
      "Deployment",
      deploymentSummary.status || "missing",
      deployment ? deployment.nextAction || "Review deployment readiness before push." : "Deployment report is missing.",
      "outputs/admin/deployment-readiness-report.json",
      8
    ),
    card(
      "freshness",
      "Report freshness",
      freshnessSummary.status || "missing",
      `${freshnessSummary.fresh || 0} fresh, ${freshnessSummary.stale || 0} stale, ${freshnessSummary.missing || 0} missing.`,
      "outputs/admin/admin-report-freshness-report.json",
      9
    ),
  ];

  const blocked = cards.filter((item) => item.statusClass === "blocked");
  const review = cards.filter((item) => item.statusClass === "review");
  const unknown = cards.filter((item) => item.statusClass === "unknown");

  let status = "ready";
  let headline = "Website admin system is ready";
  let nextAction = "No urgent action. Keep using the full control check before editing, publishing, or pushing.";

  if (blocked.length > 0) {
    status = "blocked";
    headline = "Action is blocked";
    nextAction = `Fix this first: ${blocked[0].label}. ${blocked[0].detail}`;
  } else if (unknown.length > 0) {
    status = "not_ready";
    headline = "Some dashboard inputs are missing";
    nextAction = `Run the full control check to refresh: ${unknown[0].label}.`;
  } else if (review.length > 0) {
    status = "review";
    headline = "Review before deploy";
    nextAction = `Review this before pushing or deploying: ${review[0].label}. ${review[0].detail}`;
  }

  const firstRisk = firstByStatus(cards, "blocked") || firstByStatus(cards, "review") || firstByStatus(cards, "unknown");

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      headline,
      cards: cards.length,
      ok: cards.filter((item) => item.statusClass === "ok").length,
      review: review.length,
      blocked: blocked.length,
      unknown: unknown.length,
      articles: modelSummary.totalBlogArticles || systemSummary.articles || 0,
      pages: modelSummary.totalHtmlPages || systemSummary.htmlPages || 0,
      categories: modelSummary.totalBlogCategories || systemSummary.categories || 0,
      commitsAhead: pushSummary.ahead || systemSummary.commitsAhead || 0,
      changedFiles: gitSummary.totalChangedFiles || 0,
      drafts: draftSummary.drafts || 0,
    },
    nextAction,
    firstRisk: firstRisk
      ? {
          label: firstRisk.label,
          status: firstRisk.status,
          detail: firstRisk.detail,
          source: firstRisk.source,
        }
      : null,
    cards,
    safeDefault:
      "If the snapshot says review, blocked, or not_ready, do not publish and do not push. Run the full control check and review the named source report first.",
    usefulCommands: [
      {
        label: "Refresh everything",
        command: "node scripts/run-admin-control-check.js",
      },
      {
        label: "Review Git state",
        command: "git status --short",
      },
      {
        label: "Review intended code changes",
        command: "git diff --stat",
      },
    ],
    sources: [
      relative(READ_MODEL_FILE),
      relative(CONTROL_FILE),
      relative(SYSTEM_OVERVIEW_FILE),
      relative(GIT_FILE),
      relative(PUSH_PACKAGE_FILE),
      relative(DEPLOYMENT_FILE),
      relative(DRAFT_QUALITY_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(BACKUP_RESTORE_FILE),
      relative(REPORT_FRESHNESS_FILE),
    ],
    guarantee:
      "Read-only dashboard snapshot. This script reads local admin reports and writes a local summary only. It does not edit content, publish files, copy backups, restore files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Dashboard Snapshot");
  console.log("========================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Headline: ${report.summary.headline}`);
  console.log(`Cards: ${report.summary.cards}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (status === "blocked") {
    process.exitCode = 1;
  }
}

main();
