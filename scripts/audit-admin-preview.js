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
      "System",
      "Reports",
      "Guides",
      "Git / Deploy",
      "Publish Safety",
      "Drafts",
      "Admin Navigation",
      "Jump to the area you need",
      "Founder Center",
      "Content",
      "Admin Home Brief",
      "What should I do now?",
      "Primary action",
      "Admin Work Queue",
      "Simple rule",
      "Publish Workflow Status",
      "Admin Dashboard Snapshot",
      "Today at a glance",
      "Content health",
      "Draft state",
      "Preview and comparison",
      "Restore readiness",
      "Full control check",
      "Admin System Overview",
      "Recommended action",
      "Admin Report Index",
      "Report inventory",
      "Admin Report Freshness",
      "Freshness check",
      "Admin Failure Playbook",
      "Failure response",
      "Admin Dependency Map",
      "Dependency map",
      "Admin Report Detail Viewer",
      "Report detail viewer",
      "Control Center",
      "Admin Quick Start",
      "Safest default",
      "Focus area",
      "Founder Decision Center",
      "Can I safely act now?",
      "Safest action",
      "Admin Command Guide",
      "Command safety rule",
      "Admin Action Flow",
      "Action button rule",
      "Copy command",
      "Manual confirmation required",
      "Admin Workflow Guide",
      "Workflow rule",
      "Admin Command Risk Matrix",
      "Command risk rule",
      "Git Status / Push Safety",
      "Push safety rule",
      "Push Package",
      "Push package rule",
      "Safe Push Checklist",
      "Final push decision",
      "Domain Safety Policy",
      "CNAME / domain safety",
      "Push Confirmation Guide",
      "Final human confirmation",
      "Final Push Review",
      "Before push",
      "Deployment Readiness",
      "Deploy safety rule",
      "Admin Operations Manual",
      "Operations principle",
      "Publish Readiness",
      "Publish Result",
      "Publish Wizard",
      "Step-by-step publish decision",
      "Publish Dry Run",
      "Rollback Plan",
      "Backup Snapshot",
      "Backup / Restore Center",
      "Backup and restore status",
      "Pre-Publish Checklist",
      "Draft Publish Simulation",
      "Publish simulation",
      "Restore Dry Run",
      "Restore Result",
      "Draft Quality",
      "Draft Fix List",
      "Draft Edit Plan",
      "Draft Edit Guide",
      "Draft Patch Apply Guide",
      "Patch contract",
      "Draft Patch Export Center",
      "Patch export rule",
      "Red flags",
      "Draft Comparison",
      "Draft Publish Workflow",
      "New Article Draft",
      "draft-only",
      "Create a private draft",
      "Existing Article Edit Draft",
      "draft-first",
      "Create the private edit draft",
      "Create Draft",
      "Control Check",
      "Full control check",
      "Editor Rules",
      "draft-safe",
      "Controlled",
      "Locked",
      "SEO / GEO Content Decision",
      "Recommended action",
      "Missing FAQ",
      "Missing CTA",
      "Blog articles",
      "Categories",
      "Pages",
      "Health",
      "Selected article",
      "Draft Edit Form v1",
      "Local form only",
      "Build draft patch",
      "Copy patch JSON",
      "Download patch JSON",
      "Local draft patch",
      "Patch targets a draft file",
      "never a published article file",
      "Editable",
      "Generated",
      "Read-only",
      "SEO Preview",
      "Keywords",
      "Quality checks",
      "Fix list",
      "Editable fields",
      "Safe editing rule",
      "Human review",
      "Issues",
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
      'id="articleEditor"',
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
