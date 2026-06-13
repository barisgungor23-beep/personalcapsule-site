#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-workflow-guide-report.json");

const OPERATIONS_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-operations-manual-report.json");
const ACTION_FLOW_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-action-flow-report.json");
const FINAL_PUSH_FILE = path.join(ADMIN_OUTPUT_DIR, "final-push-review-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const BACKUP_RESTORE_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-restore-center-report.json");
const DRAFT_QUALITY_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");

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

function actionByCommand(actions, command) {
  return actions.find((item) => item.command === command) || null;
}

function modeForStep(step, actions) {
  const action = actionByCommand(actions, step.command);
  if (action) return action.buttonMode || "manual_review";
  if (step.command.startsWith("Review ") || step.command.startsWith("Open ") || step.command.startsWith("Edit ")) {
    return "manual_review";
  }
  if (step.command.startsWith("Set ")) return "manual_edit";
  if (step.command === "git push") return "manual_confirm_required";
  return "manual_review";
}

function riskForWorkflow(workflow) {
  if (workflow.risk === "very_high") return "manual_confirm_required";
  if (workflow.risk === "high") return "review_first";
  if (workflow.risk === "medium") return "draft_only";
  return "safe";
}

function statusForWorkflow(workflow, context) {
  if (workflow.id === "daily_health_check") return context.controlReady ? "ready" : "review";
  if (workflow.id === "create_new_article") return "ready";
  if (workflow.id === "prepare_publish") {
    if (context.blockedDrafts > 0) return "blocked";
    return context.readyDrafts > 0 ? "review" : "idle";
  }
  if (workflow.id === "confirmed_publish") {
    if (context.readyDrafts === 0) return "idle";
    return context.backupReady ? "review" : "blocked";
  }
  if (workflow.id === "push_and_deploy") {
    if (context.pushStatus === "blocked") return "blocked";
    return context.commitsAhead > 0 ? "review" : "idle";
  }
  if (workflow.id === "restore_after_problem") {
    return context.backupReady ? "review" : "idle";
  }
  return "review";
}

function main() {
  const operations = readJsonIfExists(OPERATIONS_FILE);
  const actionFlow = readJsonIfExists(ACTION_FLOW_FILE);
  const finalPush = readJsonIfExists(FINAL_PUSH_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const backupRestore = readJsonIfExists(BACKUP_RESTORE_FILE);
  const draftQuality = readJsonIfExists(DRAFT_QUALITY_FILE);

  const operationsSummary = summaryOf(operations);
  const actionSummary = summaryOf(actionFlow);
  const finalPushSummary = summaryOf(finalPush);
  const prePublishSummary = summaryOf(prePublish);
  const backupSummary = summaryOf(backupRestore);
  const draftSummary = summaryOf(draftQuality);

  const workflows = operations && Array.isArray(operations.workflows) ? operations.workflows : [];
  const actions = actionFlow && Array.isArray(actionFlow.actions) ? actionFlow.actions : [];
  const blockers = [];
  const warnings = [];

  if (!operations || operationsSummary.status !== "passed") {
    blockers.push({
      scope: "operations_manual",
      message: "Operations manual must pass before workflow guide can be trusted.",
    });
  }

  if (!actionFlow || actionSummary.status !== "passed") {
    blockers.push({
      scope: "action_flow",
      message: "Action flow must pass before command buttons can be trusted.",
    });
  }

  const context = {
    controlReady: operationsSummary.status === "passed" && actionSummary.status === "passed",
    readyDrafts: prePublishSummary.readyDrafts || 0,
    blockedDrafts: prePublishSummary.blockedDrafts || 0,
    backupReady: Boolean(backupSummary.confirmedBackupAvailable),
    pushStatus: finalPushSummary.status || "unknown",
    commitsAhead: finalPushSummary.commitsAhead || 0,
    draftStatus: draftSummary.status || "unknown",
  };

  const guidedWorkflows = workflows.map((workflow) => {
    const steps = (workflow.steps || []).map((step, index) => ({
      order: index + 1,
      label: step.label,
      command: step.command,
      expectedResult: step.expectedResult,
      buttonMode: modeForStep(step, actions),
    }));

    return {
      id: workflow.id,
      title: workflow.title,
      purpose: workflow.purpose,
      risk: workflow.risk,
      status: statusForWorkflow(workflow, context),
      safestMode: riskForWorkflow(workflow),
      steps,
    };
  });

  if (context.blockedDrafts > 0) {
    warnings.push({
      scope: "drafts",
      message: `${context.blockedDrafts} blocked draft(s) should be fixed before publish workflow.`,
    });
  }

  const activeRecommendation =
    guidedWorkflows.find((workflow) => workflow.status === "blocked") ||
    guidedWorkflows.find((workflow) => workflow.status === "review") ||
    guidedWorkflows.find((workflow) => workflow.id === "daily_health_check") ||
    null;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "review" : "passed",
      workflows: guidedWorkflows.length,
      ready: guidedWorkflows.filter((item) => item.status === "ready").length,
      review: guidedWorkflows.filter((item) => item.status === "review").length,
      blocked: guidedWorkflows.filter((item) => item.status === "blocked").length,
      idle: guidedWorkflows.filter((item) => item.status === "idle").length,
      copyableSteps: guidedWorkflows.flatMap((item) => item.steps).filter((step) => step.buttonMode === "copy_command").length,
      manualSteps: guidedWorkflows.flatMap((item) => item.steps).filter((step) => step.buttonMode !== "copy_command").length,
      blockers: blockers.length,
      warnings: warnings.length,
      commitsAhead: context.commitsAhead,
      readyDrafts: context.readyDrafts,
    },
    activeRecommendation: activeRecommendation
      ? {
          id: activeRecommendation.id,
          title: activeRecommendation.title,
          status: activeRecommendation.status,
          reason:
            activeRecommendation.status === "blocked"
              ? "This workflow has a safety blocker."
              : activeRecommendation.status === "review"
                ? "This workflow needs human review before action."
                : "This is the safest starting point.",
        }
      : null,
    context,
    workflows: guidedWorkflows,
    blockers,
    warnings,
    rules: [
      "Copy command buttons only copy text; they never execute commands.",
      "Manual review steps must be completed by a human outside the panel.",
      "Confirmed publish, restore, push, reset, or delete must never become one-click actions.",
      "Run the full control check after every manual file-changing action.",
    ],
    sources: [
      relative(OPERATIONS_FILE),
      relative(ACTION_FLOW_FILE),
      relative(FINAL_PUSH_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(BACKUP_RESTORE_FILE),
      relative(DRAFT_QUALITY_FILE),
    ],
    guarantee:
      "Read-only admin workflow guide. This script reads local admin reports and writes local workflow guidance only. It does not edit content, publish files, copy backups, restore files, stage files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Workflow Guide");
  console.log("====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Workflows: ${report.summary.workflows}`);
  console.log(`Copyable steps: ${report.summary.copyableSteps}`);
  console.log(`Manual steps: ${report.summary.manualSteps}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
