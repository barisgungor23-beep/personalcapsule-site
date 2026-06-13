#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "safe-push-checklist-report.json");

const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const PUBLISH_WIZARD_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-wizard-report.json");

const SENSITIVE_FILES = new Set(["CNAME"]);

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

function controlStep(control, id) {
  const steps = control && Array.isArray(control.steps) ? control.steps : [];
  return steps.find((item) => item.id === id) || null;
}

function check(id, label, status, detail, source, whyItMatters) {
  return {
    id,
    label,
    status,
    detail,
    source,
    whyItMatters,
  };
}

function statusFromControlStep(step) {
  if (!step) return "not_run";
  return step.status === "passed" ? "passed" : "blocked";
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const git = readJsonIfExists(GIT_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const publishWizard = readJsonIfExists(PUBLISH_WIZARD_FILE);

  const controlSummary = summaryOf(control);
  const gitSummary = summaryOf(git);
  const pushSummary = summaryOf(pushPackage);
  const deploymentSummary = summaryOf(deployment);
  const prePublishSummary = summaryOf(prePublish);
  const wizardSummary = summaryOf(publishWizard);

  const gitFiles = git && Array.isArray(git.files) ? git.files : [];
  const sensitiveFiles = gitFiles.filter((item) => SENSITIVE_FILES.has(item.file));
  const stagedSensitiveFiles = sensitiveFiles.filter((item) => item.group === "staged");
  const trackedChanges = gitFiles.filter((item) => item.group === "staged" || item.group === "unstaged" || item.group === "modified");
  const untrackedFiles = gitFiles.filter((item) => item.group === "untracked");

  const auditSiteStep = controlStep(control, "audit_site");
  const auditDiscoveryStep = controlStep(control, "audit_discovery_preview");
  const generateDiscoveryStep = controlStep(control, "generate_discovery_preview");
  const validateContentStep = controlStep(control, "validate_content");

  const checks = [
    check(
      "full_control",
      "Full control check",
      controlSummary.status === "passed" ? "passed" : control ? "blocked" : "not_run",
      control
        ? `${controlSummary.passedSteps || 0} passed, ${controlSummary.failedSteps || 0} failed.`
        : "Full control report is missing.",
      "outputs/admin/control-report.json",
      "This proves the whole local website/admin system was checked before push."
    ),
    check(
      "content_validation",
      "Content validation",
      statusFromControlStep(validateContentStep),
      validateContentStep ? validateContentStep.label : "Content validation was not run.",
      "outputs/admin/control-report.json",
      "This catches broken content structure before it reaches the website."
    ),
    check(
      "sitemap_robots_llms",
      "Sitemap / robots / llms",
      statusFromControlStep(auditSiteStep),
      auditSiteStep
        ? "Live site files were audited, including sitemap.xml, robots.txt, llms.txt, canonical links, and App Store links."
        : "Site audit was not run.",
      "outputs/admin/control-report.json",
      "These files help Google, AI tools, and browsers understand the site correctly."
    ),
    check(
      "discovery_preview",
      "Generated discovery files",
      statusFromControlStep(auditDiscoveryStep),
      auditDiscoveryStep
        ? "Generated sitemap and llms previews were audited against the live discovery files."
        : "Discovery preview audit was not run.",
      "outputs/admin/control-report.json",
      "This confirms generated sitemap/llms changes do not accidentally drop important URLs."
    ),
    check(
      "discovery_generated",
      "Discovery generation",
      statusFromControlStep(generateDiscoveryStep),
      generateDiscoveryStep
        ? "Generated sitemap and llms preview files were refreshed."
        : "Discovery generation was not run.",
      "outputs/admin/control-report.json",
      "This makes sure the push decision is based on fresh generated discovery output."
    ),
    check(
      "git_status",
      "Git working tree",
      !git
        ? "not_run"
        : gitSummary.status !== "passed"
          ? "blocked"
          : trackedChanges.length > 0
            ? "blocked"
            : untrackedFiles.length > 0
              ? "review"
              : "passed",
      git
        ? `${gitSummary.totalChangedFiles || 0} changed file(s), ${trackedChanges.length} tracked change(s), ${untrackedFiles.length} untracked file(s).`
        : "Git status report is missing.",
      "outputs/admin/git-status-report.json",
      "Tracked local changes should not be left half-finished before push."
    ),
    check(
      "sensitive_files",
      "Sensitive file safety",
      stagedSensitiveFiles.length > 0 ? "blocked" : sensitiveFiles.length > 0 ? "review" : "passed",
      sensitiveFiles.length
        ? `${sensitiveFiles.map((item) => `${item.file} (${item.group})`).join(", ")}.`
        : "No sensitive domain file is changed or untracked.",
      "outputs/admin/git-status-report.json",
      "CNAME controls domain behavior. It should never be pushed accidentally."
    ),
    check(
      "push_package",
      "Push package",
      !pushPackage
        ? "not_run"
        : pushSummary.status === "blocked" || (pushSummary.behind || 0) > 0
          ? "blocked"
          : pushSummary.commitListComplete === false
            ? "blocked"
          : (pushSummary.ahead || 0) > 0
            ? "review"
            : "passed",
      pushPackage
        ? `${pushSummary.ahead || 0} commit(s) ahead, ${pushSummary.behind || 0} behind, ${pushSummary.commits || 0} listed.`
        : "Push package report is missing.",
      "outputs/admin/push-package-report.json",
      "This tells you exactly whether GitHub will receive new commits."
    ),
    check(
      "pre_publish",
      "Unpublished draft safety",
      !prePublish
        ? "not_run"
        : prePublishSummary.status === "blocked" || (prePublishSummary.blockedDrafts || 0) > 0
          ? "blocked"
          : (prePublishSummary.readyDrafts || 0) > 0
            ? "review"
            : "passed",
      prePublish
        ? `${prePublishSummary.readyDrafts || 0} ready draft(s), ${prePublishSummary.blockedDrafts || 0} blocked draft(s).`
        : "Pre-publish checklist is missing.",
      "outputs/admin/pre-publish-checklist-report.json",
      "Ready drafts should not be forgotten before pushing a deploy package."
    ),
    check(
      "publish_wizard",
      "Publish wizard state",
      !publishWizard
        ? "not_run"
        : wizardSummary.status === "blocked"
          ? "blocked"
          : wizardSummary.status === "idle"
            ? "passed"
            : "review",
      publishWizard
        ? `Status: ${wizardSummary.status || "unknown"}, current step: ${wizardSummary.currentStep || "unknown"}.`
        : "Publish wizard report is missing.",
      "outputs/admin/publish-wizard-report.json",
      "The publish wizard should not be mid-flow when you push."
    ),
    check(
      "deployment_readiness",
      "Deployment readiness",
      !deployment
        ? "not_run"
        : deploymentSummary.status === "blocked"
          ? "blocked"
          : deploymentSummary.status === "ready"
            ? "passed"
            : "review",
      deployment
        ? deployment.nextAction || `Status: ${deploymentSummary.status || "unknown"}.`
        : "Deployment readiness report is missing.",
      "outputs/admin/deployment-readiness-report.json",
      "Cloudflare Pages may deploy after GitHub receives the push."
    ),
  ];

  const blocked = checks.filter((item) => item.status === "blocked" || item.status === "not_run");
  const review = checks.filter((item) => item.status === "review");

  let decision = "safe_after_human_review";
  let nextAction = "All hard safety gates passed. Review the commit list one last time before pushing.";

  if ((pushSummary.ahead || 0) === 0 && blocked.length === 0) {
    decision = "nothing_to_push";
    nextAction = "There are no local commits waiting for GitHub. Do not push unless you intentionally create a commit first.";
  }

  if (review.length > 0 && blocked.length === 0) {
    decision = "review_first";
    nextAction = `Review before push: ${review[0].label}. ${review[0].detail}`;
  }

  if (blocked.length > 0) {
    decision = "do_not_push";
    nextAction = `Do not push yet. Fix this first: ${blocked[0].label}. ${blocked[0].detail}`;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blocked.length > 0 ? "blocked" : review.length > 0 ? "review" : "passed",
      decision,
      checks: checks.length,
      passed: checks.filter((item) => item.status === "passed").length,
      review: review.length,
      blocked: blocked.length,
      branch: gitSummary.branch || null,
      latestCommit: gitSummary.latestCommit || null,
      commitsAhead: pushSummary.ahead || 0,
      commitsBehind: pushSummary.behind || 0,
      changedFiles: gitSummary.totalChangedFiles || 0,
      trackedChanges: trackedChanges.length,
      untrackedFiles: untrackedFiles.length,
      sensitiveFiles: sensitiveFiles.length,
    },
    nextAction,
    checks,
    finalHumanReview: [
      "Read the commit list in the Push Package report.",
      "Confirm no sensitive file such as CNAME is staged accidentally.",
      "Confirm sitemap.xml, robots.txt, and llms.txt checks passed through the full control report.",
      "Confirm there is no ready draft you expected to publish first.",
      "Push only when you intentionally want GitHub and Cloudflare to receive this package.",
    ],
    sources: [
      relative(CONTROL_FILE),
      relative(GIT_FILE),
      relative(PUSH_PACKAGE_FILE),
      relative(DEPLOYMENT_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(PUBLISH_WIZARD_FILE),
    ],
    guarantee:
      "Read-only safe push checklist. This script reads local admin reports and writes a local push decision only. It does not edit files, stage files, commit, push, pull, reset, delete, publish, restore, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Safe Push Checklist");
  console.log("===================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Decision: ${report.summary.decision}`);
  console.log(`Checks: ${report.summary.checks}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
