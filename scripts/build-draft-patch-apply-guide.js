#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-patch-apply-guide-report.json");
const RULES_FILE = path.join(ROOT, "content", "admin", "article-editor-rules.json");
const EDIT_PLAN_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-plan-report.json");
const EDIT_GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-guide-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function main() {
  const rules = readJsonIfExists(RULES_FILE);
  const editPlan = readJsonIfExists(EDIT_PLAN_FILE);
  const editGuide = readJsonIfExists(EDIT_GUIDE_FILE);
  const blockers = [];
  const warnings = [];

  if (!rules || !Array.isArray(rules.fields)) {
    blockers.push({
      scope: "editor_rules",
      message: "Article editor rules are missing. Patch apply guidance cannot describe safe fields.",
    });
  }

  if (!editPlan) {
    warnings.push({
      scope: "draft_edit_plan",
      message: "Draft edit plan is missing. Run the full control check to refresh draft editing context.",
    });
  }

  if (!editGuide) {
    warnings.push({
      scope: "draft_edit_guide",
      message: "Draft edit guide is missing. Run the full control check to refresh guided edit context.",
    });
  }

  const fields = rules && Array.isArray(rules.fields) ? rules.fields : [];
  const editableFields = fields.filter((field) => field.mode === "editable");
  const controlledFields = fields.filter((field) => field.mode === "controlled");
  const protectedFields = fields.filter((field) => field.mode === "generated" || field.mode === "locked");
  const highRiskFields = fields.filter((field) => field.publishRisk === "high");

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      patchMode: "local_draft_patch_v2",
      editableFields: editableFields.length,
      controlledFields: controlledFields.length,
      protectedFields: protectedFields.length,
      highRiskFields: highRiskFields.length,
      activeDrafts: editPlan && editPlan.summary ? editPlan.summary.drafts || 0 : 0,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    patchContract: {
      requiredMode: "local_draft_patch_v2",
      requiredTarget: "targetDraftPath",
      forbiddenTarget: "content/articles/*.json",
      expectedSourceLabel: "sourceArticlePath",
      rule:
        "A browser patch is instructions for a draft JSON file only. It must never be applied directly to a published content/articles file.",
    },
    applySteps: [
      {
        order: 1,
        title: "Create or locate the private draft",
        detail: "The patch target must be content/drafts/articles/{article-id}.draft.json. If that draft does not exist, create it first.",
      },
      {
        order: 2,
        title: "Copy only changedFields into the draft",
        detail: "Use changedFields as the value source. Do not copy browser-only safety metadata into the article body.",
      },
      {
        order: 3,
        title: "Review changedFieldDetails",
        detail: "If any field has reviewRequired true or high publishRisk, pause and inspect the field manually.",
      },
      {
        order: 4,
        title: "Run the full control check",
        detail: "Run node scripts/run-admin-control-check.js after applying the draft edit.",
      },
      {
        order: 5,
        title: "Preview before publish",
        detail: "Open the draft preview and review Draft Quality, Draft Fix List, Draft Edit Guide, and Publish Dry Run before marking ready.",
      },
    ],
    redFlags: [
      "Patch mode is not local_draft_patch_v2.",
      "targetDraftPath is missing.",
      "targetDraftPath points to content/articles instead of content/drafts/articles.",
      "sourceArticlePath is being used as the edit target.",
      "changedFieldDetails contains high-risk fields.",
      "The draft has not passed the full control check after applying edits.",
    ],
    fieldRules: fields.map((field) => ({
      key: field.key,
      label: field.label,
      mode: field.mode,
      publishRisk: field.publishRisk,
      patchRule:
        field.mode === "editable"
          ? "Can be copied into a draft patch after review."
          : field.mode === "controlled"
            ? "Can be changed only with extra human review."
            : "Do not copy from a browser patch manually.",
      why: field.why,
    })),
    blockers,
    warnings,
    sources: [relative(RULES_FILE), relative(EDIT_PLAN_FILE), relative(EDIT_GUIDE_FILE)],
    guarantee:
      "Read-only draft patch apply guide. This script reads local rules and reports, then writes a local guide only. It does not edit drafts, publish files, copy backups, restore files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Patch Apply Guide");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Patch mode: ${report.summary.patchMode}`);
  console.log(`Editable fields: ${report.summary.editableFields}`);
  console.log(`Red flags: ${report.redFlags.length}`);
  console.log(`Report: ${relative(REPORT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
