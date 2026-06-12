#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const DRY_RUN_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-dry-run-report.json");
const READINESS_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-readiness-report.json");
const BACKUP_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-snapshot-report.json");
const PUBLISH_REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-report.json");

const draftOnlyKeys = new Set([
  "draftOf",
  "draftCreatedAt",
  "draftUpdatedAt",
  "draftSourcePath",
  "draftNote",
]);

function usage() {
  console.log("Usage:");
  console.log("  node scripts/publish-article-draft.js --confirm");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function assertReportPassed(report, name, blockers) {
  if (!report) {
    blockers.push({ scope: name, message: `${name} report is missing.` });
    return false;
  }
  if (!report.summary || report.summary.status !== "passed") {
    blockers.push({ scope: name, message: `${name} report did not pass.` });
    return false;
  }
  return true;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`.trim()
    );
  }
  return result;
}

function copyFile(from, to) {
  const source = path.join(ROOT, from);
  const target = path.join(ROOT, to);
  if (!fs.existsSync(source)) {
    throw new Error(`Generated source is missing: ${from}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  const stat = fs.statSync(target);
  return {
    from,
    to,
    sizeBytes: stat.size,
  };
}

function copyCategoryFiles() {
  const sourceDir = path.join(ROOT, "outputs", "generated", "category");
  const targetDir = path.join(ROOT, "blog", "category");
  if (!fs.existsSync(sourceDir)) return [];
  return fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith(".html"))
    .sort()
    .map((name) => copyFile(`outputs/generated/category/${name}`, `blog/category/${name}`));
}

function publishDraftJson(draftPath, sourcePath) {
  const draft = readJsonIfExists(path.join(ROOT, draftPath));
  if (!draft) throw new Error(`Draft JSON is missing: ${draftPath}`);
  const published = { ...draft };
  for (const key of draftOnlyKeys) delete published[key];
  published.status = "published";
  published.dateModified = localDate();

  fs.writeFileSync(path.join(ROOT, sourcePath), `${JSON.stringify(published, null, 2)}\n`);
  return {
    from: draftPath,
    to: sourcePath,
  };
}

function removeIfExists(filePath) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return false;
  fs.unlinkSync(fullPath);
  return true;
}

function main() {
  const confirmed = process.argv.includes("--confirm");
  if (!confirmed) {
    usage();
    console.error("Publishing requires --confirm.");
    process.exitCode = 1;
    return;
  }

  const blockers = [];
  const warnings = [];
  const operations = [];

  const readiness = readJsonIfExists(READINESS_FILE);
  const dryRun = readJsonIfExists(DRY_RUN_FILE);
  const backup = readJsonIfExists(BACKUP_REPORT_FILE);

  assertReportPassed(readiness, "publish readiness", blockers);
  assertReportPassed(dryRun, "publish dry-run", blockers);
  assertReportPassed(backup, "backup snapshot", blockers);

  const plan = dryRun && Array.isArray(dryRun.plan) ? dryRun.plan : [];
  if (plan.length === 0) {
    warnings.push({ scope: "system", message: "No ready drafts to publish." });
  }

  if (plan.length > 0 && (!backup || !backup.summary || backup.summary.filesCopied === 0)) {
    blockers.push({
      scope: "backup snapshot",
      message: "Ready drafts exist, but no backup files were copied.",
    });
  }

  if (blockers.length === 0 && plan.length > 0) {
    try {
      for (const item of plan) {
        const contentOperation = item.wouldUpdate.find((operation) => operation.type === "content_json");
        if (!contentOperation) throw new Error(`Missing content_json operation for ${item.id}`);
        operations.push({
          type: "content_json",
          ...publishDraftJson(contentOperation.from, contentOperation.to),
        });
      }

      run("node", ["scripts/generate-article-preview.js", "--all"]);
      run("node", ["scripts/generate-blog-index-preview.js"]);
      run("node", ["scripts/generate-category-preview.js", "--all"]);
      run("node", ["scripts/generate-discovery-preview.js"]);

      for (const item of plan) {
        const articleOperation = item.wouldUpdate.find((operation) => operation.type === "article_html");
        if (articleOperation) {
          operations.push({
            type: "article_html",
            ...copyFile(articleOperation.from, articleOperation.to),
          });
        }
      }

      operations.push({
        type: "blog_index",
        ...copyFile("outputs/generated/blog/index.html", "blog/index.html"),
      });

      for (const copied of copyCategoryFiles()) {
        operations.push({ type: "category_page", ...copied });
      }

      operations.push({
        type: "sitemap",
        ...copyFile("outputs/generated/discovery/sitemap.xml", "sitemap.xml"),
      });
      operations.push({
        type: "llms",
        ...copyFile("outputs/generated/discovery/llms.txt", "llms.txt"),
      });

      for (const item of plan) {
        for (const cleanup of item.wouldRemoveAfterPublish || []) {
          operations.push({
            type: "cleanup",
            path: cleanup.path,
            removed: removeIfExists(cleanup.path),
          });
        }
      }
    } catch (error) {
      blockers.push({ scope: "publish", message: error.message });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "confirmed_publish",
    summary: {
      status: blockers.length === 0 ? "passed" : "failed",
      publishedDrafts: blockers.length === 0 ? plan.length : 0,
      operations: operations.length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    blockers,
    warnings,
    operations,
    guarantee:
      "Local publish only. This script updates local content and generated site files. It does not commit to Git, push to GitHub, deploy to Cloudflare, or delete backups.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(PUBLISH_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Publish");
  console.log("=======================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Published drafts: ${report.summary.publishedDrafts}`);
  console.log(`Operations: ${report.summary.operations}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(PUBLISH_REPORT_FILE)}`);
  console.log("No Git commit, push, or Cloudflare deploy was performed.");

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
