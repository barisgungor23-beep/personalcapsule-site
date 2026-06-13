#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-patch-export-center-report.json");

const PATCH_APPLY_GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-patch-apply-guide-report.json");
const EDIT_PLAN_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-plan-report.json");
const EDIT_GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-edit-guide-report.json");

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
  const patchGuide = readJsonIfExists(PATCH_APPLY_GUIDE_FILE);
  const editPlan = readJsonIfExists(EDIT_PLAN_FILE);
  const editGuide = readJsonIfExists(EDIT_GUIDE_FILE);

  const patchSummary = summaryOf(patchGuide);
  const planSummary = summaryOf(editPlan);
  const guideSummary = summaryOf(editGuide);

  const blockers = [];
  const warnings = [];

  if (!patchGuide || patchSummary.status !== "passed") {
    blockers.push({
      scope: "patch_apply_guide",
      message: "Draft patch apply guide must pass before patch export can be trusted.",
    });
  }

  if (!editPlan) {
    warnings.push({
      scope: "draft_edit_plan",
      message: "Draft edit plan is missing. Export guidance can still exist, but active draft context is incomplete.",
    });
  }

  if (!editGuide) {
    warnings.push({
      scope: "draft_edit_guide",
      message: "Draft edit guide is missing. Export guidance can still exist, but manual edit context is incomplete.",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      exportMode: "browser_patch_export_v1",
      requiredPatchMode: patchSummary.patchMode || "local_draft_patch_v2",
      activeDrafts: planSummary.drafts || 0,
      guidedFixes: guideSummary.draftFixes || 0,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    exportContract: {
      source: "Draft Edit Form v1",
      format: "JSON",
      filenamePattern: "personalcapsule-draft-patch-{article-id}.json",
      allowedTargets: ["content/drafts/articles/{article-id}.draft.json"],
      forbiddenTargets: ["content/articles/{article-id}.json", "blog/*.html", "sitemap.xml", "llms.txt"],
      rule:
        "Exported patch files are instructions for a private draft only. They must never be treated as direct publish files.",
    },
    safeActions: [
      {
        label: "Build patch",
        detail: "Creates a browser-only JSON patch from edited safe fields.",
      },
      {
        label: "Copy patch JSON",
        detail: "Copies the generated JSON so it can be reviewed or saved elsewhere.",
      },
      {
        label: "Download patch JSON",
        detail: "Downloads the generated JSON as a local file for manual review.",
      },
    ],
    requiredReviewSteps: [
      "Create or locate the target draft before applying any exported patch.",
      "Confirm the patch mode is local_draft_patch_v2.",
      "Confirm targetDraftPath starts with content/drafts/articles/.",
      "Confirm sourceArticlePath is not used as the write target.",
      "Run node scripts/run-admin-control-check.js after any manual draft edit.",
    ],
    redFlags: [
      "Patch JSON is empty or has no changedFields.",
      "Patch target points to content/articles.",
      "Patch includes fields marked generated or locked.",
      "Patch is applied without previewing the draft.",
      "Patch is treated as a publish command.",
    ],
    blockers,
    warnings,
    sources: [
      relative(PATCH_APPLY_GUIDE_FILE),
      relative(EDIT_PLAN_FILE),
      relative(EDIT_GUIDE_FILE),
    ],
    guarantee:
      "Read-only draft patch export center. This script reads local admin reports and writes local export guidance only. It does not edit drafts, apply patches, publish files, copy backups, restore files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Patch Export Center");
  console.log("=========================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Export mode: ${report.summary.exportMode}`);
  console.log(`Required patch mode: ${report.summary.requiredPatchMode}`);
  console.log(`Safe actions: ${report.safeActions.length}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
