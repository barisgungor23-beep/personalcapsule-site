#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "final-push-review-report.json");

const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const SAFE_PUSH_FILE = path.join(ADMIN_OUTPUT_DIR, "safe-push-checklist-report.json");
const DOMAIN_POLICY_FILE = path.join(ADMIN_OUTPUT_DIR, "domain-safety-policy-report.json");
const PUSH_CONFIRMATION_FILE = path.join(ADMIN_OUTPUT_DIR, "push-confirmation-guide-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");

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

function decision(id, label, status, answer, plainMeaning, source) {
  return {
    id,
    label,
    status,
    answer,
    plainMeaning,
    source,
  };
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const git = readJsonIfExists(GIT_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const safePush = readJsonIfExists(SAFE_PUSH_FILE);
  const domainPolicy = readJsonIfExists(DOMAIN_POLICY_FILE);
  const pushConfirmation = readJsonIfExists(PUSH_CONFIRMATION_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);

  const controlSummary = summaryOf(control);
  const gitSummary = summaryOf(git);
  const pushSummary = summaryOf(pushPackage);
  const safePushSummary = summaryOf(safePush);
  const domainSummary = summaryOf(domainPolicy);
  const confirmationSummary = summaryOf(pushConfirmation);
  const deploymentSummary = summaryOf(deployment);
  const prePublishSummary = summaryOf(prePublish);

  const decisions = [
    decision(
      "site_health",
      "Site health",
      controlSummary.status === "passed" ? "safe" : "blocked",
      control ? `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed` : "Control report is missing",
      "This tells you whether the whole local website and admin system is technically healthy.",
      "outputs/admin/control-report.json"
    ),
    decision(
      "content_waiting",
      "Content waiting",
      (prePublishSummary.blockedDrafts || 0) > 0
        ? "blocked"
        : (prePublishSummary.readyDrafts || 0) > 0
          ? "review"
          : "safe",
      prePublish
        ? `${prePublishSummary.readyDrafts || 0} ready draft(s), ${prePublishSummary.blockedDrafts || 0} blocked draft(s)`
        : "Pre-publish report is missing",
      "This prevents you from forgetting a draft that was meant to be published before pushing.",
      "outputs/admin/pre-publish-checklist-report.json"
    ),
    decision(
      "git_state",
      "Local file state",
      !git
        ? "blocked"
        : gitSummary.pushSafety === "blocked" || gitSummary.pushSafety === "review_changes"
          ? "blocked"
          : gitSummary.pushSafety === "review_untracked"
            ? "review"
            : "safe",
      git
        ? `${gitSummary.totalChangedFiles || 0} changed file(s), ${gitSummary.pushSafety || "unknown"}`
        : "Git report is missing",
      "This tells you whether local files are clean enough to send commits to GitHub.",
      "outputs/admin/git-status-report.json"
    ),
    decision(
      "domain_safety",
      "Domain safety",
      !domainPolicy
        ? "blocked"
        : domainSummary.status === "blocked"
          ? "blocked"
          : domainSummary.status === "review"
            ? "review"
            : "safe",
      domainPolicy
        ? `${domainSummary.policyDecision || "unknown"}; staged domain files: ${domainSummary.stagedDomainFiles || 0}`
        : "Domain policy report is missing",
      "This protects the public domain from accidental CNAME or routing changes.",
      "outputs/admin/domain-safety-policy-report.json"
    ),
    decision(
      "commit_package",
      "Commit package",
      !pushPackage
        ? "blocked"
        : pushSummary.status === "blocked" || (pushSummary.behind || 0) > 0
          ? "blocked"
          : (pushSummary.ahead || 0) > 0
            ? "review"
            : "safe",
      pushPackage
        ? `${pushSummary.ahead || 0} ahead, ${pushSummary.behind || 0} behind, ${pushSummary.commits || 0} listed`
        : "Push package report is missing",
      "This shows exactly how much local work would be sent to GitHub.",
      "outputs/admin/push-package-report.json"
    ),
    decision(
      "safe_push",
      "Safe push decision",
      !safePush
        ? "blocked"
        : safePushSummary.decision === "do_not_push"
          ? "blocked"
          : safePushSummary.decision === "review_first"
            ? "review"
            : "safe",
      safePush ? safePushSummary.decision || "unknown" : "Safe push report is missing",
      "This is the automatic safety summary before any push action.",
      "outputs/admin/safe-push-checklist-report.json"
    ),
    decision(
      "human_confirmation",
      "Human confirmation",
      !pushConfirmation
        ? "blocked"
        : confirmationSummary.status === "blocked"
          ? "blocked"
          : confirmationSummary.status === "review"
            ? "review"
            : "safe",
      pushConfirmation ? confirmationSummary.finalDecision || "unknown" : "Push confirmation report is missing",
      "This is the final human review gate before GitHub and Cloudflare can receive the package.",
      "outputs/admin/push-confirmation-guide-report.json"
    ),
    decision(
      "cloudflare_impact",
      "Cloudflare impact",
      !deployment
        ? "blocked"
        : deploymentSummary.status === "blocked"
          ? "blocked"
          : deploymentSummary.status === "review"
            ? "review"
            : "safe",
      deployment ? deployment.nextAction || deploymentSummary.status || "unknown" : "Deployment report is missing",
      "This tells you whether a push may become a live Cloudflare Pages deployment.",
      "outputs/admin/deployment-readiness-report.json"
    ),
  ];

  const blocked = decisions.filter((item) => item.status === "blocked");
  const review = decisions.filter((item) => item.status === "review");

  let status = "safe";
  let finalAnswer = "Push looks safe after final human confirmation.";
  let recommendedAction = "Read the commit package one last time, then push only if you intentionally want Cloudflare to deploy it.";
  let plainMeaning =
    "There are no hard blockers. This does not push anything by itself; it only says the package can be considered for push.";

  if (blocked.length > 0) {
    status = "blocked";
    finalAnswer = "Do not push yet.";
    recommendedAction = `Fix this first: ${blocked[0].label}.`;
    plainMeaning = "At least one safety gate failed or is missing. Sending commits to GitHub would be premature.";
  } else if ((pushSummary.ahead || 0) === 0) {
    status = "safe";
    finalAnswer = "Nothing is waiting to push.";
    recommendedAction = "Do not push unless you intentionally create a new commit first.";
    plainMeaning = "The local branch does not currently have a commit package waiting for GitHub.";
  } else if (review.length > 0) {
    status = "review";
    finalAnswer = "Push is not blocked, but human review is required.";
    recommendedAction = `Review this first: ${review[0].label}.`;
    plainMeaning =
      "The system did not find a hard blocker, but there are sensitive or live-site-related items that need a human decision.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      finalAnswer,
      decisions: decisions.length,
      safe: decisions.filter((item) => item.status === "safe").length,
      review: review.length,
      blocked: blocked.length,
      commitsAhead: pushSummary.ahead || 0,
      commitsBehind: pushSummary.behind || 0,
      changedFiles: gitSummary.totalChangedFiles || 0,
      untrackedFiles: gitSummary.untrackedFiles || 0,
      readyDrafts: prePublishSummary.readyDrafts || 0,
      domainFiles: domainSummary.domainFiles || 0,
      latestCommit: gitSummary.latestCommit || null,
    },
    founderAnswer: finalAnswer,
    recommendedAction,
    plainMeaning,
    decisions,
    finalReviewLines: [
      "I understand this action can update GitHub.",
      "I understand Cloudflare Pages may deploy after GitHub receives the push.",
      "I reviewed the commit list and there are no unexpected changes.",
      "I did not stage CNAME or any domain file by accident.",
      "I checked that sitemap.xml, robots.txt, and llms.txt passed the full control check.",
    ],
    sources: [
      relative(CONTROL_FILE),
      relative(GIT_FILE),
      relative(PUSH_PACKAGE_FILE),
      relative(SAFE_PUSH_FILE),
      relative(DOMAIN_POLICY_FILE),
      relative(PUSH_CONFIRMATION_FILE),
      relative(DEPLOYMENT_FILE),
      relative(PRE_PUBLISH_FILE),
    ],
    guarantee:
      "Read-only final push review. This script reads local admin reports and writes a local decision summary only. It does not edit files, stage files, commit, push, pull, reset, delete, publish, restore, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Final Push Review");
  console.log("=================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Answer: ${report.founderAnswer}`);
  console.log(`Safe: ${report.summary.safe}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
