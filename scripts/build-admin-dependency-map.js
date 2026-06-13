#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-dependency-map-report.json");

const nodes = [
  {
    id: "admin_read_model",
    label: "Admin read model",
    output: "outputs/admin/admin-read-model.json",
    type: "model",
    dependsOn: ["content_files", "site_files"],
    usedBy: ["admin_preview", "control_report", "system_overview"],
  },
  {
    id: "control_report",
    label: "Full control report",
    output: "outputs/admin/control-report.json",
    type: "control",
    dependsOn: ["all_control_steps"],
    usedBy: ["admin_preview", "system_overview", "deployment_readiness", "failure_playbook"],
  },
  {
    id: "admin_preview",
    label: "Admin preview",
    output: "outputs/admin/index.html",
    type: "preview",
    dependsOn: ["admin_read_model", "control_report", "report_outputs"],
    usedBy: ["audit_admin_preview", "human_review"],
  },
  {
    id: "draft_quality",
    label: "Draft quality",
    output: "outputs/admin/draft-quality-report.json",
    type: "draft",
    dependsOn: ["draft_files", "editor_rules"],
    usedBy: ["draft_fix_list", "draft_edit_plan", "pre_publish_checklist"],
  },
  {
    id: "draft_fix_list",
    label: "Draft fix list",
    output: "outputs/admin/draft-fix-list-report.json",
    type: "draft",
    dependsOn: ["draft_quality"],
    usedBy: ["draft_edit_guide"],
  },
  {
    id: "draft_edit_plan",
    label: "Draft edit plan",
    output: "outputs/admin/draft-edit-plan-report.json",
    type: "draft",
    dependsOn: ["draft_quality", "editor_rules"],
    usedBy: ["draft_edit_guide", "admin_preview"],
  },
  {
    id: "draft_edit_guide",
    label: "Draft edit guide",
    output: "outputs/admin/draft-edit-guide-report.json",
    type: "draft",
    dependsOn: ["draft_fix_list", "draft_edit_plan"],
    usedBy: ["admin_preview", "human_draft_editing"],
  },
  {
    id: "publish_readiness",
    label: "Publish readiness",
    output: "outputs/admin/publish-readiness-report.json",
    type: "publish",
    dependsOn: ["draft_quality", "draft_comparison", "draft_publish_intent"],
    usedBy: ["pre_publish_checklist", "deployment_readiness"],
  },
  {
    id: "publish_dry_run",
    label: "Publish dry run",
    output: "outputs/admin/publish-dry-run-report.json",
    type: "publish",
    dependsOn: ["publish_readiness", "draft_files"],
    usedBy: ["pre_publish_checklist", "backup_snapshot", "human_review"],
  },
  {
    id: "rollback_plan",
    label: "Rollback plan",
    output: "outputs/admin/publish-rollback-plan.json",
    type: "publish",
    dependsOn: ["publish_dry_run"],
    usedBy: ["pre_publish_checklist", "restore_dry_run"],
  },
  {
    id: "backup_snapshot",
    label: "Backup snapshot dry run",
    output: "outputs/admin/backup-snapshot-dry-run-report.json",
    type: "backup",
    dependsOn: ["publish_dry_run", "rollback_plan"],
    usedBy: ["pre_publish_checklist", "confirmed_publish"],
  },
  {
    id: "pre_publish_checklist",
    label: "Pre-publish checklist",
    output: "outputs/admin/pre-publish-checklist-report.json",
    type: "publish",
    dependsOn: ["publish_readiness", "publish_dry_run", "rollback_plan", "backup_snapshot"],
    usedBy: ["deployment_readiness", "confirmed_publish"],
  },
  {
    id: "git_status",
    label: "Git status",
    output: "outputs/admin/git-status-report.json",
    type: "git",
    dependsOn: ["working_tree"],
    usedBy: ["push_package", "deployment_readiness", "failure_playbook"],
  },
  {
    id: "push_package",
    label: "Push package",
    output: "outputs/admin/push-package-report.json",
    type: "git",
    dependsOn: ["git_status", "local_commits", "origin_main"],
    usedBy: ["deployment_readiness", "failure_playbook"],
  },
  {
    id: "deployment_readiness",
    label: "Deployment readiness",
    output: "outputs/admin/deployment-readiness-report.json",
    type: "deploy",
    dependsOn: ["control_report", "git_status", "push_package", "pre_publish_checklist"],
    usedBy: ["system_overview", "failure_playbook", "human_deploy_decision"],
  },
  {
    id: "report_index",
    label: "Admin report index",
    output: "outputs/admin/admin-report-index.json",
    type: "reports",
    dependsOn: ["report_outputs"],
    usedBy: ["report_freshness", "failure_playbook", "admin_preview"],
  },
  {
    id: "report_freshness",
    label: "Admin report freshness",
    output: "outputs/admin/admin-report-freshness-report.json",
    type: "reports",
    dependsOn: ["report_index"],
    usedBy: ["failure_playbook", "admin_preview"],
  },
  {
    id: "failure_playbook",
    label: "Admin failure playbook",
    output: "outputs/admin/admin-failure-playbook-report.json",
    type: "reports",
    dependsOn: ["control_report", "report_index", "report_freshness", "git_status", "push_package", "deployment_readiness", "pre_publish_checklist"],
    usedBy: ["admin_preview", "human_recovery_decision"],
  },
  {
    id: "system_overview",
    label: "Admin system overview",
    output: "outputs/admin/admin-system-overview-report.json",
    type: "overview",
    dependsOn: ["admin_read_model", "control_report", "deployment_readiness", "push_package", "git_status"],
    usedBy: ["admin_preview", "human_review"],
  },
];

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function outputExists(output) {
  return fs.existsSync(path.join(ROOT, output));
}

function typeCounts() {
  return nodes.reduce((summary, node) => {
    summary[node.type] = (summary[node.type] || 0) + 1;
    return summary;
  }, {});
}

function findUnknownReferences() {
  const known = new Set(nodes.map((node) => node.id));
  const externalReferences = new Set([
    "all_control_steps",
    "audit_admin_preview",
    "confirmed_publish",
    "content_files",
    "draft_comparison",
    "draft_files",
    "draft_publish_intent",
    "editor_rules",
    "human_deploy_decision",
    "human_draft_editing",
    "human_recovery_decision",
    "human_review",
    "local_commits",
    "origin_main",
    "report_outputs",
    "restore_dry_run",
    "site_files",
    "working_tree",
  ]);

  return nodes.flatMap((node) =>
    [...node.dependsOn, ...node.usedBy]
      .filter((id) => !known.has(id) && !externalReferences.has(id))
      .map((id) => ({ node: node.id, unknownReference: id }))
  );
}

function main() {
  const enrichedNodes = nodes.map((node) => ({
    ...node,
    outputExists: outputExists(node.output),
    directDependencyCount: node.dependsOn.length,
    usedByCount: node.usedBy.length,
  }));
  const missingOutputs = enrichedNodes.filter((node) => !node.outputExists);
  const unknownReferences = findUnknownReferences();
  const blockers = unknownReferences.map((item) => ({
    scope: item.node,
    message: `Unknown dependency reference: ${item.unknownReference}`,
  }));
  const warnings = missingOutputs.map((node) => ({
    scope: node.id,
    message: `Expected output is missing or has not been generated yet: ${node.output}`,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      nodes: enrichedNodes.length,
      dependencyLinks: enrichedNodes.reduce((total, node) => total + node.dependsOn.length, 0),
      usedByLinks: enrichedNodes.reduce((total, node) => total + node.usedBy.length, 0),
      missingOutputs: missingOutputs.length,
      blockers: blockers.length,
      warnings: warnings.length,
      typeCounts: typeCounts(),
    },
    blockers,
    warnings,
    nodes: enrichedNodes,
    criticalPath: [
      "content_files",
      "admin_read_model",
      "control_report",
      "git_status",
      "push_package",
      "deployment_readiness",
      "failure_playbook",
      "admin_preview",
      "human_review",
    ],
    explanation:
      "This map explains how local admin reports depend on each other. It is for understanding and safety only.",
    guarantee:
      "Read-only dependency map. This script reads local output existence and writes a local dependency report only. It does not edit content, publish files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Dependency Map");
  console.log("====================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Nodes: ${report.summary.nodes}`);
  console.log(`Dependency links: ${report.summary.dependencyLinks}`);
  console.log(`Missing outputs: ${report.summary.missingOutputs}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
