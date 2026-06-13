#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const OPERATIONS_MANUAL_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-operations-manual-report.json");
const QUICK_START_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-quick-start-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const operationsManual = readJsonIfExists(OPERATIONS_MANUAL_FILE);
  const blockers = [];
  const warnings = [];

  if (!control) {
    blockers.push({
      scope: "control_report",
      message: "Control report is missing. Run node scripts/run-admin-control-check.js first.",
    });
  }

  if (!deployment) {
    warnings.push({
      scope: "deployment_readiness",
      message: "Deployment readiness report is missing. Deploy status will be less clear.",
    });
  }

  if (!operationsManual) {
    warnings.push({
      scope: "operations_manual",
      message: "Operations manual is missing. Workflow guidance will be less clear.",
    });
  }

  const controlSummary = control && control.summary ? control.summary : {};
  const deploymentSummary = deployment && deployment.summary ? deployment.summary : {};
  const operationsSummary = operationsManual && operationsManual.summary ? operationsManual.summary : {};

  const cards = [
    {
      id: "first_command",
      title: "Start here",
      priority: 1,
      status: controlSummary.status === "passed" ? "ready" : control ? "blocked" : "not_run",
      instruction: "Run the full local control check before trusting any panel result.",
      command: "node scripts/run-admin-control-check.js",
      doneWhen: "The summary says every step passed.",
    },
    {
      id: "open_panel",
      title: "Open the local panel",
      priority: 2,
      status: "ready",
      instruction: "Open the local admin preview and review the left-side safety cards first.",
      command: "Open outputs/admin/index.html in a browser",
      doneWhen: "You can see Control Center, Git Status, Push Package, Deployment Readiness, and Operations Manual.",
    },
    {
      id: "deploy_decision",
      title: "Decide if deploy is safe",
      priority: 3,
      status:
        deploymentSummary.status === "ready"
          ? "ready"
          : deploymentSummary.status === "blocked"
            ? "blocked"
            : deployment
              ? "review"
              : "not_run",
      instruction: "Use Deployment Readiness as the final deploy decision card.",
      command: "Review outputs/admin/deployment-readiness-report.json",
      doneWhen: "There are no blocked checks, and any review items are intentional.",
    },
    {
      id: "choose_workflow",
      title: "Choose the workflow",
      priority: 4,
      status: operationsSummary.status === "passed" ? "ready" : operationsManual ? "blocked" : "not_run",
      instruction: "Use Admin Operations Manual to choose the correct workflow for the job.",
      command: "Review outputs/admin/admin-operations-manual-report.json",
      doneWhen: "You know whether you are doing a health check, draft creation, publish, restore, or push/deploy.",
    },
    {
      id: "never_skip_review",
      title: "Never skip review",
      priority: 5,
      status: "ready",
      instruction: "Before push or confirmed publish, manually review the changed files and the push package.",
      command: "Review Git Status / Push Safety and Push Package in the panel",
      doneWhen: "Only intentional files and commits are included.",
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      cards: cards.length,
      blockers: blockers.length,
      warnings: warnings.length,
      controlStatus: controlSummary.status || null,
      deploymentStatus: deploymentSummary.status || null,
      operationsStatus: operationsSummary.status || null,
    },
    blockers,
    warnings,
    cards,
    safestDefault:
      "When unsure, do not publish and do not push. Run the full control check, review the local admin panel, then decide.",
    guarantee:
      "Read-only quick start guidance. This script writes local guidance only. It does not edit content, publish files, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(QUICK_START_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Quick Start");
  console.log("=================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Cards: ${report.summary.cards}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(QUICK_START_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
