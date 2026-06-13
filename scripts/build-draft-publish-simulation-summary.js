#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const READINESS_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-readiness-report.json");
const DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-dry-run-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-publish-simulation-summary-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function operationBucket(type) {
  if (type === "content_json") return "content";
  if (type === "article_html") return "article_page";
  if (type === "blog_index") return "blog_index";
  if (type === "category_pages") return "category_pages";
  if (type === "sitemap") return "discovery";
  if (type === "llms") return "ai_discovery";
  return "other";
}

function addBucket(buckets, bucket, operation) {
  if (!buckets[bucket]) {
    buckets[bucket] = {
      id: bucket,
      operations: 0,
      files: [],
      reason: "",
    };
  }

  buckets[bucket].operations += 1;
  buckets[bucket].files.push({
    type: operation.type || "cleanup",
    from: operation.from || null,
    to: operation.to || operation.path || null,
    reason: operation.reason || "Publish flow operation.",
  });
}

function bucketReason(bucket) {
  const reasons = {
    content: "Updates the source article JSON that powers the public page.",
    article_page: "Updates the public article HTML page.",
    blog_index: "Refreshes the blog listing page.",
    category_pages: "Refreshes category pages and article counts.",
    discovery: "Refreshes sitemap.xml for search engines.",
    ai_discovery: "Refreshes llms.txt for AI-readable discovery.",
    cleanup: "Removes draft-only files after a successful publish.",
    other: "Other publish-related file operation.",
  };
  return reasons[bucket] || reasons.other;
}

function buildDraftSummaries(plan) {
  return plan.map((item) => {
    const buckets = {};
    const updateOperations = Array.isArray(item.wouldUpdate) ? item.wouldUpdate : [];
    const cleanupOperations = Array.isArray(item.wouldRemoveAfterPublish) ? item.wouldRemoveAfterPublish : [];

    for (const operation of updateOperations) {
      addBucket(buckets, operationBucket(operation.type), operation);
    }

    for (const operation of cleanupOperations) {
      addBucket(buckets, "cleanup", {
        type: "cleanup",
        path: operation.path,
        reason: operation.reason,
      });
    }

    const groupedOperations = Object.values(buckets).map((bucket) => ({
      ...bucket,
      reason: bucketReason(bucket.id),
    }));

    return {
      id: item.id,
      title: item.title,
      status: item.status || "dry_run_only",
      changedFields: item.changedFields || [],
      changeCount: item.changeCount || 0,
      plannedOperations: updateOperations.length + cleanupOperations.length,
      groupedOperations,
      publicImpact: groupedOperations
        .filter((bucket) => bucket.id !== "cleanup" && bucket.id !== "content")
        .map((bucket) => bucket.id),
      discoveryImpact: groupedOperations.some((bucket) => bucket.id === "discovery" || bucket.id === "ai_discovery"),
    };
  });
}

function main() {
  const readiness = readJsonIfExists(READINESS_FILE);
  const dryRun = readJsonIfExists(DRY_RUN_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const blockers = [];
  const warnings = [];

  if (!readiness) {
    blockers.push({
      scope: "publish_readiness",
      message: "Publish readiness report is missing. Run the full control check first.",
    });
  }

  if (!dryRun) {
    blockers.push({
      scope: "publish_dry_run",
      message: "Publish dry-run report is missing. Run the full control check first.",
    });
  }

  if (!prePublish) {
    warnings.push({
      scope: "pre_publish",
      message: "Pre-publish checklist is missing. Human-review guidance will be less specific.",
    });
  }

  const readinessSummary = readiness && readiness.summary ? readiness.summary : {};
  const dryRunSummary = dryRun && dryRun.summary ? dryRun.summary : {};
  const prePublishSummary = prePublish && prePublish.summary ? prePublish.summary : {};
  const plan = dryRun && Array.isArray(dryRun.plan) ? dryRun.plan : [];
  const draftSummaries = buildDraftSummaries(plan);
  const plannedOperations = draftSummaries.reduce((total, item) => total + item.plannedOperations, 0);
  const discoveryUpdates = draftSummaries.filter((item) => item.discoveryImpact).length;
  const hasActivePublishWork =
    (readinessSummary.readyDrafts || 0) > 0 ||
    (readinessSummary.blockedDrafts || 0) > 0 ||
    plannedOperations > 0;

  let status = "idle";
  let nextAction = "No draft is currently waiting for publish. Keep using drafts until a page is ready.";

  if (blockers.length > 0) {
    status = "blocked";
    nextAction = `Fix this first: ${blockers[0].message}`;
  } else if (dryRunSummary.status !== "passed" || readinessSummary.status !== "passed") {
    status = "blocked";
    nextAction = "Publish readiness or dry-run is not passing. Do not publish until the full control check is clean.";
  } else if (draftSummaries.length > 0) {
    status = prePublishSummary.status === "ready" ? "ready" : "review";
    nextAction = "Review every planned file group, create a backup snapshot, then publish only after final human review.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      readyDrafts: readinessSummary.readyDrafts || 0,
      blockedDrafts: readinessSummary.blockedDrafts || 0,
      simulatedDrafts: draftSummaries.length,
      plannedOperations,
      discoveryUpdates,
      hasActivePublishWork,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    nextAction,
    blockers,
    warnings,
    draftSummaries,
    requiredHumanChecks: [
      "Read every draft preview as a real website visitor.",
      "Confirm the dry-run includes article HTML, blog index, category pages, sitemap.xml, and llms.txt when needed.",
      "Confirm no unrelated file is included in the planned publish operations.",
      "Create a backup snapshot before confirmed publish.",
      "Run the full control check again after confirmed publish.",
    ],
    guarantee:
      "Read-only publish simulation summary. This script reads local publish reports and writes a local summary only. It does not edit drafts, publish files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Draft Publish Simulation Summary");
  console.log("================================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Simulated drafts: ${report.summary.simulatedDrafts}`);
  console.log(`Planned operations: ${report.summary.plannedOperations}`);
  console.log(`Discovery updates: ${report.summary.discoveryUpdates}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (status === "blocked") {
    process.exitCode = 1;
  }
}

main();
