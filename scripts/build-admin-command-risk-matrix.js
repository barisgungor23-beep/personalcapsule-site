#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const COMMAND_GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-command-guide-report.json");
const ACTION_FLOW_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-action-flow-report.json");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-command-risk-matrix-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function riskLevel(command) {
  if (command.safety === "writes_live_content") return "critical";
  if (command.safety === "writes_backup") return "high";
  if (command.safety === "draft_only") return "medium";
  if (command.safety === "read_only") return "low";
  return "unknown";
}

function allowedPanelMode(command) {
  if (command.safety === "read_only" || command.safety === "draft_only") return "copy_command";
  return "manual_only";
}

function main() {
  const commandGuide = readJsonIfExists(COMMAND_GUIDE_FILE);
  const actionFlow = readJsonIfExists(ACTION_FLOW_FILE);
  const blockers = [];
  const warnings = [];

  if (!commandGuide || !Array.isArray(commandGuide.commands)) {
    blockers.push({
      scope: "command_guide",
      message: "Admin command guide is missing or invalid.",
    });
  }

  if (!actionFlow || !Array.isArray(actionFlow.actions)) {
    warnings.push({
      scope: "action_flow",
      message: "Admin action flow is missing. Button-mode cross-check will be less complete.",
    });
  }

  const commands = commandGuide && Array.isArray(commandGuide.commands) ? commandGuide.commands : [];
  const actions = actionFlow && Array.isArray(actionFlow.actions) ? actionFlow.actions : [];
  const actionByCommand = new Map(actions.map((action) => [action.command, action]));

  const matrix = commands.map((command) => {
    const action = actionByCommand.get(command.command);
    const level = riskLevel(command);
    const panelMode = allowedPanelMode(command);
    const expectedButtonMode = panelMode === "manual_only" ? "manual_confirm_required" : "copy_command";
    const actionButtonMode = action ? action.buttonMode : null;

    return {
      id: command.id,
      label: command.label,
      command: command.command,
      group: command.group,
      safety: command.safety,
      changesFiles: command.changesFiles,
      riskLevel: level,
      panelMode,
      actionButtonMode,
      buttonModeMatches: actionButtonMode ? actionButtonMode === expectedButtonMode : null,
      whenToUse: command.whenToUse,
      whatItDoes: command.whatItDoes,
      guardrail:
        level === "critical"
          ? "Manual confirmation only. Run dry-run, backup, and human review first."
          : level === "high"
            ? "Manual confirmation only. Use only when publish safety is ready."
            : level === "medium"
              ? "Can be copied, but it creates or changes draft files only."
              : "Can be copied. It should only create local reports or previews.",
    };
  });

  const mismatches = matrix.filter((item) => item.buttonModeMatches === false);
  for (const item of mismatches) {
    warnings.push({
      scope: item.id,
      message: `Action button mode does not match command risk: ${item.label}.`,
    });
  }

  const byRisk = matrix.reduce((summary, item) => {
    summary[item.riskLevel] = (summary[item.riskLevel] || 0) + 1;
    return summary;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      commands: matrix.length,
      lowRisk: byRisk.low || 0,
      mediumRisk: byRisk.medium || 0,
      highRisk: byRisk.high || 0,
      criticalRisk: byRisk.critical || 0,
      unknownRisk: byRisk.unknown || 0,
      buttonModeMismatches: mismatches.length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    matrix,
    rules: [
      "Low-risk commands can be copied because they only read or refresh local reports.",
      "Medium-risk commands can be copied only when they create draft files, not live content.",
      "High-risk commands require manual confirmation because they write backups.",
      "Critical-risk commands require manual confirmation because they can change live site files.",
      "Never expose one-click publish, restore, push, reset, or delete buttons in this panel.",
    ],
    blockers,
    warnings,
    sources: [relative(COMMAND_GUIDE_FILE), relative(ACTION_FLOW_FILE)],
    guarantee:
      "Read-only command risk matrix. This script reads local admin reports and writes a local risk summary only. It does not execute commands, edit files, publish, restore, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Command Risk Matrix");
  console.log("=========================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Commands: ${report.summary.commands}`);
  console.log(`Critical risk: ${report.summary.criticalRisk}`);
  console.log(`Button mismatches: ${report.summary.buttonModeMismatches}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
