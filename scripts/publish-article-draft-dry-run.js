#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const READINESS_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-readiness-report.json");
const DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-dry-run-report.json");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/publish-article-draft-dry-run.js --dry-run");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function generatedArticlePath(slug) {
  return `outputs/generated/${slug}.html`;
}

function liveArticlePath(slug) {
  return `blog/${slug}.html`;
}

function buildPlanItem(item) {
  const sourceJson = `content/articles/${item.id}.json`;
  const draftJson = item.draft;
  const generatedArticle = generatedArticlePath(path.basename(item.preview, ".draft.html"));
  const liveArticle = liveArticlePath(path.basename(item.preview, ".draft.html"));

  return {
    id: item.id,
    title: item.title,
    status: "dry_run_only",
    changedFields: item.changedFields,
    changeCount: item.changeCount,
    wouldUpdate: [
      {
        type: "content_json",
        from: draftJson,
        to: sourceJson,
        reason: "Replace published article content with approved draft content.",
      },
      {
        type: "article_html",
        from: generatedArticle,
        to: liveArticle,
        reason: "Regenerate the public article page from the updated content model.",
      },
      {
        type: "blog_index",
        from: "outputs/generated/blog/index.html",
        to: "blog/index.html",
        reason: "Refresh article listing, dates, excerpts, and links.",
      },
      {
        type: "category_pages",
        from: "outputs/generated/category/*.html",
        to: "blog/category/*.html",
        reason: "Refresh category article counts and article cards.",
      },
      {
        type: "sitemap",
        from: "outputs/generated/discovery/sitemap.xml",
        to: "sitemap.xml",
        reason: "Refresh search-engine discovery metadata after publishing.",
      },
      {
        type: "llms",
        from: "outputs/generated/discovery/llms.txt",
        to: "llms.txt",
        reason: "Refresh AI-readable site summary after publishing.",
      },
    ],
    wouldRemoveAfterPublish: [
      {
        path: draftJson,
        reason: "Draft should not remain active after successful publish.",
      },
      {
        path: item.preview,
        reason: "Draft preview should be cleaned after successful publish.",
      },
    ],
  };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun) {
    usage();
    console.error("This safety step only supports --dry-run. It does not publish files.");
    process.exitCode = 1;
    return;
  }

  const readiness = readJsonIfExists(READINESS_FILE);
  const blockers = [];
  const warnings = [];
  const plan = [];

  if (!readiness) {
    blockers.push({
      scope: "system",
      message: "Publish readiness report is missing. Run the full control check first.",
    });
  } else if (readiness.summary.status !== "passed") {
    blockers.push({
      scope: "system",
      message: "Publish readiness has blockers. Dry-run publish plan cannot proceed.",
    });
  } else {
    const readyItems = (readiness.items || []).filter((item) => item.status === "ready");
    const blockedItems = (readiness.items || []).filter((item) => item.status !== "ready");

    for (const item of blockedItems) {
      warnings.push({
        scope: item.draft,
        message: "Blocked draft is excluded from dry-run publish plan.",
      });
    }

    for (const item of readyItems) {
      plan.push(buildPlanItem(item));
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry_run",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      readyDrafts: plan.length,
      plannedFileOperations: plan.reduce(
        (total, item) => total + item.wouldUpdate.length + item.wouldRemoveAfterPublish.length,
        0
      ),
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    plan,
    guarantee:
      "Dry-run only. This report does not modify content/articles, blog HTML, sitemap.xml, llms.txt, Git, or Cloudflare.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(DRY_RUN_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Publish Dry Run");
  console.log("===============================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Ready drafts: ${report.summary.readyDrafts}`);
  console.log(`Planned file operations: ${report.summary.plannedFileOperations}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(DRY_RUN_FILE)}`);
  console.log("No files were published.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
