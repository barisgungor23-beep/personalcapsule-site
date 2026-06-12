#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PREVIEW_FILE = path.join(ROOT, "outputs", "admin", "index.html");

const report = {
  critical: [],
  warnings: [],
};

function add(level, message) {
  report[level].push(message);
}

function printSection(title, items) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log("  None");
    return;
  }
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function main() {
  if (!fs.existsSync(PREVIEW_FILE)) {
    add("critical", "Admin preview does not exist. Run scripts/generate-admin-preview.js first.");
  } else {
    const html = fs.readFileSync(PREVIEW_FILE, "utf8");

    const requiredText = [
      "PersonalCapsule Website Admin",
      "Read-only control preview",
      "Blog articles",
      "Categories",
      "Pages",
      "Health",
      "Selected article",
      "SEO Preview",
      "Keywords",
      "Quality checks",
      "Related links",
      "FAQ",
      "Local admin preview only",
    ];

    for (const text of requiredText) {
      if (!html.includes(text)) {
        add("critical", `Admin preview is missing required text: ${text}`);
      }
    }

    const unsafeActionWords = [
      "Publish now",
      "Delete page",
      "Save changes",
      "Commit to GitHub",
      "Deploy to Cloudflare",
    ];

    for (const text of unsafeActionWords) {
      if (html.includes(text)) {
        add("warnings", `Read-only admin preview contains action text: ${text}`);
      }
    }

    const articleRows = (html.match(/<tr>/g) || []).length;
    if (articleRows < 40) {
      add("warnings", `Admin preview has fewer table rows than expected: ${articleRows}`);
    }

    const requiredControls = [
      'id="articleSearch"',
      'id="categoryFilter"',
      'id="statusFilter"',
      'id="qualityFilter"',
      'id="articleCount"',
      'id="articleDetail"',
      "data-article-row",
      "data-quality",
      "data-detail-id",
    ];

    for (const control of requiredControls) {
      if (!html.includes(control)) {
        add("critical", `Admin preview is missing required control: ${control}`);
      }
    }
  }

  console.log("PersonalCapsule Admin Preview Audit");
  console.log("===================================");
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
