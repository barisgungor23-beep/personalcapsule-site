#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");
const RULES_FILE = path.join(ROOT, "content", "admin", "article-editor-rules.json");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-plan-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".draft.json"))
    .sort()
    .map((name) => path.join(DRAFTS_DIR, name));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function valueSummary(value) {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === "object") return `${Object.keys(value).length} key(s)`;
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 87)}...` : value;
  if (value === undefined) return "missing";
  return String(value);
}

function actionForMode(mode) {
  if (mode === "editable") return "edit_in_draft";
  if (mode === "controlled") return "edit_with_review";
  if (mode === "generated") return "do_not_type_manually";
  if (mode === "locked") return "do_not_edit";
  return "review_rule";
}

function main() {
  const rules = readJsonIfExists(RULES_FILE);
  const blockers = [];
  const warnings = [];
  const plans = [];

  if (!rules || !Array.isArray(rules.fields)) {
    blockers.push({
      scope: "editor_rules",
      message: "Article editor rules are missing or invalid.",
    });
  }

  const ruleFields = rules && Array.isArray(rules.fields) ? rules.fields : [];
  const drafts = listDrafts();

  for (const draftFile of drafts) {
    const draft = readJsonIfExists(draftFile);
    if (!draft) {
      blockers.push({
        scope: relative(draftFile),
        message: "Draft JSON cannot be read.",
      });
      continue;
    }

    const fields = ruleFields.map((rule) => ({
      key: rule.key,
      label: rule.label,
      mode: rule.mode,
      publishRisk: rule.publishRisk,
      action: actionForMode(rule.mode),
      why: rule.why,
      currentValue: valueSummary(draft[rule.key]),
      presentInDraft: Object.prototype.hasOwnProperty.call(draft, rule.key),
    }));

    const missingControlled = fields.filter(
      (field) => !field.presentInDraft && (field.mode === "editable" || field.mode === "controlled")
    );
    if (missingControlled.length > 0) {
      warnings.push({
        scope: relative(draftFile),
        message: `Draft is missing editable or controlled fields: ${missingControlled.map((field) => field.key).join(", ")}`,
      });
    }

    plans.push({
      id: draft.id,
      title: draft.title,
      draft: relative(draftFile),
      kind: draft.draftKind === "new_article" ? "new_article" : "existing_article",
      publishIntent: draft.draftPublishIntent || null,
      summary: {
        editable: fields.filter((field) => field.mode === "editable").length,
        controlled: fields.filter((field) => field.mode === "controlled").length,
        generated: fields.filter((field) => field.mode === "generated").length,
        locked: fields.filter((field) => field.mode === "locked").length,
        highRisk: fields.filter((field) => field.publishRisk === "high").length,
      },
      fields,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      drafts: plans.length,
      editableFields: plans.reduce((total, plan) => total + plan.summary.editable, 0),
      controlledFields: plans.reduce((total, plan) => total + plan.summary.controlled, 0),
      generatedFields: plans.reduce((total, plan) => total + plan.summary.generated, 0),
      lockedFields: plans.reduce((total, plan) => total + plan.summary.locked, 0),
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    plans,
    guarantee:
      "Read-only edit planning. This script only reads draft JSON and editor rules, then writes a local report. It does not edit drafts, publish files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Edit Plan");
  console.log("===============================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Drafts: ${report.summary.drafts}`);
  console.log(`Editable fields: ${report.summary.editableFields}`);
  console.log(`Controlled fields: ${report.summary.controlledFields}`);
  console.log(`Generated fields: ${report.summary.generatedFields}`);
  console.log(`Locked fields: ${report.summary.lockedFields}`);
  console.log(`Report: ${relative(REPORT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
