#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const COMMAND_GUIDE_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-command-guide-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const MANUAL_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-operations-manual-report.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function commandById(commandGuide) {
  const commands = commandGuide && Array.isArray(commandGuide.commands) ? commandGuide.commands : [];
  return new Map(commands.map((command) => [command.id, command.command]));
}

function cmd(commands, id, fallback) {
  return commands.get(id) || fallback;
}

function main() {
  const commandGuide = readJsonIfExists(COMMAND_GUIDE_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const commands = commandById(commandGuide);
  const blockers = [];
  const warnings = [];

  if (!commandGuide) {
    blockers.push({
      scope: "admin_command_guide",
      message: "Admin command guide report is missing. Run build-admin-command-guide.js first.",
    });
  }

  if (!pushPackage) {
    warnings.push({
      scope: "push_package",
      message: "Push package report is missing. Push guidance will be less specific.",
    });
  }

  if (!deployment) {
    warnings.push({
      scope: "deployment_readiness",
      message: "Deployment readiness report is missing. Deploy guidance will be less specific.",
    });
  }

  const workflows = [
    {
      id: "daily_health_check",
      title: "Daily website health check",
      purpose: "Use this when you only want to know whether the website system is healthy.",
      risk: "low",
      steps: [
        {
          label: "Run the full local control check",
          command: cmd(commands, "full_control_check", "node scripts/run-admin-control-check.js"),
          expectedResult: "All checks pass and outputs/admin/index.html is refreshed.",
        },
        {
          label: "Open the local admin preview",
          command: "Open outputs/admin/index.html in a browser",
          expectedResult: "Review Health, Deployment Readiness, Git Status, and Push Package cards.",
        },
      ],
    },
    {
      id: "create_new_article",
      title: "Create a new article safely",
      purpose: "Use this when you want to prepare a new blog article without touching the live site yet.",
      risk: "medium",
      steps: [
        {
          label: "Create a private draft",
          command: cmd(
            commands,
            "create_new_article_draft",
            'node scripts/create-new-article-draft.js new-article-slug --category open-when-letters --title "New Article Title" --confirm'
          ),
          expectedResult: "A draft JSON file appears under content/drafts/articles.",
        },
        {
          label: "Edit only the draft JSON",
          command: "Edit content/drafts/articles/{draft}.draft.json",
          expectedResult: "The public website files remain untouched while writing.",
        },
        {
          label: "Refresh checks and previews",
          command: cmd(commands, "full_control_check", "node scripts/run-admin-control-check.js"),
          expectedResult: "Draft Quality, Draft Fix List, Draft Edit Guide, and draft previews are updated.",
        },
      ],
    },
    {
      id: "prepare_publish",
      title: "Prepare a draft for publish",
      purpose: "Use this only after the draft text, SEO fields, FAQ, CTA, and internal links are ready.",
      risk: "high",
      steps: [
        {
          label: "Set draft publish intent to ready",
          command: "Set draftPublishIntent to ready inside the draft JSON",
          expectedResult: "The draft enters the publish safety chain.",
        },
        {
          label: "Run the full control check",
          command: cmd(commands, "full_control_check", "node scripts/run-admin-control-check.js"),
          expectedResult: "Publish Readiness and Pre-Publish Checklist show whether the draft is safe.",
        },
        {
          label: "Review the dry-run plan",
          command: cmd(commands, "publish_dry_run", "node scripts/publish-article-draft-dry-run.js --dry-run"),
          expectedResult: "The report lists exactly which files would change.",
        },
        {
          label: "Create a backup snapshot",
          command: cmd(commands, "backup_snapshot", "node scripts/create-backup-snapshot.js --confirm"),
          expectedResult: "A local backup exists before confirmed publish.",
        },
      ],
    },
    {
      id: "confirmed_publish",
      title: "Confirmed publish",
      purpose: "Use this only when all safety cards pass and you intentionally want to update site files.",
      risk: "very_high",
      steps: [
        {
          label: "Run confirmed publish",
          command: cmd(commands, "publish_confirmed", "node scripts/publish-article-draft.js --confirm"),
          expectedResult: "Ready drafts are moved into published content and generated site files are refreshed.",
        },
        {
          label: "Run the full control check again",
          command: cmd(commands, "full_control_check", "node scripts/run-admin-control-check.js"),
          expectedResult: "The full system passes after publish.",
        },
        {
          label: "Review Git diff manually",
          command: "git status --short && git diff --stat",
          expectedResult: "Only intended content and generated discovery files changed.",
        },
      ],
    },
    {
      id: "push_and_deploy",
      title: "Push and Cloudflare deploy",
      purpose: "Use this only after local commits are reviewed and you are ready for Cloudflare deployment.",
      risk: "very_high",
      steps: [
        {
          label: "Review push package",
          command: "Review outputs/admin/push-package-report.json or the Push Package panel card",
          expectedResult: "You know exactly which local commits will go to GitHub.",
        },
        {
          label: "Review deployment readiness",
          command: "Review outputs/admin/deployment-readiness-report.json or the Deployment Readiness panel card",
          expectedResult: "No blocked deploy gates remain.",
        },
        {
          label: "Push only after intentional approval",
          command: "git push",
          expectedResult: "GitHub receives the reviewed commits and Cloudflare Pages may deploy.",
        },
      ],
    },
    {
      id: "restore_after_problem",
      title: "Restore after a bad publish",
      purpose: "Use this only if a confirmed publish created a visible problem and a backup snapshot exists.",
      risk: "very_high",
      steps: [
        {
          label: "Run restore dry-run",
          command: cmd(commands, "restore_dry_run", "node scripts/restore-backup-snapshot-dry-run.js"),
          expectedResult: "You see exactly which files would be restored.",
        },
        {
          label: "Run confirmed restore only if needed",
          command: cmd(commands, "restore_confirmed", "node scripts/restore-backup-snapshot.js --confirm"),
          expectedResult: "Files are restored from the local backup snapshot.",
        },
        {
          label: "Run the full control check",
          command: cmd(commands, "full_control_check", "node scripts/run-admin-control-check.js"),
          expectedResult: "The system is healthy after restore.",
        },
      ],
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      workflows: workflows.length,
      blockers: blockers.length,
      warnings: warnings.length,
      pushPackageStatus: pushPackage && pushPackage.summary ? pushPackage.summary.status : null,
      deploymentStatus: deployment && deployment.summary ? deployment.summary.status : null,
    },
    blockers,
    warnings,
    workflows,
    principles: [
      "Draft first, publish later.",
      "Preview and audit before any confirmed action.",
      "Dry-run before publish or restore.",
      "Backup before confirmed publish.",
      "Review Git package before push because push can trigger Cloudflare deploy.",
    ],
    guarantee:
      "Read-only operations manual. This script writes local guidance only. It does not edit content, publish files, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(MANUAL_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Operations Manual");
  console.log("=======================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Workflows: ${report.summary.workflows}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Report: ${relative(MANUAL_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
