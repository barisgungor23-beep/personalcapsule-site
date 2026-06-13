#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "push-confirmation-guide-report.json");

const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const SAFE_PUSH_FILE = path.join(ADMIN_OUTPUT_DIR, "safe-push-checklist-report.json");
const DOMAIN_POLICY_FILE = path.join(ADMIN_OUTPUT_DIR, "domain-safety-policy-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
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

function item(id, label, status, confirmation, evidence, source) {
  return {
    id,
    label,
    status,
    confirmation,
    evidence,
    source,
  };
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const safePush = readJsonIfExists(SAFE_PUSH_FILE);
  const domainPolicy = readJsonIfExists(DOMAIN_POLICY_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const git = readJsonIfExists(GIT_FILE);

  const controlSummary = summaryOf(control);
  const pushSummary = summaryOf(pushPackage);
  const safePushSummary = summaryOf(safePush);
  const domainSummary = summaryOf(domainPolicy);
  const deploymentSummary = summaryOf(deployment);
  const gitSummary = summaryOf(git);

  const checklist = [
    item(
      "full_control",
      "Full control passed",
      controlSummary.status === "passed" ? "ready" : "blocked",
      "I confirm the full local admin control check passed before push.",
      control ? `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed.` : "Control report is missing.",
      "outputs/admin/control-report.json"
    ),
    item(
      "commit_package",
      "Commit package reviewed",
      pushSummary.status === "blocked" || (pushSummary.behind || 0) > 0
        ? "blocked"
        : pushSummary.commitListComplete === false
          ? "blocked"
          : (pushSummary.ahead || 0) > 0
            ? "review"
            : "ready",
      "I confirm I understand every local commit that will be sent to GitHub.",
      pushPackage
        ? `${pushSummary.ahead || 0} ahead, ${pushSummary.behind || 0} behind, ${pushSummary.commits || 0} listed.`
        : "Push package report is missing.",
      "outputs/admin/push-package-report.json"
    ),
    item(
      "safe_push_decision",
      "Safe push decision reviewed",
      !safePush
        ? "blocked"
        : safePushSummary.decision === "do_not_push"
          ? "blocked"
          : safePushSummary.decision === "review_first"
            ? "review"
            : "ready",
      "I confirm the safe push decision is acceptable for the action I am about to take.",
      safePush ? `Decision: ${safePushSummary.decision || "unknown"}.` : "Safe push report is missing.",
      "outputs/admin/safe-push-checklist-report.json"
    ),
    item(
      "domain_policy",
      "Domain policy reviewed",
      !domainPolicy
        ? "blocked"
        : domainSummary.status === "blocked"
          ? "blocked"
          : domainSummary.status === "review"
            ? "review"
            : "ready",
      "I confirm CNAME/domain behavior will not change accidentally.",
      domainPolicy
        ? `Decision: ${domainSummary.policyDecision || "unknown"}, staged domain files: ${domainSummary.stagedDomainFiles || 0}.`
        : "Domain policy report is missing.",
      "outputs/admin/domain-safety-policy-report.json"
    ),
    item(
      "deployment_readiness",
      "Deployment readiness reviewed",
      !deployment
        ? "blocked"
        : deploymentSummary.status === "blocked"
          ? "blocked"
          : deploymentSummary.status === "review"
            ? "review"
            : "ready",
      "I confirm Cloudflare may deploy after GitHub receives this push.",
      deployment ? deployment.nextAction || `Status: ${deploymentSummary.status || "unknown"}.` : "Deployment report is missing.",
      "outputs/admin/deployment-readiness-report.json"
    ),
    item(
      "working_tree",
      "Working tree reviewed",
      !git
        ? "blocked"
        : gitSummary.pushSafety === "blocked" || gitSummary.pushSafety === "review_changes"
          ? "blocked"
          : gitSummary.pushSafety === "review_untracked"
            ? "review"
            : "ready",
      "I confirm there are no unreviewed tracked changes and untracked files are intentional.",
      git
        ? `${gitSummary.totalChangedFiles || 0} changed file(s), push safety: ${gitSummary.pushSafety || "unknown"}.`
        : "Git report is missing.",
      "outputs/admin/git-status-report.json"
    ),
  ];

  const blocked = checklist.filter((entry) => entry.status === "blocked");
  const review = checklist.filter((entry) => entry.status === "review");

  let status = "ready";
  let finalDecision = "ready_after_human_confirmation";
  let nextAction = "All hard blockers are clear. Read each confirmation line before pushing.";

  if (blocked.length > 0) {
    status = "blocked";
    finalDecision = "do_not_push";
    nextAction = `Do not push yet. Resolve this first: ${blocked[0].label}. ${blocked[0].evidence}`;
  } else if (review.length > 0) {
    status = "review";
    finalDecision = "human_review_required";
    nextAction = `Human review is required before push: ${review[0].label}. ${review[0].evidence}`;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      finalDecision,
      checklistItems: checklist.length,
      ready: checklist.filter((entry) => entry.status === "ready").length,
      review: review.length,
      blocked: blocked.length,
      commitsAhead: pushSummary.ahead || 0,
      changedFiles: gitSummary.totalChangedFiles || 0,
      domainFiles: domainSummary.domainFiles || 0,
    },
    nextAction,
    checklist,
    finalConfirmationText:
      "I reviewed the commit package, domain policy, safe push checklist, deployment readiness, and Git state. I understand that pushing may trigger Cloudflare deployment.",
    sources: [
      relative(CONTROL_FILE),
      relative(PUSH_PACKAGE_FILE),
      relative(SAFE_PUSH_FILE),
      relative(DOMAIN_POLICY_FILE),
      relative(DEPLOYMENT_FILE),
      relative(GIT_FILE),
    ],
    guarantee:
      "Read-only push confirmation guide. This script reads local admin reports and writes a local human confirmation guide only. It does not edit files, stage files, commit, push, pull, reset, delete, publish, restore, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Push Confirmation Guide");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Decision: ${report.summary.finalDecision}`);
  console.log(`Ready: ${report.summary.ready}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
