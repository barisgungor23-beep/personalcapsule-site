#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const FIX_LIST_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-fix-list-report.json");
const EDIT_PLAN_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-plan-report.json");
const GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-guide-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function normalizeFieldName(field) {
  return String(field || "")
    .split(",")[0]
    .replace(/\[\]/g, "")
    .replace(/\..*$/, "")
    .trim();
}

function hasMultipleFields(field) {
  return String(field || "").includes(",");
}

function buildFieldLookup(editPlan) {
  const lookup = new Map();
  for (const plan of editPlan && Array.isArray(editPlan.plans) ? editPlan.plans : []) {
    const fields = new Map();
    for (const field of Array.isArray(plan.fields) ? plan.fields : []) {
      fields.set(field.key, field);
    }
    lookup.set(plan.id, {
      draftTitle: plan.title,
      draftPath: plan.draft,
      fields,
    });
  }
  return lookup;
}

function fallbackFieldInfo(fieldName) {
  if (!fieldName || fieldName === "whole file") {
    return {
      key: fieldName || "whole file",
      label: fieldName || "Whole file",
      mode: "controlled",
      publishRisk: "high",
      action: "edit_with_review",
      why: "This fix affects the draft file structure or a field that needs manual review.",
    };
  }

  return {
    key: fieldName,
    label: fieldName,
    mode: "controlled",
    publishRisk: "medium",
    action: "edit_with_review",
    why: "This field was not found in the edit plan, so it should be reviewed carefully.",
  };
}

function resolveFieldInfo(fix, draftPlan) {
  if (hasMultipleFields(fix.field)) {
    return {
      key: "multiple_fields",
      label: "Multiple public content fields",
      mode: "controlled",
      publishRisk: "medium",
      action: "edit_with_review",
      why: "This fix can touch several reader-facing fields, so each change should be reviewed in the draft preview.",
    };
  }

  const fieldName = normalizeFieldName(fix.field);
  if (draftPlan && draftPlan.fields.has(fieldName)) {
    return draftPlan.fields.get(fieldName);
  }

  return fallbackFieldInfo(fieldName || fix.field);
}

function buildGuideSteps(fixList, editPlan) {
  const fieldLookup = buildFieldLookup(editPlan);
  const fixes = fixList && Array.isArray(fixList.fixes) ? fixList.fixes : [];

  return fixes.map((fix, index) => {
    const draftPlan = fieldLookup.get(fix.draftId);
    const fieldInfo = resolveFieldInfo(fix, draftPlan);

    return {
      order: index + 1,
      draftId: fix.draftId,
      draftTitle: fix.draftTitle,
      draftPath: fix.draftPath,
      issue: fix.label,
      severity: fix.severity,
      field: fieldInfo.key,
      fieldLabel: fieldInfo.label,
      editMode: fieldInfo.mode,
      publishRisk: fieldInfo.publishRisk,
      action: fieldInfo.action,
      why: fieldInfo.why,
      instruction: fix.howToFix || fix.fix,
      doneWhen: fix.doneWhen || "Run the full control check and confirm this item disappears.",
    };
  });
}

function main() {
  const fixList = readJsonIfExists(FIX_LIST_FILE);
  const editPlan = readJsonIfExists(EDIT_PLAN_FILE);
  const blockers = [];

  if (!fixList) {
    blockers.push({
      scope: "draft_fix_list",
      message: "Draft fix list report is missing. Run build-draft-fix-list.js first.",
    });
  }

  if (!editPlan) {
    blockers.push({
      scope: "draft_edit_plan",
      message: "Draft edit plan report is missing. Run build-draft-edit-plan.js first.",
    });
  }

  const steps = blockers.length === 0 ? buildGuideSteps(fixList, editPlan) : [];
  const highRiskSteps = steps.filter((step) => step.publishRisk === "high").length;
  const controlledSteps = steps.filter((step) => step.editMode === "controlled").length;
  const lockedSteps = steps.filter((step) => step.editMode === "locked").length;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : steps.length > 0 ? "action_needed" : "passed",
      draftFixes: steps.length,
      highRiskSteps,
      controlledSteps,
      lockedSteps,
      blockers: blockers.length,
    },
    blockers,
    steps,
    workflow: [
      "Edit only the draft JSON file listed in each step.",
      "Do not edit published HTML pages directly.",
      "After editing, run node scripts/run-admin-control-check.js.",
      "Review outputs/admin/index.html and the draft preview before publishing.",
      "Publish only when every safety gate passes.",
    ],
    guarantee:
      "Read-only edit guidance. This script only reads draft fix and edit-plan reports, then writes a local guide. It does not edit drafts, publish files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(GUIDE_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Edit Guide");
  console.log("================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Draft fixes: ${report.summary.draftFixes}`);
  console.log(`High-risk steps: ${report.summary.highRiskSteps}`);
  console.log(`Controlled steps: ${report.summary.controlledSteps}`);
  console.log(`Locked steps: ${report.summary.lockedSteps}`);
  console.log(`Report: ${relative(GUIDE_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
