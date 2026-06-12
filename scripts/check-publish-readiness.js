#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");
const DRAFT_OUTPUT_DIR = path.join(ROOT, "outputs", "drafts");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const COMPARISON_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-comparison-report.json");
const READINESS_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-readiness-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listDraftFiles() {
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

function draftPreviewPath(draft) {
  return path.join(DRAFT_OUTPUT_DIR, `${draft.slug}.draft.html`);
}

function main() {
  const comparison = readJsonIfExists(COMPARISON_FILE);
  const blockers = [];
  const warnings = [];
  const items = [];
  const draftFiles = listDraftFiles();
  const comparisonByDraft = new Map(
    (comparison && Array.isArray(comparison.comparisons) ? comparison.comparisons : []).map((item) => [
      item.draft,
      item,
    ])
  );

  if (!comparison) {
    blockers.push({
      scope: "system",
      message: "Draft comparison report is missing. Run compare-article-drafts before readiness check.",
    });
  }

  for (const draftFile of draftFiles) {
    const draft = readJsonIfExists(draftFile);
    const draftPath = relative(draftFile);
    if (!draft) {
      blockers.push({ scope: draftPath, message: "Draft JSON cannot be read." });
      continue;
    }

    const previewPath = draftPreviewPath(draft);
    const comparisonItem = comparisonByDraft.get(draftPath);
    const itemBlockers = [];
    const itemWarnings = [];

    if (draft.status !== "draft") {
      itemBlockers.push("Draft status must be draft.");
    }
    if (!fs.existsSync(previewPath)) {
      itemBlockers.push(`Draft preview is missing: ${relative(previewPath)}`);
    }
    if (!comparisonItem) {
      itemBlockers.push("Draft comparison entry is missing.");
    } else {
      if (comparisonItem.criticalChangeCount > 0) {
        itemBlockers.push(
          `Critical field changes detected: ${comparisonItem.changes
            .filter((change) => change.risk === "critical")
            .map((change) => change.field)
            .join(", ")}`
        );
      }
      if (comparisonItem.warningChangeCount > 0) {
        itemWarnings.push(
          `Review warning field changes before publishing: ${comparisonItem.changes
            .filter((change) => change.risk === "warning")
            .map((change) => change.field)
            .join(", ")}`
        );
      }
      if (comparisonItem.changeCount === 0) {
        itemWarnings.push("Draft has no content changes compared with the published article.");
      }
    }

    for (const message of itemBlockers) blockers.push({ scope: draftPath, message });
    for (const message of itemWarnings) warnings.push({ scope: draftPath, message });

    items.push({
      id: draft.id,
      title: draft.title,
      draft: draftPath,
      preview: relative(previewPath),
      status: itemBlockers.length === 0 ? "ready" : "blocked",
      blockers: itemBlockers,
      warnings: itemWarnings,
      changedFields: comparisonItem ? comparisonItem.changedFields : [],
      changeCount: comparisonItem ? comparisonItem.changeCount : 0,
    });
  }

  const summary = {
    status: blockers.length === 0 ? "passed" : "failed",
    drafts: draftFiles.length,
    readyDrafts: items.filter((item) => item.status === "ready").length,
    blockedDrafts: items.filter((item) => item.status === "blocked").length,
    blockers: blockers.length,
    warnings: warnings.length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    blockers,
    warnings,
    items,
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(READINESS_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Publish Readiness");
  console.log("=================================");
  console.log(`Status: ${summary.status}`);
  console.log(`Drafts: ${summary.drafts}`);
  console.log(`Ready drafts: ${summary.readyDrafts}`);
  console.log(`Blocked drafts: ${summary.blockedDrafts}`);
  console.log(`Blockers: ${summary.blockers}`);
  console.log(`Warnings: ${summary.warnings}`);
  console.log(`Report: ${relative(READINESS_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
