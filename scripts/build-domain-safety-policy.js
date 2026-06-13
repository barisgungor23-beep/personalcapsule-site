#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "domain-safety-policy-report.json");

const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const SAFE_PUSH_FILE = path.join(ADMIN_OUTPUT_DIR, "safe-push-checklist-report.json");

const DOMAIN_FILES = new Set(["CNAME"]);

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

function main() {
  const git = readJsonIfExists(GIT_FILE);
  const safePush = readJsonIfExists(SAFE_PUSH_FILE);
  const gitSummary = summaryOf(git);
  const safePushSummary = summaryOf(safePush);
  const files = git && Array.isArray(git.files) ? git.files : [];
  const domainFiles = files.filter((item) => DOMAIN_FILES.has(item.file));
  const stagedDomainFiles = domainFiles.filter((item) => item.group === "staged");
  const trackedDomainFiles = domainFiles.filter((item) => item.group === "staged" || item.group === "unstaged" || item.group === "modified");
  const untrackedDomainFiles = domainFiles.filter((item) => item.group === "untracked");

  const checks = [
    {
      id: "git_report",
      label: "Git report available",
      status: git ? "passed" : "not_run",
      detail: git ? `${gitSummary.totalChangedFiles || 0} changed file(s) are visible to Git.` : "Git status report is missing.",
    },
    {
      id: "domain_file_present",
      label: "Domain file visibility",
      status: domainFiles.length > 0 ? "review" : "passed",
      detail: domainFiles.length
        ? domainFiles.map((item) => `${item.file} is ${item.group}`).join(", ")
        : "No domain-control file is currently changed or untracked.",
    },
    {
      id: "domain_file_not_staged",
      label: "Domain file not staged",
      status: stagedDomainFiles.length > 0 ? "blocked" : "passed",
      detail: stagedDomainFiles.length
        ? `${stagedDomainFiles.map((item) => item.file).join(", ")} is staged.`
        : "No domain-control file is staged for commit.",
    },
    {
      id: "safe_push_awareness",
      label: "Safe push awareness",
      status: safePush ? (safePushSummary.sensitiveFiles > 0 ? "review" : "passed") : "not_run",
      detail: safePush
        ? `Safe push sees ${safePushSummary.sensitiveFiles || 0} sensitive file(s). Decision: ${safePushSummary.decision || "unknown"}.`
        : "Safe push checklist report is missing.",
    },
  ];

  const blocked = checks.filter((item) => item.status === "blocked" || item.status === "not_run");
  const review = checks.filter((item) => item.status === "review");

  let status = "passed";
  let policyDecision = "domain_safe";
  let nextAction = "No domain file needs attention right now.";

  if (blocked.length > 0) {
    status = "blocked";
    policyDecision = "do_not_push_domain_change";
    nextAction = `Do not push until this is fixed: ${blocked[0].label}. ${blocked[0].detail}`;
  } else if (review.length > 0) {
    status = "review";
    policyDecision = "keep_untracked_unless_intentional";
    nextAction =
      "CNAME is visible as an untracked domain-control file. Leave it untracked unless you intentionally want to change domain behavior.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      policyDecision,
      checks: checks.length,
      passed: checks.filter((item) => item.status === "passed").length,
      review: review.length,
      blocked: blocked.length,
      domainFiles: domainFiles.length,
      stagedDomainFiles: stagedDomainFiles.length,
      trackedDomainFiles: trackedDomainFiles.length,
      untrackedDomainFiles: untrackedDomainFiles.length,
    },
    nextAction,
    checks,
    currentDomainFiles: domainFiles,
    policy: [
      "CNAME controls the public domain behavior for GitHub Pages-style hosting.",
      "Because the live site is now served through Cloudflare Pages, CNAME must not be committed accidentally.",
      "An untracked CNAME file is a review item, not an automatic blocker.",
      "A staged or tracked CNAME change is a blocker unless the domain migration decision is intentional.",
      "Before push, confirm CNAME is not staged unless you explicitly want domain behavior to change.",
    ],
    sources: [relative(GIT_FILE), relative(SAFE_PUSH_FILE)],
    guarantee:
      "Read-only domain safety policy. This script reads local admin reports and writes a local policy report only. It does not edit CNAME, stage files, commit, push, pull, reset, delete, publish, restore, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Domain Safety Policy");
  console.log("====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Decision: ${report.summary.policyDecision}`);
  console.log(`Domain files: ${report.summary.domainFiles}`);
  console.log(`Staged domain files: ${report.summary.stagedDomainFiles}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
