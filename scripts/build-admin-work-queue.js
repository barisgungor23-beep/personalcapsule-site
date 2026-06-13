#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-work-queue-report.json");

const CONTROL_FILE = path.join(ADMIN_OUTPUT_DIR, "control-report.json");
const HOME_BRIEF_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-home-brief-report.json");
const DASHBOARD_SNAPSHOT_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-dashboard-snapshot-report.json");
const DRAFT_QUALITY_FILE = path.join(ADMIN_OUTPUT_DIR, "draft-quality-report.json");
const PRE_PUBLISH_FILE = path.join(ADMIN_OUTPUT_DIR, "pre-publish-checklist-report.json");
const PUBLISH_WIZARD_FILE = path.join(ADMIN_OUTPUT_DIR, "publish-wizard-report.json");
const GIT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");
const DEPLOYMENT_FILE = path.join(ADMIN_OUTPUT_DIR, "deployment-readiness-report.json");
const SAFE_PUSH_FILE = path.join(ADMIN_OUTPUT_DIR, "safe-push-checklist-report.json");
const DOMAIN_POLICY_FILE = path.join(ADMIN_OUTPUT_DIR, "domain-safety-policy-report.json");
const PUSH_CONFIRMATION_FILE = path.join(ADMIN_OUTPUT_DIR, "push-confirmation-guide-report.json");
const FINAL_PUSH_REVIEW_FILE = path.join(ADMIN_OUTPUT_DIR, "final-push-review-report.json");
const BACKUP_RESTORE_FILE = path.join(ADMIN_OUTPUT_DIR, "backup-restore-center-report.json");
const REPORT_FRESHNESS_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-report-freshness-report.json");

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

function task(id, title, priority, status, phase, reason, source, command, doneWhen, safety) {
  return {
    id,
    title,
    priority,
    status,
    phase,
    reason,
    source,
    command,
    doneWhen,
    safety,
  };
}

function main() {
  const control = readJsonIfExists(CONTROL_FILE);
  const homeBrief = readJsonIfExists(HOME_BRIEF_FILE);
  const snapshot = readJsonIfExists(DASHBOARD_SNAPSHOT_FILE);
  const draftQuality = readJsonIfExists(DRAFT_QUALITY_FILE);
  const prePublish = readJsonIfExists(PRE_PUBLISH_FILE);
  const publishWizard = readJsonIfExists(PUBLISH_WIZARD_FILE);
  const git = readJsonIfExists(GIT_FILE);
  const pushPackage = readJsonIfExists(PUSH_PACKAGE_FILE);
  const deployment = readJsonIfExists(DEPLOYMENT_FILE);
  const safePush = readJsonIfExists(SAFE_PUSH_FILE);
  const domainPolicy = readJsonIfExists(DOMAIN_POLICY_FILE);
  const pushConfirmation = readJsonIfExists(PUSH_CONFIRMATION_FILE);
  const finalPushReview = readJsonIfExists(FINAL_PUSH_REVIEW_FILE);
  const backupRestore = readJsonIfExists(BACKUP_RESTORE_FILE);
  const freshness = readJsonIfExists(REPORT_FRESHNESS_FILE);

  const controlSummary = summaryOf(control);
  const homeSummary = summaryOf(homeBrief);
  const snapshotSummary = summaryOf(snapshot);
  const draftSummary = summaryOf(draftQuality);
  const prePublishSummary = summaryOf(prePublish);
  const wizardSummary = summaryOf(publishWizard);
  const gitSummary = summaryOf(git);
  const pushSummary = summaryOf(pushPackage);
  const deploymentSummary = summaryOf(deployment);
  const safePushSummary = summaryOf(safePush);
  const domainPolicySummary = summaryOf(domainPolicy);
  const pushConfirmationSummary = summaryOf(pushConfirmation);
  const finalPushSummary = summaryOf(finalPushReview);
  const backupSummary = summaryOf(backupRestore);
  const freshnessSummary = summaryOf(freshness);

  const tasks = [];

  if (!control || controlSummary.status !== "passed") {
    tasks.push(
      task(
        "fix_control_check",
        "Fix the full control check first",
        1,
        "blocked",
        "system",
        `Full control status is ${controlSummary.status || "missing"}. Publishing or pushing would be unsafe.`,
        "outputs/admin/control-report.json",
        "node scripts/run-admin-control-check.js",
        "The full control report says passed with zero failed steps.",
        "Do not publish, push, restore, or deploy while this is blocked."
      )
    );
  }

  if ((draftSummary.blocked || 0) > 0 || draftSummary.status === "blocked") {
    tasks.push(
      task(
        "fix_blocked_drafts",
        "Fix blocked drafts before any publish work",
        2,
        "blocked",
        "content",
        `${draftSummary.blocked || 0} draft(s) are blocked by quality checks.`,
        "outputs/admin/draft-quality-report.json",
        "node scripts/build-draft-fix-list.js",
        "Draft quality has zero blocked drafts.",
        "Do not publish a draft that is marked blocked."
      )
    );
  }

  if ((prePublishSummary.readyDrafts || 0) > 0 || (wizardSummary.plannedFileOperations || 0) > 0) {
    const hasBackup = Boolean(backupSummary.confirmedBackupAvailable);
    tasks.push(
      task(
        "review_publish_candidate",
        hasBackup ? "Review ready draft before confirmed publish" : "Create or confirm backup before publish",
        hasBackup ? 3 : 2,
        hasBackup ? "review" : "blocked",
        "publish",
        `${prePublishSummary.readyDrafts || 0} draft(s) look ready and ${prePublishSummary.plannedFileOperations || 0} file operation(s) may be planned.`,
        "outputs/admin/publish-wizard-report.json",
        "node scripts/build-publish-wizard.js",
        hasBackup ? "You have reviewed preview, dry-run, rollback plan, and backup." : "Backup/restore center shows a confirmed backup path.",
        "The work queue is read-only. Confirmed publish must still be a separate human decision."
      )
    );
  }

  if (wizardSummary.status && !["idle", "ready_for_human_publish_review"].includes(wizardSummary.status)) {
    tasks.push(
      task(
        "review_publish_wizard",
        "Review the publish wizard",
        4,
        wizardSummary.status === "blocked" ? "blocked" : "review",
        "publish",
        `Publish wizard status is ${wizardSummary.status}. Current step: ${wizardSummary.currentStep || "unknown"}.`,
        "outputs/admin/publish-wizard-report.json",
        "node scripts/build-publish-wizard.js",
        "Publish wizard is idle or ready for final human review.",
        "Do not skip dry-run, rollback, and backup checks."
      )
    );
  }

  if (gitSummary.pushSafety && gitSummary.pushSafety !== "clean") {
    tasks.push(
      task(
        "review_git_state",
        "Review local Git state before any push",
        5,
        "review",
        "git",
        `${gitSummary.totalChangedFiles || 0} changed file(s). Push safety: ${gitSummary.pushSafety}.`,
        "outputs/admin/git-status-report.json",
        "git status --short",
        "Only intentional files are changed or untracked.",
        "Never stage CNAME unless you intentionally want to change domain behavior."
      )
    );
  }

  if (safePushSummary.decision && safePushSummary.decision !== "safe_after_human_review" && safePushSummary.decision !== "nothing_to_push") {
    tasks.push(
      task(
        "review_safe_push_checklist",
        "Review the safe push checklist",
        4,
        safePushSummary.status === "blocked" ? "blocked" : "review",
        "deploy",
        `Safe push decision: ${safePushSummary.decision}. ${safePush.nextAction || "Review before push."}`,
        "outputs/admin/safe-push-checklist-report.json",
        "node scripts/build-safe-push-checklist.js",
        "Safe push checklist says safe_after_human_review or you intentionally decide to wait.",
        "This queue does not push. It only points you to the final push decision report."
      )
    );
  }

  if (domainPolicySummary.policyDecision && domainPolicySummary.policyDecision !== "domain_safe") {
    tasks.push(
      task(
        "review_domain_safety_policy",
        "Review the domain safety policy",
        4.5,
        domainPolicySummary.status === "blocked" ? "blocked" : "review",
        "domain",
        `Domain decision: ${domainPolicySummary.policyDecision}. ${domainPolicy.nextAction || "Review domain policy before push."}`,
        "outputs/admin/domain-safety-policy-report.json",
        "node scripts/build-domain-safety-policy.js",
        "CNAME is not staged, or you intentionally decide to change domain behavior.",
        "Domain files can change where your public site points. Review them before push."
      )
    );
  }

  if (pushConfirmationSummary.finalDecision && pushConfirmationSummary.finalDecision !== "ready_after_human_confirmation") {
    tasks.push(
      task(
        "review_push_confirmation_guide",
        "Review the push confirmation guide",
        4.75,
        pushConfirmationSummary.status === "blocked" ? "blocked" : "review",
        "deploy",
        `Push confirmation: ${pushConfirmationSummary.finalDecision}. ${pushConfirmation.nextAction || "Review confirmation guide before push."}`,
        "outputs/admin/push-confirmation-guide-report.json",
        "node scripts/build-push-confirmation-guide.js",
        "You have read and accepted every final confirmation line.",
        "This guide is the last human review step before GitHub push."
      )
    );
  }

  if (finalPushSummary.status && finalPushSummary.status !== "safe") {
    tasks.push(
      task(
        "review_final_push_review",
        "Review the final push decision",
        4.9,
        finalPushSummary.status === "blocked" ? "blocked" : "review",
        "deploy",
        `Final push review: ${finalPushSummary.finalAnswer || finalPushReview.founderAnswer || "Review before push."}`,
        "outputs/admin/final-push-review-report.json",
        "node scripts/build-final-push-review.js",
        "Final Push Review says safe, or you intentionally decide to wait.",
        "This is the plain-language last gate. It does not push or deploy."
      )
    );
  }

  if (pushSummary.status && pushSummary.status !== "clean") {
    tasks.push(
      task(
        "review_push_package",
        "Review the local commit package",
        6,
        "review",
        "deploy",
        `${pushSummary.ahead || 0} local commit(s) are ahead of the remote branch.`,
        "outputs/admin/push-package-report.json",
        "node scripts/build-push-package-report.js",
        "You understand what will be sent to GitHub before push.",
        "Pushing should happen only after Git status and deployment readiness are reviewed."
      )
    );
  }

  if (deploymentSummary.status && deploymentSummary.status !== "ready") {
    tasks.push(
      task(
        "review_deployment_readiness",
        "Review deployment readiness",
        7,
        deploymentSummary.status === "blocked" ? "blocked" : "review",
        "deploy",
        deployment && deployment.nextAction ? deployment.nextAction : "Deployment readiness needs review.",
        "outputs/admin/deployment-readiness-report.json",
        "node scripts/build-deployment-readiness.js",
        "Deployment readiness is ready or you intentionally decide to wait.",
        "Do not deploy from this queue. This queue only tells you what to inspect."
      )
    );
  }

  if (freshnessSummary.status && freshnessSummary.status !== "passed") {
    tasks.push(
      task(
        "refresh_admin_reports",
        "Refresh admin reports",
        8,
        "review",
        "system",
        `${freshnessSummary.stale || 0} stale report(s), ${freshnessSummary.missing || 0} missing report(s).`,
        "outputs/admin/admin-report-freshness-report.json",
        "node scripts/run-admin-control-check.js",
        "Report freshness has no stale or missing important reports.",
        "Fresh reports prevent decisions based on old state."
      )
    );
  }

  if (tasks.length === 0) {
    tasks.push(
      task(
        "plan_next_content",
        "Plan the next content move calmly",
        10,
        "safe",
        "content",
        `${snapshotSummary.articles || 0} article(s), ${snapshotSummary.categories || 0} categor(ies), ${snapshotSummary.drafts || 0} draft(s). No urgent blocker is visible.`,
        "outputs/admin/admin-dashboard-snapshot-report.json",
        "node scripts/run-admin-control-check.js",
        "You have chosen whether to wait, draft, or analyze performance.",
        "When unsure, refresh the full control check before editing."
      )
    );
  }

  tasks.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

  const blocked = tasks.filter((item) => item.status === "blocked");
  const review = tasks.filter((item) => item.status === "review");
  const safe = tasks.filter((item) => item.status === "safe");

  const status = blocked.length > 0 ? "blocked" : review.length > 0 ? "review" : "safe";
  const nextTask = tasks[0];

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      tasks: tasks.length,
      blocked: blocked.length,
      review: review.length,
      safe: safe.length,
      articles: snapshotSummary.articles || 0,
      pages: snapshotSummary.pages || 0,
      commitsAhead: pushSummary.ahead || homeSummary.commitsAhead || 0,
      changedFiles: gitSummary.totalChangedFiles || homeSummary.changedFiles || 0,
      currentMode: homeSummary.status || "unknown",
    },
    nextTask,
    tasks,
    simpleRule:
      "Start with the first task. If it is blocked, do not publish or push. If it is review, inspect the named source report before taking action.",
    sources: [
      relative(CONTROL_FILE),
      relative(HOME_BRIEF_FILE),
      relative(DASHBOARD_SNAPSHOT_FILE),
      relative(DRAFT_QUALITY_FILE),
      relative(PRE_PUBLISH_FILE),
      relative(PUBLISH_WIZARD_FILE),
      relative(GIT_FILE),
      relative(PUSH_PACKAGE_FILE),
      relative(DEPLOYMENT_FILE),
      relative(SAFE_PUSH_FILE),
      relative(DOMAIN_POLICY_FILE),
      relative(PUSH_CONFIRMATION_FILE),
      relative(BACKUP_RESTORE_FILE),
      relative(REPORT_FRESHNESS_FILE),
    ],
    guarantee:
      "Read-only admin work queue. This script reads local admin reports and writes a local prioritized task list only. It does not edit content, publish files, copy backups, restore files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Admin Work Queue");
  console.log("================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Tasks: ${report.summary.tasks}`);
  console.log(`Blocked: ${report.summary.blocked}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Next: ${report.nextTask ? report.nextTask.title : "None"}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);
}

main();
