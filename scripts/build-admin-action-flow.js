#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const COMMAND_GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-command-guide-report.json");
const OPERATIONS_MANUAL_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-operations-manual-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-action-flow-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function commandMap(commandGuide) {
  const commands = commandGuide && Array.isArray(commandGuide.commands) ? commandGuide.commands : [];
  return new Map(commands.map((item) => [item.id, item]));
}

function commandText(commands, id, fallback) {
  const item = commands.get(id);
  return item ? item.command : fallback;
}

function action(id, label, phase, command, safety, enabledWhen, nextCheck) {
  return {
    id,
    label,
    phase,
    command,
    safety,
    enabledWhen,
    nextCheck,
    buttonMode: safety === "read_only" || safety === "draft_only" ? "copy_command" : "manual_confirm_required",
  };
}

function main() {
  const commandGuide = readJsonIfExists(COMMAND_GUIDE_FILE);
  const operationsManual = readJsonIfExists(OPERATIONS_MANUAL_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const commands = commandMap(commandGuide);
  const blockers = [];
  const warnings = [];

  if (!commandGuide) {
    blockers.push({
      scope: "command_guide",
      message: "Admin command guide is missing. Run the full control check first.",
    });
  }

  if (!operationsManual) {
    warnings.push({
      scope: "operations_manual",
      message: "Operations manual is missing. Workflow descriptions will be less complete.",
    });
  }

  const prePublishStatus = prePublish && prePublish.summary ? prePublish.summary.status : "missing";
  const deploymentStatus = deployment && deployment.summary ? deployment.summary.status : "missing";

  const actions = [
    action(
      "run_full_control",
      "Run full control check",
      "system",
      commandText(commands, "full_control_check", "node scripts/run-admin-control-check.js"),
      "read_only",
      "Always safe before reviewing admin data.",
      "Admin preview and all local reports should refresh."
    ),
    action(
      "create_draft",
      "Create new article draft",
      "draft",
      commandText(commands, "create_new_article_draft", 'node scripts/create-new-article-draft.js new-article-slug --category open-when-letters --title "New Article Title" --confirm'),
      "draft_only",
      "Use when writing a new private draft.",
      "Run full control check after editing the draft."
    ),
    action(
      "create_existing_edit_draft",
      "Create existing article edit draft",
      "draft",
      commandText(commands, "create_existing_article_edit_draft", "node scripts/create-article-draft.js what-is-a-digital-time-capsule --confirm"),
      "draft_only",
      "Use when improving a published article without touching the live file directly.",
      "Generate draft preview, then run draft quality and comparison checks."
    ),
    action(
      "generate_preview",
      "Generate draft previews",
      "preview",
      commandText(commands, "generate_draft_previews", "node scripts/generate-draft-preview.js --all"),
      "read_only",
      "Use after draft text changes.",
      "Review draft preview in outputs/drafts."
    ),
    action(
      "audit_draft",
      "Audit draft quality",
      "review",
      commandText(commands, "draft_quality", "node scripts/audit-draft-quality.js"),
      "read_only",
      "Use before marking a draft ready.",
      "Open Draft Quality and Draft Fix List cards."
    ),
    action(
      "publish_readiness",
      "Check publish readiness",
      "publish_safety",
      commandText(commands, "publish_readiness", "node scripts/check-publish-readiness.js"),
      "read_only",
      "Use only after draft fixes are complete.",
      "Pre-Publish Checklist should be ready or idle."
    ),
    action(
      "publish_dry_run",
      "Run publish dry-run",
      "publish_safety",
      commandText(commands, "publish_dry_run", "node scripts/publish-article-draft-dry-run.js --dry-run"),
      "read_only",
      "Use before any confirmed publish.",
      "Draft Publish Simulation should list only intended files."
    ),
    action(
      "backup_snapshot",
      "Create backup snapshot",
      "backup",
      commandText(commands, "backup_snapshot", "node scripts/create-backup-snapshot.js --confirm"),
      "writes_backup",
      `Use only when Pre-Publish status is ready. Current status: ${prePublishStatus}.`,
      "Backup Snapshot card should show planned files."
    ),
    action(
      "confirmed_publish",
      "Confirmed publish",
      "publish",
      commandText(commands, "publish_confirmed", "node scripts/publish-article-draft.js --confirm"),
      "writes_live_content",
      "Use only after dry-run, backup, and final human review.",
      "Run full control check immediately after publish."
    ),
    action(
      "restore_dry_run",
      "Restore dry-run",
      "restore",
      commandText(commands, "restore_dry_run", "node scripts/restore-backup-snapshot-dry-run.js"),
      "read_only",
      "Use if a confirmed publish looks wrong.",
      "Review Restore Dry Run before any confirmed restore."
    ),
    action(
      "confirmed_restore",
      "Confirmed restore",
      "restore",
      commandText(commands, "restore_confirmed", "node scripts/restore-backup-snapshot.js --confirm"),
      "writes_live_content",
      "Use only if a restore is truly needed and dry-run is correct.",
      "Run full control check immediately after restore."
    ),
  ];

  const phases = actions.reduce((summary, item) => {
    summary[item.phase] = (summary[item.phase] || 0) + 1;
    return summary;
  }, {});
  const highRiskActions = actions.filter((item) => item.safety === "writes_live_content");

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      actions: actions.length,
      highRiskActions: highRiskActions.length,
      copyCommandActions: actions.filter((item) => item.buttonMode === "copy_command").length,
      manualConfirmActions: actions.filter((item) => item.buttonMode === "manual_confirm_required").length,
      phases,
      prePublishStatus,
      deploymentStatus,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    actions,
    rules: [
      "Panel action buttons are command guidance only.",
      "Read-only and draft-only actions can be copied safely.",
      "Backup, publish, and restore actions require manual confirmation outside the panel.",
      "Never run confirmed publish or restore before dry-run and human review.",
      "Run the full control check after every confirmed publish or restore.",
    ],
    guarantee:
      "Read-only action flow. This script writes local command guidance only. It does not execute commands, edit content, publish files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Action Flow");
  console.log("=================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Actions: ${report.summary.actions}`);
  console.log(`High-risk actions: ${report.summary.highRiskActions}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
