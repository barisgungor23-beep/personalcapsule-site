#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "founder-decision-center-report.json");

const HOME_BRIEF_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-home-brief-report.json");
const DASHBOARD_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-dashboard-snapshot-report.json");
const WORK_QUEUE_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-work-queue-report.json");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const PUSH_CONFIRMATION_FILE = path.join(ADMIN_OUTPUT_DIR, "push-confirmation-guide-report.json");
const DOMAIN_POLICY_FILE = path.join(ADMIN_OUTPUT_DIR, "domain-safety-policy-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");

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

function decision(id, label, answer, status, detail, source, plainMeaning) {
  return {
    id,
    label,
    answer,
    status,
    detail,
    source,
    plainMeaning,
  };
}

function nextStep(id, label, status, why, source) {
  return {
    id,
    label,
    status,
    why,
    source,
  };
}

function main() {
  const home = readJsonIfExists(HOME_BRIEF_FILE);
  const dashboard = readJsonIfExists(DASHBOARD_FILE);
  const workQueue = readJsonIfExists(WORK_QUEUE_FILE);
  const control = readJsonIfExists(CONTROL_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const pushConfirmation = readJsonIfExists(PUSH_CONFIRMATION_FILE);
  const domainPolicy = readJsonIfExists(DOMAIN_POLICY_FILE);
  const git = readJsonIfExists(GIT_FILE);

  const homeSummary = summaryOf(home);
  const dashboardSummary = summaryOf(dashboard);
  const workSummary = summaryOf(workQueue);
  const controlSummary = summaryOf(control);
  const prePublishSummary = summaryOf(prePublish);
  const pushSummary = summaryOf(pushConfirmation);
  const domainSummary = summaryOf(domainPolicy);
  const gitSummary = summaryOf(git);

  const controlPassed = controlSummary.status === "passed";
  const readyDrafts = prePublishSummary.readyDrafts || 0;
  const blockedDrafts = prePublishSummary.blockedDrafts || 0;
  const hasTrackedChanges = (gitSummary.trackedChangedFiles || 0) > 0;
  const hasOnlyUntrackedDomainFile =
    (gitSummary.totalChangedFiles || 0) === 1 &&
    (domainSummary.untrackedDomainFiles || 0) === 1 &&
    (domainSummary.stagedDomainFiles || 0) === 0;
  const pushHasBlocker = pushSummary.status === "blocked";
  const domainHasBlocker = domainSummary.status === "blocked";
  const workHasBlocker = (workSummary.blocked || 0) > 0;

  const decisions = [
    decision(
      "site_health",
      "Website health",
      controlPassed ? "Healthy" : "Blocked",
      controlPassed ? "safe" : "blocked",
      controlPassed
        ? `${controlSummary.passedSteps || 0} checks passed, ${controlSummary.failedSteps || 0} failed.`
        : "The full control check is not passing.",
      "outputs/admin/control-report.json",
      controlPassed
        ? "The local website system is technically healthy."
        : "Do not publish or push until the failing control check is fixed."
    ),
    decision(
      "content_publish",
      "Content publish",
      blockedDrafts > 0 ? "Blocked" : readyDrafts > 0 ? "Review draft first" : "Nothing waiting",
      blockedDrafts > 0 ? "blocked" : readyDrafts > 0 ? "review" : "safe",
      `${readyDrafts} ready draft(s), ${blockedDrafts} blocked draft(s).`,
      "outputs/admin/pre-publish-checklist-report.json",
      readyDrafts > 0
        ? "There is content that might be publishable, but it needs a preview and backup check first."
        : "There is no draft that needs publishing right now."
    ),
    decision(
      "push_deploy",
      "Push / deploy",
      pushHasBlocker ? "Do not push" : pushSummary.status === "review" ? "Human review needed" : "Ready after confirmation",
      pushHasBlocker ? "blocked" : pushSummary.status === "review" ? "review" : "safe",
      pushConfirmation ? pushConfirmation.nextAction || "Review push confirmation." : "Push confirmation report is missing.",
      "outputs/admin/push-confirmation-guide-report.json",
      "Push means sending local commits to GitHub. Cloudflare may deploy the live website after that."
    ),
    decision(
      "domain_safety",
      "Domain safety",
      domainHasBlocker ? "Blocked" : hasOnlyUntrackedDomainFile ? "Safe if left alone" : "Review",
      domainHasBlocker ? "blocked" : domainSummary.status === "review" ? "review" : "safe",
      domainPolicy ? domainPolicy.nextAction || "Review domain policy." : "Domain policy report is missing.",
      "outputs/admin/domain-safety-policy-report.json",
      "The CNAME file can affect where the public website points. Leaving it untracked avoids accidental domain changes."
    ),
    decision(
      "working_tree",
      "Local files",
      hasTrackedChanges ? "Tracked changes exist" : hasOnlyUntrackedDomainFile ? "Only CNAME is untracked" : "Review local files",
      hasTrackedChanges ? "review" : hasOnlyUntrackedDomainFile ? "safe" : gitSummary.totalChangedFiles ? "review" : "safe",
      `${gitSummary.totalChangedFiles || 0} changed file(s), ${gitSummary.trackedChangedFiles || 0} tracked change(s).`,
      "outputs/admin/git-status-report.json",
      "This tells you whether local files are waiting to be committed or intentionally ignored."
    ),
  ];

  const blocked = decisions.filter((item) => item.status === "blocked");
  const review = decisions.filter((item) => item.status === "review");

  let status = "safe";
  let headline = "You can wait and observe calmly";
  let founderAnswer = "There is no urgent website action. Keep watching data and only publish when you intentionally prepare a draft.";
  let safestAction = "Do nothing live. Keep CNAME untracked and run the full control check before the next edit.";

  if (blocked.length > 0 || workHasBlocker) {
    status = "blocked";
    headline = "Stop before any live action";
    founderAnswer = "Something needs fixing before publish, push, or deploy.";
    safestAction = blocked[0] ? `${blocked[0].label}: ${blocked[0].detail}` : "Review the admin work queue blocker.";
  } else if (review.length > 0) {
    status = "review";
    headline = "Everything works, but review before going live";
    founderAnswer =
      "The website system is healthy, but push/deploy still needs a human decision because local commits and domain safety are involved.";
    safestAction = review[0] ? `${review[0].label}: ${review[0].detail}` : "Review the first admin queue item.";
  }

  const nextSteps = [
    nextStep(
      "refresh",
      "Refresh all checks",
      controlPassed ? "safe" : "blocked",
      "Run the full control check before every serious edit, publish, push, or deploy.",
      "outputs/admin/control-report.json"
    ),
    nextStep(
      "content",
      readyDrafts > 0 ? "Preview the ready draft" : "Plan the next content calmly",
      readyDrafts > 0 ? "review" : "safe",
      readyDrafts > 0
        ? "A ready draft should be previewed before publish."
        : "No draft is waiting. This is a good time to observe SEO/Search Console data.",
      "outputs/admin/pre-publish-checklist-report.json"
    ),
    nextStep(
      "domain",
      "Keep CNAME out of commits",
      domainHasBlocker ? "blocked" : "review",
      "CNAME is allowed to stay untracked, but it should not be accidentally staged.",
      "outputs/admin/domain-safety-policy-report.json"
    ),
    nextStep(
      "push",
      "Push only after final confirmation",
      pushHasBlocker ? "blocked" : "review",
      "Read the push confirmation guide before sending commits to GitHub.",
      "outputs/admin/push-confirmation-guide-report.json"
    ),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      headline,
      decisions: decisions.length,
      safe: decisions.filter((item) => item.status === "safe").length,
      review: review.length,
      blocked: blocked.length,
      articles: dashboardSummary.articles || homeSummary.articles || 0,
      pages: dashboardSummary.pages || homeSummary.pages || 0,
      commitsAhead: dashboardSummary.commitsAhead || homeSummary.commitsAhead || 0,
      changedFiles: dashboardSummary.changedFiles || homeSummary.changedFiles || 0,
      readyDrafts,
    },
    founderAnswer,
    safestAction,
    decisions,
    nextSteps,
    guardrails: [
      "This report is a decision guide only. It never publishes, pushes, deletes, restores, stages, or commits.",
      "If any decision says blocked, do not continue with live actions.",
      "If any decision says review, read the named source report before acting.",
      "CNAME should stay untracked unless you intentionally decide to change domain behavior.",
    ],
    sources: [
      relative(HOME_BRIEF_FILE),
      relative(DASHBOARD_FILE),
      relative(WORK_QUEUE_FILE),
      relative(CONTROL_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(PUSH_CONFIRMATION_FILE),
      relative(DOMAIN_POLICY_FILE),
      relative(GIT_FILE),
    ],
    guarantee:
      "Read-only founder decision center. This script reads local admin reports and writes a local decision report only. It does not edit content, publish files, stage files, commit, push, pull, reset, delete, restore, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Founder Decision Center");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Headline: ${report.summary.headline}`);
  console.log(`Decisions: ${report.summary.decisions}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
