#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-command-guide-report.json");

const commands = [
  {
    id: "full_control_check",
    label: "Full control check",
    command: "node scripts/run-admin-control-check.js",
    group: "daily_control",
    safety: "read_only",
    whenToUse: "Use this before trusting any admin preview, draft status, publish plan, or website health result.",
    whatItDoes: "Runs the full local safety chain and refreshes the admin preview.",
    changesFiles: "local_reports_only",
  },
  {
    id: "create_new_article_draft",
    label: "Create new article draft",
    command:
      'node scripts/create-new-article-draft.js new-article-slug --category open-when-letters --title "New Article Title" --confirm',
    group: "draft_creation",
    safety: "draft_only",
    whenToUse: "Use this when you want to write a new article without touching the live website.",
    whatItDoes: "Creates a private draft JSON file under content/drafts/articles.",
    changesFiles: "draft_file",
  },
  {
    id: "generate_draft_previews",
    label: "Generate draft previews",
    command: "node scripts/generate-draft-preview.js --all",
    group: "preview",
    safety: "read_only",
    whenToUse: "Use this after editing draft JSON so you can visually review the draft before publishing.",
    whatItDoes: "Creates local draft preview HTML files inside outputs.",
    changesFiles: "local_reports_only",
  },
  {
    id: "draft_quality",
    label: "Draft quality audit",
    command: "node scripts/audit-draft-quality.js",
    group: "draft_review",
    safety: "read_only",
    whenToUse: "Use this to find missing SEO, weak content, placeholders, and publish blockers in drafts.",
    whatItDoes: "Checks draft quality and writes a local quality report.",
    changesFiles: "local_reports_only",
  },
  {
    id: "draft_fix_list",
    label: "Draft fix list",
    command: "node scripts/build-draft-fix-list.js",
    group: "draft_review",
    safety: "read_only",
    whenToUse: "Use this when you need a clear to-do list for draft problems.",
    whatItDoes: "Turns draft quality issues into specific fixes.",
    changesFiles: "local_reports_only",
  },
  {
    id: "draft_edit_guide",
    label: "Draft edit guide",
    command: "node scripts/build-draft-edit-guide.js",
    group: "draft_review",
    safety: "read_only",
    whenToUse: "Use this when you need to know which field should be edited and how risky it is.",
    whatItDoes: "Combines the fix list with editor rules and creates a guided editing plan.",
    changesFiles: "local_reports_only",
  },
  {
    id: "publish_readiness",
    label: "Publish readiness",
    command: "node scripts/check-publish-readiness.js",
    group: "publish_safety",
    safety: "read_only",
    whenToUse: "Use this only after draft fixes are complete and the draft should be considered for publish.",
    whatItDoes: "Checks if any draft is ready or blocked before publishing.",
    changesFiles: "local_reports_only",
  },
  {
    id: "publish_dry_run",
    label: "Publish dry run",
    command: "node scripts/publish-article-draft-dry-run.js --dry-run",
    group: "publish_safety",
    safety: "read_only",
    whenToUse: "Use this before real publishing to see exactly which files would change.",
    whatItDoes: "Plans publish operations without changing live content files.",
    changesFiles: "local_reports_only",
  },
  {
    id: "backup_snapshot",
    label: "Backup snapshot",
    command: "node scripts/create-backup-snapshot.js --confirm",
    group: "backup_restore",
    safety: "writes_backup",
    whenToUse: "Use this only after publish dry-run passes and before a real publish.",
    whatItDoes: "Creates a local backup snapshot of files that could change during publish.",
    changesFiles: "backup_files",
  },
  {
    id: "publish_confirmed",
    label: "Confirmed publish",
    command: "node scripts/publish-article-draft.js --confirm",
    group: "publish",
    safety: "writes_live_content",
    whenToUse: "Use this only when all checks pass, backup exists, and you intentionally want to update site files.",
    whatItDoes: "Moves ready drafts into published content and refreshes generated site files.",
    changesFiles: "live_content_files",
  },
  {
    id: "restore_dry_run",
    label: "Restore dry run",
    command: "node scripts/restore-backup-snapshot-dry-run.js",
    group: "backup_restore",
    safety: "read_only",
    whenToUse: "Use this if something looks wrong after publishing and you want to see what restore would do.",
    whatItDoes: "Plans restore operations from the latest backup without changing files.",
    changesFiles: "local_reports_only",
  },
  {
    id: "restore_confirmed",
    label: "Confirmed restore",
    command: "node scripts/restore-backup-snapshot.js --confirm",
    group: "backup_restore",
    safety: "writes_live_content",
    whenToUse: "Use this only if a publish must be rolled back from a known backup snapshot.",
    whatItDoes: "Restores files from a local backup snapshot.",
    changesFiles: "live_content_files",
  },
];

function groupCounts() {
  return commands.reduce((summary, item) => {
    summary[item.group] = (summary[item.group] || 0) + 1;
    return summary;
  }, {});
}

function safetyCounts() {
  return commands.reduce((summary, item) => {
    summary[item.safety] = (summary[item.safety] || 0) + 1;
    return summary;
  }, {});
}

function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: "passed",
      commands: commands.length,
      groups: groupCounts(),
      safety: safetyCounts(),
      highImpactCommands: commands.filter((item) => item.safety === "writes_live_content").length,
    },
    commands,
    rules: [
      "Run the full control check before trusting the admin panel.",
      "Use dry-run commands before any confirmed publish or restore.",
      "Create a backup snapshot before confirmed publish.",
      "Never publish while draft quality, comparison, readiness, or dry-run checks are failing.",
      "Push to GitHub only after local publish checks pass and the changed files are reviewed.",
    ],
    guarantee:
      "Read-only command guidance. This script writes a local command guide report only. It does not edit content, publish files, commit, push, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Command Guide");
  console.log("===================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Commands: ${report.summary.commands}`);
  console.log(`High-impact commands: ${report.summary.highImpactCommands}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_FILE).replace(/\\/g, "/")}`);
}

main();
