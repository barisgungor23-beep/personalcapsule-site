#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const READ_MODEL_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-read-model.json");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const QUICK_START_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-quick-start-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const GIT_STATUS_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const OVERVIEW_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-system-overview-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function statusValue(report) {
  return report && report.summary ? report.summary.status || "unknown" : "missing";
}

function main() {
  const readModel = readJsonIfExists(READ_MODEL_FILE);
  const control = readJsonIfExists(CONTROL_FILE);
  const quickStart = readJsonIfExists(QUICK_START_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const gitStatus = readJsonIfExists(GIT_STATUS_FILE);

  const blockers = [];
  const warnings = [];

  if (!readModel) blockers.push({ scope: "admin_read_model", message: "Admin read model is missing." });
  if (!control) blockers.push({ scope: "control_report", message: "Control report is missing." });
  if (!quickStart) warnings.push({ scope: "quick_start", message: "Quick start report is missing." });
  if (!deployment) warnings.push({ scope: "deployment_readiness", message: "Deployment readiness report is missing." });
  if (!pushPackage) warnings.push({ scope: "push_package", message: "Push package report is missing." });
  if (!gitStatus) warnings.push({ scope: "git_status", message: "Git status report is missing." });

  const modelSummary = readModel && readModel.summary ? readModel.summary : {};
  const controlSummary = control && control.summary ? control.summary : {};
  const quickStartSummary = quickStart && quickStart.summary ? quickStart.summary : {};
  const deploymentSummary = deployment && deployment.summary ? deployment.summary : {};
  const pushSummary = pushPackage && pushPackage.summary ? pushPackage.summary : {};
  const gitSummary = gitStatus && gitStatus.summary ? gitStatus.summary : {};

  const statusCards = [
    {
      label: "Content",
      status: modelSummary.seoWarnings === 0 && modelSummary.articleQuality && modelSummary.articleQuality.risk === 0 ? "healthy" : "review",
      detail: `${modelSummary.totalBlogArticles || 0} articles, ${modelSummary.totalBlogCategories || 0} categories, ${modelSummary.seoWarnings || 0} SEO warnings.`,
    },
    {
      label: "Control",
      status: controlSummary.status === "passed" ? "healthy" : "blocked",
      detail: `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed.`,
    },
    {
      label: "Deployment",
      status: deploymentSummary.status === "ready" ? "healthy" : deploymentSummary.status === "blocked" ? "blocked" : "review",
      detail: deployment ? deployment.nextAction : "Deployment readiness is missing.",
    },
    {
      label: "Push package",
      status: pushSummary.status === "clean" ? "healthy" : pushSummary.status === "blocked" ? "blocked" : "review",
      detail: `${pushSummary.ahead || 0} commit(s) ahead, ${pushSummary.behind || 0} behind.`,
    },
    {
      label: "Git",
      status: gitSummary.pushSafety === "clean" ? "healthy" : gitSummary.pushSafety === "blocked" ? "blocked" : "review",
      detail: `${gitSummary.totalChangedFiles || 0} changed file(s), push safety: ${gitSummary.pushSafety || "unknown"}.`,
    },
  ];

  const blockedCards = statusCards.filter((card) => card.status === "blocked");
  const reviewCards = statusCards.filter((card) => card.status === "review");

  let overallStatus = "healthy";
  let recommendedAction = "System is healthy. Keep observing performance and avoid unnecessary deploys.";

  if (blockers.length > 0 || blockedCards.length > 0) {
    overallStatus = "blocked";
    recommendedAction = `Fix this first: ${(blockedCards[0] && blockedCards[0].label) || blockers[0].scope}.`;
  } else if (warnings.length > 0 || reviewCards.length > 0) {
    overallStatus = "review";
    recommendedAction = `Review this before pushing or deploying: ${reviewCards[0] ? reviewCards[0].label : warnings[0].scope}.`;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      overallStatus,
      htmlPages: modelSummary.totalHtmlPages || 0,
      articles: modelSummary.totalBlogArticles || 0,
      categories: modelSummary.totalBlogCategories || 0,
      drafts: modelSummary.articleStatuses ? modelSummary.articleStatuses.draft || 0 : 0,
      seoWarnings: modelSummary.seoWarnings || 0,
      controlStatus: statusValue(control),
      quickStartStatus: statusValue(quickStart),
      deploymentStatus: statusValue(deployment),
      pushPackageStatus: statusValue(pushPackage),
      gitPushSafety: gitSummary.pushSafety || null,
      commitsAhead: pushSummary.ahead || 0,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    recommendedAction,
    blockers,
    warnings,
    statusCards,
    focusOrder: [
      "Control Center",
      "Admin Quick Start",
      "Git Status / Push Safety",
      "Push Package",
      "Deployment Readiness",
      "Admin Operations Manual",
    ],
    guarantee:
      "Read-only system overview. This script reads local admin reports and writes a local summary only. It does not edit content, publish files, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OVERVIEW_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin System Overview");
  console.log("=====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Overall: ${report.summary.overallStatus}`);
  console.log(`Articles: ${report.summary.articles}`);
  console.log(`Commits ahead: ${report.summary.commitsAhead}`);
  console.log(`Report: ${relative(OVERVIEW_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
