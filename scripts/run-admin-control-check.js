#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(OUTPUT_DIR, "control-report.json");

const steps = [
  {
    id: "build_admin_read_model",
    label: "Build admin read model",
    command: ["node", "scripts/build-admin-read-model.js"],
    kind: "generate",
  },
  {
    id: "generate_article_previews",
    label: "Generate article previews",
    command: ["node", "scripts/generate-article-preview.js", "--all"],
    kind: "generate",
  },
  {
    id: "generate_category_previews",
    label: "Generate category previews",
    command: ["node", "scripts/generate-category-preview.js", "--all"],
    kind: "generate",
  },
  {
    id: "generate_blog_index_preview",
    label: "Generate blog index preview",
    command: ["node", "scripts/generate-blog-index-preview.js"],
    kind: "generate",
  },
  {
    id: "generate_discovery_preview",
    label: "Generate discovery preview",
    command: ["node", "scripts/generate-discovery-preview.js"],
    kind: "generate",
  },
  {
    id: "generate_admin_preview",
    label: "Generate admin preview",
    command: ["node", "scripts/generate-admin-preview.js"],
    kind: "generate",
  },
  {
    id: "generate_draft_previews",
    label: "Generate draft previews",
    command: ["node", "scripts/generate-draft-preview.js", "--all"],
    kind: "generate",
  },
  {
    id: "validate_content",
    label: "Validate content",
    command: ["node", "scripts/validate-content.js"],
    kind: "audit",
  },
  {
    id: "audit_editor_rules",
    label: "Audit editor rules",
    command: ["node", "scripts/audit-editor-rules.js"],
    kind: "audit",
  },
  {
    id: "audit_article_drafts",
    label: "Audit article drafts",
    command: ["node", "scripts/audit-article-drafts.js"],
    kind: "audit",
  },
  {
    id: "audit_draft_previews",
    label: "Audit draft previews",
    command: ["node", "scripts/audit-draft-previews.js"],
    kind: "audit",
  },
  {
    id: "compare_article_drafts",
    label: "Compare article drafts",
    command: ["node", "scripts/compare-article-drafts.js"],
    kind: "audit",
  },
  {
    id: "audit_admin_read_model",
    label: "Audit admin read model",
    command: ["node", "scripts/audit-admin-read-model.js"],
    kind: "audit",
  },
  {
    id: "audit_admin_preview",
    label: "Audit admin preview",
    command: ["node", "scripts/audit-admin-preview.js"],
    kind: "audit",
  },
  {
    id: "audit_site",
    label: "Audit live site files",
    command: ["node", "scripts/audit-site.js"],
    kind: "audit",
  },
  {
    id: "audit_generated_preview",
    label: "Audit generated previews",
    command: ["node", "scripts/audit-generated-preview.js"],
    kind: "audit",
  },
  {
    id: "audit_discovery_preview",
    label: "Audit discovery previews",
    command: ["node", "scripts/audit-discovery-preview.js"],
    kind: "audit",
  },
];

function runStep(step) {
  const startedAt = new Date();
  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
  });
  const finishedAt = new Date();
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const status = result.status === 0 ? "passed" : "failed";

  return {
    id: step.id,
    label: step.label,
    kind: step.kind,
    command: step.command.join(" "),
    status,
    exitCode: result.status,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    stdout,
    stderr,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildSummary(results) {
  const adminModel = readJsonIfExists(path.join(OUTPUT_DIR, "admin-read-model.json"));
  const failed = results.filter((step) => step.status === "failed");
  const passed = results.filter((step) => step.status === "passed");

  return {
    status: failed.length === 0 ? "passed" : "failed",
    passedSteps: passed.length,
    failedSteps: failed.length,
    firstFailedStep: failed[0] ? failed[0].id : null,
    htmlPages: adminModel ? adminModel.summary.totalHtmlPages : null,
    blogArticles: adminModel ? adminModel.summary.totalBlogArticles : null,
    blogCategories: adminModel ? adminModel.summary.totalBlogCategories : null,
    articleQuality: adminModel ? adminModel.summary.articleQuality : null,
    seoWarnings: adminModel ? adminModel.summary.seoWarnings : null,
  };
}

function printStep(result) {
  const mark = result.status === "passed" ? "PASS" : "FAIL";
  console.log(`[${mark}] ${result.label} (${result.durationMs}ms)`);
  if (result.status === "failed") {
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    if (output) {
      console.log(output);
    }
  }
}

function refreshAdminPreview() {
  const result = runStep({
    id: "refresh_admin_preview",
    label: "Refresh admin preview with control report",
    command: ["node", "scripts/generate-admin-preview.js"],
    kind: "generate",
  });
  printStep(result);
  return result;
}

function main() {
  const results = [];

  console.log("PersonalCapsule Admin Control Check");
  console.log("===================================");

  for (const step of steps) {
    const result = runStep(step);
    results.push(result);
    printStep(result);

    if (result.status === "failed") {
      break;
    }
  }

  const summary = buildSummary(results);
  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    steps: results,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  const refreshResult = refreshAdminPreview();
  if (refreshResult.status === "failed") {
    summary.status = "failed";
    summary.failedSteps += 1;
    if (!summary.firstFailedStep) summary.firstFailedStep = refreshResult.id;
    report.summary = summary;
    report.steps.push(refreshResult);
    fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log("\nSummary");
  console.log("-------");
  console.log(`Status: ${summary.status}`);
  console.log(`Passed steps: ${summary.passedSteps}`);
  console.log(`Failed steps: ${summary.failedSteps}`);
  if (summary.blogArticles !== null) console.log(`Articles: ${summary.blogArticles}`);
  if (summary.blogCategories !== null) console.log(`Categories: ${summary.blogCategories}`);
  if (summary.htmlPages !== null) console.log(`HTML pages: ${summary.htmlPages}`);
  if (summary.articleQuality) {
    console.log(
      `Quality: good=${summary.articleQuality.good}, review=${summary.articleQuality.review}, risk=${summary.articleQuality.risk}`
    );
  }
  console.log(`Report: ${path.relative(ROOT, REPORT_FILE)}`);

  if (summary.status === "failed") {
    process.exitCode = 1;
  }
}

main();
