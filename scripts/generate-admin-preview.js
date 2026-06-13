#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODEL_FILE = path.join(ROOT, "outputs", "admin", "admin-read-model.json");
const OUTPUT_FILE = path.join(ROOT, "outputs", "admin", "index.html");
const CONTROL_REPORT_FILE = path.join(ROOT, "outputs", "admin", "control-report.json");
const ADMIN_REPORT_INDEX_FILE = path.join(ROOT, "outputs", "admin", "admin-report-index.json");
const ADMIN_REPORT_FRESHNESS_FILE = path.join(ROOT, "outputs", "admin", "admin-report-freshness-report.json");
const ADMIN_FAILURE_PLAYBOOK_FILE = path.join(ROOT, "outputs", "admin", "admin-failure-playbook-report.json");
const ADMIN_DEPENDENCY_MAP_FILE = path.join(ROOT, "outputs", "admin", "admin-dependency-map-report.json");
const ADMIN_REPORT_DETAIL_VIEWER_FILE = path.join(ROOT, "outputs", "admin", "admin-report-detail-viewer-report.json");
const ADMIN_SYSTEM_OVERVIEW_FILE = path.join(ROOT, "outputs", "admin", "admin-system-overview-report.json");
const FOUNDER_DECISION_CENTER_FILE = path.join(ROOT, "outputs", "admin", "founder-decision-center-report.json");
const ADMIN_HOME_BRIEF_FILE = path.join(ROOT, "outputs", "admin", "admin-home-brief-report.json");
const ADMIN_WORK_QUEUE_FILE = path.join(ROOT, "outputs", "admin", "admin-work-queue-report.json");
const ADMIN_DASHBOARD_SNAPSHOT_FILE = path.join(ROOT, "outputs", "admin", "admin-dashboard-snapshot-report.json");
const ADMIN_COMMAND_GUIDE_FILE = path.join(ROOT, "outputs", "admin", "admin-command-guide-report.json");
const ADMIN_ACTION_FLOW_FILE = path.join(ROOT, "outputs", "admin", "admin-action-flow-report.json");
const ADMIN_COMMAND_RISK_MATRIX_FILE = path.join(ROOT, "outputs", "admin", "admin-command-risk-matrix-report.json");
const GIT_STATUS_FILE = path.join(ROOT, "outputs", "admin", "git-status-report.json");
const PUSH_PACKAGE_FILE = path.join(ROOT, "outputs", "admin", "push-package-report.json");
const DEPLOYMENT_READINESS_FILE = path.join(ROOT, "outputs", "admin", "deployment-readiness-report.json");
const SAFE_PUSH_CHECKLIST_FILE = path.join(ROOT, "outputs", "admin", "safe-push-checklist-report.json");
const DOMAIN_SAFETY_POLICY_FILE = path.join(ROOT, "outputs", "admin", "domain-safety-policy-report.json");
const PUSH_CONFIRMATION_GUIDE_FILE = path.join(ROOT, "outputs", "admin", "push-confirmation-guide-report.json");
const ADMIN_OPERATIONS_MANUAL_FILE = path.join(ROOT, "outputs", "admin", "admin-operations-manual-report.json");
const ADMIN_QUICK_START_FILE = path.join(ROOT, "outputs", "admin", "admin-quick-start-report.json");
const DRAFT_COMPARISON_FILE = path.join(ROOT, "outputs", "admin", "draft-comparison-report.json");
const DRAFT_QUALITY_FILE = path.join(ROOT, "outputs", "admin", "draft-quality-report.json");
const DRAFT_FIX_LIST_FILE = path.join(ROOT, "outputs", "admin", "draft-fix-list-report.json");
const DRAFT_EDIT_PLAN_FILE = path.join(ROOT, "outputs", "admin", "draft-edit-plan-report.json");
const DRAFT_EDIT_GUIDE_FILE = path.join(ROOT, "outputs", "admin", "draft-edit-guide-report.json");
const DRAFT_PATCH_APPLY_GUIDE_FILE = path.join(ROOT, "outputs", "admin", "draft-patch-apply-guide-report.json");
const PUBLISH_READINESS_FILE = path.join(ROOT, "outputs", "admin", "publish-readiness-report.json");
const PUBLISH_DRY_RUN_FILE = path.join(ROOT, "outputs", "admin", "publish-dry-run-report.json");
const PUBLISH_ROLLBACK_FILE = path.join(ROOT, "outputs", "admin", "publish-rollback-plan.json");
const BACKUP_SNAPSHOT_FILE = path.join(ROOT, "outputs", "admin", "backup-snapshot-dry-run-report.json");
const PRE_PUBLISH_CHECKLIST_FILE = path.join(ROOT, "outputs", "admin", "pre-publish-checklist-report.json");
const DRAFT_PUBLISH_SIMULATION_FILE = path.join(ROOT, "outputs", "admin", "draft-publish-simulation-summary-report.json");
const BACKUP_RESTORE_CENTER_FILE = path.join(ROOT, "outputs", "admin", "backup-restore-center-report.json");
const PUBLISH_WIZARD_FILE = path.join(ROOT, "outputs", "admin", "publish-wizard-report.json");
const RESTORE_DRY_RUN_FILE = path.join(ROOT, "outputs", "admin", "restore-backup-dry-run-report.json");
const RESTORE_REPORT_FILE = path.join(ROOT, "outputs", "admin", "restore-backup-report.json");
const PUBLISH_REPORT_FILE = path.join(ROOT, "outputs", "admin", "publish-report.json");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusClass(status) {
  if (status === "published" || status === "ok") return "good";
  if (status === "draft" || status === "short" || status === "long") return "warn";
  if (status === "archived" || status === "missing") return "bad";
  return "muted";
}

function renderMetric(label, value, hint) {
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>`;
}

function renderCategories(categories) {
  return categories
    .map(
      (category) => `
        <tr>
          <td>
            <strong>${escapeHtml(category.name)}</strong>
            <small>${escapeHtml(category.slug)}</small>
          </td>
          <td><span class="pill ${statusClass(category.status)}">${escapeHtml(category.status)}</span></td>
          <td>${category.articleCount}</td>
          <td>${category.keywordCount}</td>
          <td><span class="pill ${statusClass(category.seoTitleStatus)}">${escapeHtml(category.seoTitleStatus)}</span></td>
          <td><span class="pill ${statusClass(category.descriptionStatus)}">${escapeHtml(category.descriptionStatus)}</span></td>
          <td>${category.sitemapInclude ? "Yes" : "No"}</td>
          <td>${category.llmsInclude ? "Yes" : "No"}</td>
        </tr>`
    )
    .join("");
}

function renderArticles(articles) {
  return articles
    .map(
      (article) => `
        <tr data-article-row data-id="${escapeHtml(article.id)}" data-category="${escapeHtml(article.category)}" data-status="${escapeHtml(article.status)}" data-quality="${escapeHtml(article.qualityStatus)}" data-search="${escapeHtml(`${article.title} ${article.slug} ${article.categoryName} ${article.description}`.toLowerCase())}">
          <td>
            <strong>${escapeHtml(article.title)}</strong>
            <small>${escapeHtml(article.slug)}</small>
          </td>
          <td>${escapeHtml(article.categoryName)}</td>
          <td><span class="pill ${statusClass(article.status)}">${escapeHtml(article.status)}</span></td>
          <td><span class="pill ${statusClass(article.qualityStatus === "good" ? "ok" : article.qualityStatus === "review" ? "short" : "missing")}">${escapeHtml(article.qualityStatus)} · ${article.qualityScore}</span></td>
          <td>${article.qualityIssueCount}</td>
          <td>${article.seoTitleLength}</td>
          <td><span class="pill ${statusClass(article.descriptionStatus)}">${escapeHtml(article.descriptionStatus)}</span></td>
          <td>${article.bodyBlockCount}</td>
          <td>${article.faqCount}</td>
          <td>${article.relatedCount}</td>
          <td>${escapeHtml(article.dateModified || "")}</td>
          <td><button class="mini-btn" type="button" data-detail-id="${escapeHtml(article.id)}">View</button></td>
        </tr>`
    )
    .join("");
}

function renderCategoryOptions(categories) {
  return categories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
    .join("");
}

function renderHealthIssues(model) {
  const critical = model.health.critical || [];
  const warnings = model.health.warnings || [];

  if (critical.length === 0 && warnings.length === 0) {
    return `<div class="empty">No critical issues or warnings. The content model is ready for the next admin step.</div>`;
  }

  return `
    ${critical
      .map((issue) => `<div class="issue bad"><strong>Critical</strong><span>${escapeHtml(issue.message || issue)}</span></div>`)
      .join("")}
    ${warnings
      .map((issue) => `<div class="issue warn"><strong>Warning</strong><span>${escapeHtml(issue.message || issue)}</span></div>`)
      .join("")}`;
}

function renderPages(pages) {
  const pageRows = pages
    .map(
      (page) => `
        <tr>
          <td>
            <strong>${escapeHtml(page.title || "Untitled")}</strong>
            <small>${escapeHtml(page.path)}</small>
          </td>
          <td>${escapeHtml(page.type)}</td>
          <td>${escapeHtml(page.route)}</td>
          <td><span class="pill ${page.canonicalUrl ? "good" : "bad"}">${page.canonicalUrl ? "ok" : "missing"}</span></td>
          <td><span class="pill ${page.metaDescription ? "good" : "bad"}">${page.metaDescription ? "ok" : "missing"}</span></td>
        </tr>`
    )
    .join("");

  return pageRows;
}

function readControlReport() {
  if (!fs.existsSync(CONTROL_REPORT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONTROL_REPORT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminReportIndex() {
  if (!fs.existsSync(ADMIN_REPORT_INDEX_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_REPORT_INDEX_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminReportFreshness() {
  if (!fs.existsSync(ADMIN_REPORT_FRESHNESS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_REPORT_FRESHNESS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminFailurePlaybook() {
  if (!fs.existsSync(ADMIN_FAILURE_PLAYBOOK_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_FAILURE_PLAYBOOK_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminDependencyMap() {
  if (!fs.existsSync(ADMIN_DEPENDENCY_MAP_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_DEPENDENCY_MAP_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminReportDetailViewer() {
  if (!fs.existsSync(ADMIN_REPORT_DETAIL_VIEWER_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_REPORT_DETAIL_VIEWER_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminSystemOverview() {
  if (!fs.existsSync(ADMIN_SYSTEM_OVERVIEW_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_SYSTEM_OVERVIEW_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readFounderDecisionCenter() {
  if (!fs.existsSync(FOUNDER_DECISION_CENTER_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(FOUNDER_DECISION_CENTER_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminHomeBrief() {
  if (!fs.existsSync(ADMIN_HOME_BRIEF_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_HOME_BRIEF_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminWorkQueue() {
  if (!fs.existsSync(ADMIN_WORK_QUEUE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_WORK_QUEUE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminDashboardSnapshot() {
  if (!fs.existsSync(ADMIN_DASHBOARD_SNAPSHOT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_DASHBOARD_SNAPSHOT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminCommandGuide() {
  if (!fs.existsSync(ADMIN_COMMAND_GUIDE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_COMMAND_GUIDE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminActionFlow() {
  if (!fs.existsSync(ADMIN_ACTION_FLOW_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_ACTION_FLOW_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminCommandRiskMatrix() {
  if (!fs.existsSync(ADMIN_COMMAND_RISK_MATRIX_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_COMMAND_RISK_MATRIX_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readGitStatusReport() {
  if (!fs.existsSync(GIT_STATUS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(GIT_STATUS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPushPackageReport() {
  if (!fs.existsSync(PUSH_PACKAGE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUSH_PACKAGE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDeploymentReadiness() {
  if (!fs.existsSync(DEPLOYMENT_READINESS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DEPLOYMENT_READINESS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readSafePushChecklist() {
  if (!fs.existsSync(SAFE_PUSH_CHECKLIST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SAFE_PUSH_CHECKLIST_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDomainSafetyPolicy() {
  if (!fs.existsSync(DOMAIN_SAFETY_POLICY_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DOMAIN_SAFETY_POLICY_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPushConfirmationGuide() {
  if (!fs.existsSync(PUSH_CONFIRMATION_GUIDE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUSH_CONFIRMATION_GUIDE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminOperationsManual() {
  if (!fs.existsSync(ADMIN_OPERATIONS_MANUAL_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_OPERATIONS_MANUAL_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readAdminQuickStart() {
  if (!fs.existsSync(ADMIN_QUICK_START_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_QUICK_START_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftComparisonReport() {
  if (!fs.existsSync(DRAFT_COMPARISON_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_COMPARISON_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftQualityReport() {
  if (!fs.existsSync(DRAFT_QUALITY_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_QUALITY_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftFixListReport() {
  if (!fs.existsSync(DRAFT_FIX_LIST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_FIX_LIST_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftEditPlanReport() {
  if (!fs.existsSync(DRAFT_EDIT_PLAN_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_EDIT_PLAN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftEditGuideReport() {
  if (!fs.existsSync(DRAFT_EDIT_GUIDE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_EDIT_GUIDE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftPatchApplyGuideReport() {
  if (!fs.existsSync(DRAFT_PATCH_APPLY_GUIDE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_PATCH_APPLY_GUIDE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPublishReadinessReport() {
  if (!fs.existsSync(PUBLISH_READINESS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUBLISH_READINESS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPublishDryRunReport() {
  if (!fs.existsSync(PUBLISH_DRY_RUN_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUBLISH_DRY_RUN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPublishRollbackPlan() {
  if (!fs.existsSync(PUBLISH_ROLLBACK_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUBLISH_ROLLBACK_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readBackupSnapshotReport() {
  if (!fs.existsSync(BACKUP_SNAPSHOT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(BACKUP_SNAPSHOT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPrePublishChecklist() {
  if (!fs.existsSync(PRE_PUBLISH_CHECKLIST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PRE_PUBLISH_CHECKLIST_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readDraftPublishSimulationSummary() {
  if (!fs.existsSync(DRAFT_PUBLISH_SIMULATION_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DRAFT_PUBLISH_SIMULATION_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readBackupRestoreCenter() {
  if (!fs.existsSync(BACKUP_RESTORE_CENTER_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(BACKUP_RESTORE_CENTER_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPublishWizard() {
  if (!fs.existsSync(PUBLISH_WIZARD_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUBLISH_WIZARD_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readRestoreDryRunReport() {
  if (!fs.existsSync(RESTORE_DRY_RUN_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(RESTORE_DRY_RUN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readRestoreReport() {
  if (!fs.existsSync(RESTORE_REPORT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(RESTORE_REPORT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function readPublishReport() {
  if (!fs.existsSync(PUBLISH_REPORT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PUBLISH_REPORT_FILE, "utf8"));
  } catch {
    return null;
  }
}

function reportStatus(report) {
  if (!report) return "not_run";
  return report.summary && report.summary.status === "passed" ? "passed" : "failed";
}

function gateClass(status) {
  if (status === "passed" || status === "ready" || status === "idle") return "passed";
  if (status === "not_run" || status === "review") return "needs-review";
  return "failed";
}

function gateLabel(status) {
  const labels = {
    passed: "Passed",
    failed: "Blocked",
    not_run: "Not run",
    ready: "Ready",
    idle: "Idle",
    review: "Review",
  };
  return labels[status] || status;
}

function renderWorkflowGate(title, status, detail) {
  return `
    <div class="workflow-gate ${gateClass(status)}">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
      <small>${escapeHtml(gateLabel(status))}</small>
    </div>`;
}

function renderFounderDecisionCenter(report) {
  if (!report) {
    return `
      <section class="founder-center founder-center-review">
        <div class="founder-center-main">
          <span class="home-eyebrow">Founder Decision Center</span>
          <h2>Can I safely act now?</h2>
          <p>Run node scripts/run-admin-control-check.js to generate the founder decision center.</p>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const decisions = Array.isArray(report.decisions) ? report.decisions : [];
  const nextSteps = Array.isArray(report.nextSteps) ? report.nextSteps : [];
  const guardrails = Array.isArray(report.guardrails) ? report.guardrails : [];
  const centerClass =
    summary.status === "safe"
      ? "founder-center-safe"
      : summary.status === "blocked"
        ? "founder-center-blocked"
        : "founder-center-review";

  return `
    <section class="founder-center ${centerClass}">
      <div class="founder-center-main">
        <span class="home-eyebrow">Founder Decision Center</span>
        <h2>Can I safely act now?</h2>
        <strong>${escapeHtml(summary.headline || "Review before action")}</strong>
        <p>${escapeHtml(report.founderAnswer || "Review the admin reports before any live action.")}</p>
        <div class="home-action">
          <span>Safest action</span>
          <b>${escapeHtml(report.safestAction || "Run the full control check.")}</b>
        </div>
      </div>
      <div class="founder-decision-strip">
        ${decisions
          .map((item) => {
            const className =
              item.status === "blocked" ? "decision-blocked" : item.status === "review" ? "decision-review" : "decision-safe";
            return `
              <article class="founder-decision ${className}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.answer)}</strong>
                <small>${escapeHtml(item.plainMeaning || item.detail)}</small>
                <em>${escapeHtml(item.source)}</em>
              </article>`;
          })
          .join("")}
      </div>
      <div class="founder-next-steps">
        ${nextSteps
          .map((item) => {
            const className =
              item.status === "blocked" ? "failed" : item.status === "review" ? "needs-review" : "passed";
            return `
              <div class="workflow-gate ${className}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.why)}</span>
                  <span>Source: ${escapeHtml(item.source)}</span>
                </div>
                <small>${escapeHtml(item.status)}</small>
              </div>`;
          })
          .join("")}
      </div>
      <div class="home-rules">
        ${guardrails
          .slice(0, 4)
          .map((item) => `<span>${escapeHtml(item)}</span>`)
          .join("")}
      </div>
    </section>`;
}

function renderPublishWorkflowStatus({
  model,
  controlReport,
  draftComparisonReport,
  publishReadinessReport,
  publishDryRunReport,
  publishRollbackPlan,
  backupSnapshotReport,
  restoreDryRunReport,
}) {
  const criticalIssues = model.health && Array.isArray(model.health.critical) ? model.health.critical.length : 0;
  const seoWarnings = model.summary ? model.summary.seoWarnings || 0 : 0;
  const readinessSummary = publishReadinessReport && publishReadinessReport.summary ? publishReadinessReport.summary : {};
  const dryRunSummary = publishDryRunReport && publishDryRunReport.summary ? publishDryRunReport.summary : {};
  const rollbackSummary = publishRollbackPlan && publishRollbackPlan.summary ? publishRollbackPlan.summary : {};
  const backupSummary = backupSnapshotReport && backupSnapshotReport.summary ? backupSnapshotReport.summary : {};
  const restoreSummary = restoreDryRunReport && restoreDryRunReport.summary ? restoreDryRunReport.summary : {};

  const drafts = readinessSummary.drafts || 0;
  const readyDrafts = readinessSummary.readyDrafts || 0;
  const blockedDrafts = readinessSummary.blockedDrafts || 0;
  const plannedOperations = dryRunSummary.plannedFileOperations || 0;

  const contentStatus = criticalIssues > 0 ? "failed" : seoWarnings > 0 ? "review" : "passed";
  const draftStatus = blockedDrafts > 0 ? "failed" : readyDrafts > 0 ? "ready" : "idle";
  const comparisonStatus = drafts > 0 ? reportStatus(draftComparisonReport) : "idle";
  const readinessStatus = drafts > 0 ? reportStatus(publishReadinessReport) : "idle";
  const dryRunStatus = drafts > 0 ? reportStatus(publishDryRunReport) : "idle";
  const rollbackStatus = drafts > 0 ? reportStatus(publishRollbackPlan) : "idle";
  const backupStatus = drafts > 0 ? reportStatus(backupSnapshotReport) : "idle";
  const restoreStatus = backupSummary.files > 0 || restoreSummary.restoreOperations > 0 ? reportStatus(restoreDryRunReport) : "idle";
  const controlStatus = reportStatus(controlReport);

  let headline = "System is healthy";
  let explanation = "There are no active drafts right now. The website content system is ready for the next safe editing step.";
  let overallStatus = "idle";

  if (criticalIssues > 0 || blockedDrafts > 0 || controlStatus === "failed") {
    headline = "Publishing is blocked";
    explanation = "At least one safety check needs attention before any content should be published.";
    overallStatus = "failed";
  } else if (controlStatus === "not_run") {
    headline = "Run the control check to refresh status";
    explanation = "The workflow summary needs a fresh control report before it can describe the system as healthy.";
    overallStatus = "review";
  } else if (readyDrafts > 0 && dryRunStatus === "passed" && backupStatus === "passed") {
    headline = "Drafts are ready for backup and publish";
    explanation = "Ready drafts passed preview, comparison, publish dry-run, rollback planning and backup planning checks.";
    overallStatus = "ready";
  } else if (drafts > 0) {
    headline = "Drafts are in progress";
    explanation = "Drafts exist, but the full publish chain is not completely ready yet.";
    overallStatus = "review";
  }

  return `
    <section class="panel workflow-status-panel">
      <div class="panel-head">
        <h2>Publish Workflow Status</h2>
        <span class="pill ${overallStatus === "failed" ? "bad" : overallStatus === "review" ? "warn" : "good"}">${escapeHtml(gateLabel(overallStatus))}</span>
      </div>
      <div class="workflow-status-hero ${gateClass(overallStatus)}">
        <strong>${escapeHtml(headline)}</strong>
        <p>${escapeHtml(explanation)}</p>
      </div>
      <div class="workflow-status-summary">
        <div class="detail-stat"><span>Drafts</span><strong>${escapeHtml(drafts)}</strong></div>
        <div class="detail-stat"><span>Ready drafts</span><strong>${escapeHtml(readyDrafts)}</strong></div>
        <div class="detail-stat"><span>Blocked drafts</span><strong>${escapeHtml(blockedDrafts)}</strong></div>
        <div class="detail-stat"><span>Planned ops</span><strong>${escapeHtml(plannedOperations)}</strong></div>
      </div>
      <div class="workflow-gates">
        ${renderWorkflowGate(
          "Content health",
          contentStatus,
          criticalIssues > 0
            ? `${criticalIssues} critical issue(s) found.`
            : seoWarnings > 0
              ? `${seoWarnings} warning(s) should be reviewed.`
              : "No critical content issues."
        )}
        ${renderWorkflowGate(
          "Draft state",
          draftStatus,
          drafts === 0
            ? "No active drafts waiting for publish."
            : `${readyDrafts} ready, ${blockedDrafts} blocked.`
        )}
        ${renderWorkflowGate(
          "Preview and comparison",
          comparisonStatus,
          drafts === 0 ? "No draft comparison needed." : "Draft changes have been compared with published content."
        )}
        ${renderWorkflowGate(
          "Publish readiness",
          readinessStatus,
          drafts === 0 ? "Nothing is waiting for publish." : "Drafts have been checked for publish blockers."
        )}
        ${renderWorkflowGate(
          "Publish dry run",
          dryRunStatus,
          drafts === 0 ? "No publish operations planned." : `${plannedOperations} local file operation(s) planned.`
        )}
        ${renderWorkflowGate(
          "Rollback plan",
          rollbackStatus,
          drafts === 0 ? "No rollback plan needed." : `${rollbackSummary.restorePaths || 0} restore path(s) planned.`
        )}
        ${renderWorkflowGate(
          "Backup plan",
          backupStatus,
          drafts === 0 ? "No backup needed." : `${backupSummary.files || 0} file(s) need backup before publish.`
        )}
        ${renderWorkflowGate(
          "Restore readiness",
          restoreStatus,
          restoreStatus === "idle"
            ? "No backup restore is currently needed."
            : `${restoreSummary.restoreOperations || 0} restore operation(s) can be performed if needed.`
        )}
        ${renderWorkflowGate(
          "Full control check",
          controlStatus,
          controlReport && controlReport.summary
            ? `${controlReport.summary.passedSteps || 0} passed, ${controlReport.summary.failedSteps || 0} failed.`
            : "Run the full control check to refresh this status."
        )}
      </div>
    </section>`;
}

function renderAdminHomeBrief(report) {
  if (!report) {
    return `
      <section class="home-brief home-brief-review">
        <div class="home-brief-main">
          <span class="home-eyebrow">Admin Home Brief</span>
          <h2>What should I do now?</h2>
          <p>Run node scripts/run-admin-control-check.js to generate the founder-friendly home brief.</p>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const decisions = Array.isArray(report.decisions) ? report.decisions : [];
  const rules = Array.isArray(report.safestRules) ? report.safestRules : [];
  const briefClass =
    summary.status === "safe" ? "home-brief-safe" : summary.status === "blocked" ? "home-brief-blocked" : "home-brief-review";

  return `
    <section class="home-brief ${briefClass}">
      <div class="home-brief-main">
        <span class="home-eyebrow">Admin Home Brief</span>
        <h2>What should I do now?</h2>
        <strong>${escapeHtml(summary.headline || "Review the admin system")}</strong>
        <p>${escapeHtml(report.plainEnglish || "Review the local admin reports before any confirmed action.")}</p>
        <div class="home-action">
          <span>Primary action</span>
          <b>${escapeHtml(report.primaryAction || "Run the full control check.")}</b>
        </div>
      </div>
      <div class="home-decision-grid">
        ${decisions
          .map((item) => {
            const className =
              item.status === "blocked" ? "decision-blocked" : item.status === "review" ? "decision-review" : "decision-safe";
            return `
              <article class="home-decision ${className}">
                <span>${escapeHtml(item.question)}</span>
                <strong>${escapeHtml(item.answer)}</strong>
                <small>${escapeHtml(item.detail)}</small>
              </article>`;
          })
          .join("")}
      </div>
      <div class="home-rules">
        ${rules
          .slice(0, 4)
          .map((item) => `<span>${escapeHtml(item)}</span>`)
          .join("")}
      </div>
    </section>`;
}

function renderAdminWorkQueue(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Work Queue</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No prioritized task list yet</strong>
            <span>Run node scripts/build-admin-work-queue.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const tasks = Array.isArray(report.tasks) ? report.tasks : [];
  const nextTask = report.nextTask || tasks[0] || null;
  const statusClassName = summary.status === "blocked" ? "bad" : summary.status === "review" ? "warn" : "good";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Work Queue</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "review" ? "issue warn" : "empty"}">
          <strong>${escapeHtml(nextTask ? nextTask.title : "No current task")}</strong>
          <span>${escapeHtml(nextTask ? nextTask.reason : report.simpleRule || "No admin action is required right now.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Tasks</span><strong>${escapeHtml(summary.tasks || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
        <div class="detail-stat"><span>Changed files</span><strong>${escapeHtml(summary.changedFiles || 0)}</strong></div>
      </div>
      <div class="mini-list admin-work-queue-list">
        ${tasks
          .map((item) => {
            const itemClass = item.status === "blocked" ? "needs-review" : item.status === "review" ? "needs-review" : "passed";
            return `
              <div class="${itemClass}">
                <strong>${escapeHtml(item.priority)}. ${escapeHtml(item.title)} · ${escapeHtml(item.phase)}</strong>
                <span>${escapeHtml(item.reason)}</span>
                <span>Command: ${escapeHtml(item.command)}</span>
                <span>Done when: ${escapeHtml(item.doneWhen)}</span>
                <span>Safety: ${escapeHtml(item.safety)}</span>
                <span>Source: ${escapeHtml(item.source)}</span>
              </div>`;
          })
          .join("")}
      </div>
      <div class="workflow-list">
        <div class="workflow-step">
          <strong>Simple rule</strong>
          <span>${escapeHtml(report.simpleRule || "Start with the first task before taking any confirmed action.")}</span>
        </div>
      </div>
    </section>`;
}

function renderRestoreReport(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Restore Result</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No restore report yet</strong>
            <span>Run node scripts/restore-backup-snapshot.js --confirm only after restore dry-run passes.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const restored = Array.isArray(report.restored) ? report.restored : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Restore Result</h2>
        <span class="pill ${status}">${escapeHtml(report.mode || "confirmed_restore")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Files restored</span><strong>${escapeHtml(summary.filesRestored || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list restore-result-list">
        ${
          restored.length
            ? restored
                .slice(0, 12)
                .map(
                  (item) => `
                    <div class="passed">
                      <strong>${escapeHtml(item.to)}</strong>
                      <span>Restored from ${escapeHtml(item.from)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No restore operations yet</strong><span>Nothing has been restored by the local command.</span></div>`
        }
      </div>
    </section>`;
}

function renderControlCenter(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Control Center</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No control report yet</strong>
            <span>Run node scripts/run-admin-control-check.js to generate a full local safety report.</span>
          </div>
        </div>
      </section>`;
  }

  const generatedAt = new Date(report.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const summary = report.summary || {};
  const steps = Array.isArray(report.steps) ? report.steps : [];

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Control Center</h2>
        <span class="pill ${summary.status === "passed" ? "good" : "bad"}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Last run</span><strong>${escapeHtml(generatedAt)}</strong></div>
        <div class="detail-stat"><span>Passed steps</span><strong>${escapeHtml(summary.passedSteps || 0)}</strong></div>
        <div class="detail-stat"><span>Failed steps</span><strong>${escapeHtml(summary.failedSteps || 0)}</strong></div>
        <div class="detail-stat"><span>First failure</span><strong>${escapeHtml(summary.firstFailedStep || "None")}</strong></div>
      </div>
      <div class="control-steps">
        ${steps
          .map(
            (step) => `
              <div class="control-step ${step.status === "passed" ? "passed" : "failed"}">
                <strong>${escapeHtml(step.label)}</strong>
                <span>${escapeHtml(step.status)} · ${escapeHtml(step.durationMs)}ms</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminSystemOverview(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin System Overview</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No system overview yet</strong>
            <span>Run node scripts/build-admin-system-overview.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const cards = Array.isArray(report.statusCards) ? report.statusCards : [];
  const focusOrder = Array.isArray(report.focusOrder) ? report.focusOrder : [];
  const overall = summary.overallStatus || "unknown";
  const overallClass = overall === "healthy" ? "good" : overall === "blocked" ? "bad" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin System Overview</h2>
        <span class="pill ${overallClass}">${escapeHtml(overall)}</span>
      </div>
      <div class="health">
        <div class="${overall === "healthy" ? "empty" : overall === "blocked" ? "issue bad" : "issue warn"}">
          <strong>Recommended action</strong>
          <span>${escapeHtml(report.recommendedAction || "Run the full control check first.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Articles</span><strong>${escapeHtml(summary.articles || 0)}</strong></div>
        <div class="detail-stat"><span>Pages</span><strong>${escapeHtml(summary.htmlPages || 0)}</strong></div>
        <div class="detail-stat"><span>Commits ahead</span><strong>${escapeHtml(summary.commitsAhead || 0)}</strong></div>
        <div class="detail-stat"><span>SEO warnings</span><strong>${escapeHtml(summary.seoWarnings || 0)}</strong></div>
      </div>
      <div class="mini-list system-overview-list">
        ${cards
          .map(
            (card) => `
              <div class="${card.status === "blocked" || card.status === "review" ? "needs-review" : "passed"}">
                <strong>${escapeHtml(card.label)} · ${escapeHtml(card.status)}</strong>
                <span>${escapeHtml(card.detail)}</span>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${focusOrder
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Focus area</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminDashboardSnapshot(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Dashboard Snapshot</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>Today at a glance is not available yet</strong>
            <span>Run node scripts/build-admin-dashboard-snapshot.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const cards = Array.isArray(report.cards) ? report.cards : [];
  const commands = Array.isArray(report.usefulCommands) ? report.usefulCommands : [];
  const statusClassName =
    summary.status === "ready" ? "good" : summary.status === "blocked" ? "bad" : "warn";

  return `
    <section class="panel dashboard-snapshot-panel">
      <div class="panel-head">
        <h2>Admin Dashboard Snapshot</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "ready" ? "empty" : summary.status === "blocked" ? "issue bad" : "issue warn"}">
          <strong>Today at a glance</strong>
          <span>${escapeHtml(report.nextAction || "Run the full control check before the next website action.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Articles</span><strong>${escapeHtml(summary.articles || 0)}</strong></div>
        <div class="detail-stat"><span>Pages</span><strong>${escapeHtml(summary.pages || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
        <div class="detail-stat"><span>Commits ahead</span><strong>${escapeHtml(summary.commitsAhead || 0)}</strong></div>
      </div>
      <div class="mini-list dashboard-snapshot-list">
        ${cards
          .slice(0, 9)
          .map((item) => {
            const itemClass =
              item.statusClass === "blocked"
                ? "needs-review"
                : item.statusClass === "review" || item.statusClass === "unknown"
                  ? "needs-review"
                  : "passed";
            return `
              <div class="${itemClass}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.status)}</strong>
                <span>${escapeHtml(item.detail)}</span>
                <span>${escapeHtml(item.source)}</span>
              </div>`;
          })
          .join("")}
      </div>
      <div class="workflow-list">
        ${commands
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Useful command</strong>
                <span>${escapeHtml(item.label)}: ${escapeHtml(item.command)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminReportIndex(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Report Index</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No report index yet</strong>
            <span>Run node scripts/build-admin-report-index.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const items = Array.isArray(report.items) ? report.items : [];
  const statusClassName = summary.status === "passed" ? "good" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Report Index</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.review || summary.missing ? "issue warn" : "empty"}">
          <strong>Report inventory</strong>
          <span>${escapeHtml(report.nextAction || "Review generated reports before deploy.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Reports</span><strong>${escapeHtml(summary.reports || 0)}</strong></div>
        <div class="detail-stat"><span>Existing</span><strong>${escapeHtml(summary.existing || 0)}</strong></div>
        <div class="detail-stat"><span>Missing</span><strong>${escapeHtml(summary.missing || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
      </div>
      <div class="mini-list report-index-list">
        ${items
          .slice(0, 12)
          .map(
            (item) => `
              <div class="${item.exists && !["failed", "blocked", "review", "action_needed"].includes(item.status) ? "passed" : "needs-review"}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.status)}</strong>
                <span>${escapeHtml(item.path)}</span>
                <span>${escapeHtml(item.generatedAt || item.modifiedAt || "not generated")}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminReportFreshness(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Report Freshness</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No freshness report yet</strong>
            <span>Run node scripts/build-admin-report-freshness.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const freshness = Array.isArray(report.freshness) ? report.freshness : [];
  const statusClassName = summary.status === "passed" && !summary.stale ? "good" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Report Freshness</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.stale || summary.missing ? "issue warn" : "empty"}">
          <strong>Freshness check</strong>
          <span>${escapeHtml(report.nextAction || "Run the full control check to refresh reports.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Fresh</span><strong>${escapeHtml(summary.fresh || 0)}</strong></div>
        <div class="detail-stat"><span>Stale</span><strong>${escapeHtml(summary.stale || 0)}</strong></div>
        <div class="detail-stat"><span>Missing</span><strong>${escapeHtml(summary.missing || 0)}</strong></div>
        <div class="detail-stat"><span>Limit min</span><strong>${escapeHtml(summary.staleAfterMinutes || 0)}</strong></div>
      </div>
      <div class="mini-list report-freshness-list">
        ${freshness
          .filter((item) => item.freshness !== "fresh")
          .slice(0, 10)
          .map(
            (item) => `
              <div class="needs-review">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.freshness)}</strong>
                <span>${escapeHtml(item.path)}</span>
                <span>${escapeHtml(item.generatedAt || "not generated")}</span>
              </div>`
          )
          .join("") || `<div class="passed"><strong>All active reports are fresh</strong><span>No stale report detected after the latest control check.</span></div>`}
      </div>
    </section>`;
}

function renderAdminFailurePlaybook(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Failure Playbook</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No failure playbook yet</strong>
            <span>Run node scripts/build-admin-failure-playbook.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const actions = Array.isArray(report.actions) ? report.actions : [];
  const recoveryOrder = Array.isArray(report.recoveryOrder) ? report.recoveryOrder : [];
  const statusClassName = summary.status === "passed" ? "good" : summary.status === "blocked" ? "bad" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Failure Playbook</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.blocked ? "issue bad" : summary.review ? "issue warn" : "empty"}">
          <strong>Failure response</strong>
          <span>${escapeHtml(report.nextAction || "No failure response needed.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Actions</span><strong>${escapeHtml(summary.actions || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
        <div class="detail-stat"><span>First step</span><strong>${escapeHtml(summary.firstAction || "none")}</strong></div>
      </div>
      <div class="mini-list failure-playbook-list">
        ${
          actions.length
            ? actions
                .slice(0, 10)
                .map(
                  (item) => `
                    <div class="${item.status === "blocked" ? "needs-review" : "passed"}">
                      <strong>${escapeHtml(item.priority)}. ${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.status)} · ${escapeHtml(item.scope)} · ${escapeHtml(item.source)}</span>
                      <span>${escapeHtml(item.detail)}</span>
                      <span>${escapeHtml(item.command || "")}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No active failure response</strong><span>Reports do not show an urgent blocker right now.</span></div>`
        }
      </div>
      <div class="workflow-list">
        ${recoveryOrder
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Recovery order</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminDependencyMap(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Dependency Map</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No dependency map yet</strong>
            <span>Run node scripts/build-admin-dependency-map.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const nodes = Array.isArray(report.nodes) ? report.nodes : [];
  const criticalPath = Array.isArray(report.criticalPath) ? report.criticalPath : [];
  const statusClassName = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Dependency Map</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.blockers ? "issue bad" : summary.warnings ? "issue warn" : "empty"}">
          <strong>Dependency map</strong>
          <span>${escapeHtml(report.explanation || "Shows how admin reports depend on each other.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Nodes</span><strong>${escapeHtml(summary.nodes || 0)}</strong></div>
        <div class="detail-stat"><span>Depends</span><strong>${escapeHtml(summary.dependencyLinks || 0)}</strong></div>
        <div class="detail-stat"><span>Used by</span><strong>${escapeHtml(summary.usedByLinks || 0)}</strong></div>
        <div class="detail-stat"><span>Missing</span><strong>${escapeHtml(summary.missingOutputs || 0)}</strong></div>
      </div>
      <div class="mini-list dependency-map-list">
        ${nodes
          .slice(0, 10)
          .map(
            (node) => `
              <div class="${node.outputExists ? "passed" : "needs-review"}">
                <strong>${escapeHtml(node.label)} · ${escapeHtml(node.type)}</strong>
                <span>${escapeHtml(node.output)}</span>
                <span>Depends on: ${escapeHtml(node.dependsOn.join(", "))}</span>
                <span>Used by: ${escapeHtml(node.usedBy.join(", "))}</span>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        <div class="workflow-step">
          <strong>Critical path</strong>
          <span>${escapeHtml(criticalPath.join(" → "))}</span>
        </div>
      </div>
    </section>`;
}

function renderAdminReportDetailViewer(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Report Detail Viewer</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No report detail viewer yet</strong>
            <span>Run node scripts/build-admin-report-detail-viewer.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const details = Array.isArray(report.details) ? report.details : [];
  const statusClassName = summary.status === "passed" ? "good" : "bad";
  const sortedDetails = [...details].sort((a, b) => {
    const importanceRank = { high: 0, medium: 1, normal: 2 };
    return (importanceRank[a.importance] ?? 3) - (importanceRank[b.importance] ?? 3);
  });

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Report Detail Viewer</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.highImportanceReview ? "issue warn" : "empty"}">
          <strong>Report detail viewer</strong>
          <span>${escapeHtml(report.nextAction || "Use this viewer when a panel card needs more context.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Reports</span><strong>${escapeHtml(summary.reports || 0)}</strong></div>
        <div class="detail-stat"><span>High</span><strong>${escapeHtml(summary.highImportance || 0)}</strong></div>
        <div class="detail-stat"><span>High review</span><strong>${escapeHtml(summary.highImportanceReview || 0)}</strong></div>
        <div class="detail-stat"><span>Missing</span><strong>${escapeHtml(summary.missing || 0)}</strong></div>
      </div>
      <div class="mini-list report-detail-viewer-list">
        ${sortedDetails
          .slice(0, 10)
          .map(
            (item) => `
              <div class="${item.exists && !["failed", "blocked"].includes(item.status) ? "passed" : "needs-review"}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.status)} · ${escapeHtml(item.importance)}</strong>
                <span>${escapeHtml(item.path)}</span>
                <span>${escapeHtml(item.primaryDetail)}</span>
                <span>${escapeHtml(item.whyItMatters)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminCommandGuide(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Command Guide</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No command guide yet</strong>
            <span>Run node scripts/build-admin-command-guide.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const commands = Array.isArray(report.commands) ? report.commands : [];
  const rules = Array.isArray(report.rules) ? report.rules : [];

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Command Guide</h2>
        <span class="pill good">${escapeHtml(summary.status || "ready")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Commands</span><strong>${escapeHtml(summary.commands || 0)}</strong></div>
        <div class="detail-stat"><span>High impact</span><strong>${escapeHtml(summary.highImpactCommands || 0)}</strong></div>
        <div class="detail-stat"><span>Daily control</span><strong>${escapeHtml(summary.groups ? summary.groups.daily_control || 0 : 0)}</strong></div>
        <div class="detail-stat"><span>Publish safety</span><strong>${escapeHtml(summary.groups ? summary.groups.publish_safety || 0 : 0)}</strong></div>
      </div>
      <div class="mini-list command-guide-list">
        ${commands
          .map(
            (item) => `
              <div class="${item.safety === "writes_live_content" ? "needs-review" : "passed"}">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.command)}</span>
                <span>${escapeHtml(item.safety)} · ${escapeHtml(item.changesFiles)} · ${escapeHtml(item.group)}</span>
                <span>${escapeHtml(item.whenToUse)}</span>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Command safety rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminActionFlow(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Action Flow</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No action flow yet</strong>
            <span>Run node scripts/build-admin-action-flow.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const actions = Array.isArray(report.actions) ? report.actions : [];
  const rules = Array.isArray(report.rules) ? report.rules : [];
  const statusClassName = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Action Flow</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Actions</span><strong>${escapeHtml(summary.actions || 0)}</strong></div>
        <div class="detail-stat"><span>Copy</span><strong>${escapeHtml(summary.copyCommandActions || 0)}</strong></div>
        <div class="detail-stat"><span>Manual</span><strong>${escapeHtml(summary.manualConfirmActions || 0)}</strong></div>
        <div class="detail-stat"><span>High risk</span><strong>${escapeHtml(summary.highRiskActions || 0)}</strong></div>
      </div>
      <div class="mini-list action-flow-list">
        ${actions
          .map(
            (item) => `
              <div class="${item.buttonMode === "manual_confirm_required" ? "needs-review" : "passed"}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.phase)}</strong>
                <span>${escapeHtml(item.command)}</span>
                <span>${escapeHtml(item.buttonMode)} · ${escapeHtml(item.safety)}</span>
                <span>${escapeHtml(item.enabledWhen)}</span>
                <span>Next: ${escapeHtml(item.nextCheck)}</span>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Action button rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminCommandRiskMatrix(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Command Risk Matrix</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No command risk matrix yet</strong>
            <span>Run node scripts/build-admin-command-risk-matrix.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const matrix = Array.isArray(report.matrix) ? report.matrix : [];
  const rules = Array.isArray(report.rules) ? report.rules : [];
  const statusClassName = summary.status === "passed" && !summary.buttonModeMismatches ? "good" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Command Risk Matrix</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Low</span><strong>${escapeHtml(summary.lowRisk || 0)}</strong></div>
        <div class="detail-stat"><span>Medium</span><strong>${escapeHtml(summary.mediumRisk || 0)}</strong></div>
        <div class="detail-stat"><span>High</span><strong>${escapeHtml(summary.highRisk || 0)}</strong></div>
        <div class="detail-stat"><span>Critical</span><strong>${escapeHtml(summary.criticalRisk || 0)}</strong></div>
      </div>
      <div class="mini-list command-risk-matrix-list">
        ${matrix
          .map((item) => {
            const needsReview = item.riskLevel === "critical" || item.riskLevel === "high" || item.buttonModeMatches === false;
            return `
              <div class="${needsReview ? "needs-review" : "passed"}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.riskLevel)}</strong>
                <span>${escapeHtml(item.command)}</span>
                <span>${escapeHtml(item.panelMode)} · ${escapeHtml(item.safety)} · ${escapeHtml(item.changesFiles)}</span>
                <span>${escapeHtml(item.guardrail)}</span>
              </div>`;
          })
          .join("")}
      </div>
      <div class="workflow-list">
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Command risk rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderGitStatusReport(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Git Status / Push Safety</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No Git status report yet</strong>
            <span>Run node scripts/build-git-status-report.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const files = Array.isArray(report.files) ? report.files : [];
  const rules = Array.isArray(report.rules) ? report.rules : [];
  const pushSafety = summary.pushSafety || "unknown";
  const safetyClass = pushSafety === "clean" ? "good" : pushSafety === "blocked" ? "bad" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Git Status / Push Safety</h2>
        <span class="pill ${safetyClass}">${escapeHtml(pushSafety)}</span>
      </div>
      <div class="health">
        <div class="${pushSafety === "blocked" ? "issue bad" : pushSafety === "clean" ? "empty" : "issue warn"}">
          <strong>${escapeHtml(pushSafety === "clean" ? "Working tree is clean" : "Review before push")}</strong>
          <span>${escapeHtml(report.nextAction || "Review Git status before pushing.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Branch</span><strong>${escapeHtml(summary.branch || "unknown")}</strong></div>
        <div class="detail-stat"><span>Changed files</span><strong>${escapeHtml(summary.totalChangedFiles || 0)}</strong></div>
        <div class="detail-stat"><span>Staged</span><strong>${escapeHtml(summary.staged || 0)}</strong></div>
        <div class="detail-stat"><span>Untracked</span><strong>${escapeHtml(summary.untracked || 0)}</strong></div>
      </div>
      <div class="mini-list git-status-list">
        ${
          files.length
            ? files
                .slice(0, 12)
                .map(
                  (item) => `
                    <div class="${item.group === "untracked" ? "needs-review" : "passed"}">
                      <strong>${escapeHtml(item.file)}</strong>
                      <span>${escapeHtml(item.rawStatus)} · ${escapeHtml(item.group)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No changed files</strong><span>Git status has no tracked or untracked file changes.</span></div>`
        }
      </div>
      <div class="workflow-list">
        <div class="workflow-step">
          <strong>Latest commit</strong>
          <span>${escapeHtml(summary.latestCommit || "unknown")}</span>
        </div>
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Push safety rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPushPackageReport(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Push Package</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No push package report yet</strong>
            <span>Run node scripts/build-push-package-report.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const commits = Array.isArray(report.commits) ? report.commits : [];
  const rules = Array.isArray(report.rules) ? report.rules : [];
  const status = summary.status || "unknown";
  const statusClassName = status === "clean" ? "good" : status === "blocked" ? "bad" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Push Package</h2>
        <span class="pill ${statusClassName}">${escapeHtml(status)}</span>
      </div>
      <div class="health">
        <div class="${status === "blocked" ? "issue bad" : status === "clean" ? "empty" : "issue warn"}">
          <strong>${escapeHtml(status === "clean" ? "No local commits waiting" : "Review push package")}</strong>
          <span>${escapeHtml(report.nextAction || "Review local commits before pushing.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Branch</span><strong>${escapeHtml(summary.branch || "unknown")}</strong></div>
        <div class="detail-stat"><span>Upstream</span><strong>${escapeHtml(summary.upstream || "none")}</strong></div>
        <div class="detail-stat"><span>Ahead</span><strong>${escapeHtml(summary.ahead || 0)}</strong></div>
        <div class="detail-stat"><span>Behind</span><strong>${escapeHtml(summary.behind || 0)}</strong></div>
        <div class="detail-stat"><span>Listed</span><strong>${escapeHtml(summary.commits || 0)}</strong></div>
        <div class="detail-stat"><span>Complete</span><strong>${summary.commitListComplete === false ? "No" : "Yes"}</strong></div>
      </div>
      <div class="mini-list push-package-list">
        ${
          summary.commitListComplete === false
            ? `<div class="needs-review"><strong>Commit list is incomplete</strong><span>${escapeHtml(summary.missingCommitCount || 0)} commit(s) are missing from the local push package report.</span></div>`
            : ""
        }
        ${
          commits.length
            ? commits
                .slice(0, 12)
                .map(
                  (item) => `
                    <div class="needs-review">
                      <strong>${escapeHtml(item.hash)}</strong>
                      <span>${escapeHtml(item.message)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No unpushed commits</strong><span>Local branch has no commit package waiting for push.</span></div>`
        }
      </div>
      <div class="workflow-list">
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Push package rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderDeploymentReadiness(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Deployment Readiness</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No deployment readiness report yet</strong>
            <span>Run node scripts/build-deployment-readiness.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const rules = Array.isArray(report.deploymentRules) ? report.deploymentRules : [];
  const status = summary.status || "unknown";
  const statusClassName = status === "ready" ? "good" : status === "blocked" ? "bad" : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Deployment Readiness</h2>
        <span class="pill ${statusClassName}">${escapeHtml(status)}</span>
      </div>
      <div class="health">
        <div class="${status === "ready" ? "empty" : status === "blocked" ? "issue bad" : "issue warn"}">
          <strong>${escapeHtml(status === "ready" ? "Ready after final review" : "Review before deploy")}</strong>
          <span>${escapeHtml(report.nextAction || "Run the full control check before deploy.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Passed</span><strong>${escapeHtml(summary.passed || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
        <div class="detail-stat"><span>Push safety</span><strong>${escapeHtml(summary.pushSafety || "unknown")}</strong></div>
      </div>
      <div class="workflow-gates">
        ${checks
          .map(
            (item) => `
              <div class="workflow-gate ${item.status === "passed" ? "passed" : item.status === "blocked" ? "failed" : "needs-review"}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.detail)}</span>
                </div>
                <small>${escapeHtml(item.status)}</small>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        <div class="workflow-step">
          <strong>Latest deploy candidate</strong>
          <span>${escapeHtml(summary.latestCommit || "unknown")}</span>
        </div>
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Deploy safety rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderSafePushChecklist(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Safe Push Checklist</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No safe push decision yet</strong>
            <span>Run node scripts/build-safe-push-checklist.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const finalHumanReview = Array.isArray(report.finalHumanReview) ? report.finalHumanReview : [];
  const decision = summary.decision || "unknown";
  const statusClassName =
    decision === "do_not_push"
      ? "bad"
      : decision === "safe_after_human_review" || decision === "nothing_to_push"
        ? "good"
        : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Safe Push Checklist</h2>
        <span class="pill ${statusClassName}">${escapeHtml(decision)}</span>
      </div>
      <div class="health">
        <div class="${decision === "do_not_push" ? "issue bad" : decision === "review_first" ? "issue warn" : "empty"}">
          <strong>Final push decision</strong>
          <span>${escapeHtml(report.nextAction || "Review the checklist before pushing.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Checks</span><strong>${escapeHtml(summary.checks || 0)}</strong></div>
        <div class="detail-stat"><span>Passed</span><strong>${escapeHtml(summary.passed || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Commits ahead</span><strong>${escapeHtml(summary.commitsAhead || 0)}</strong></div>
        <div class="detail-stat"><span>Changed files</span><strong>${escapeHtml(summary.changedFiles || 0)}</strong></div>
        <div class="detail-stat"><span>Tracked changes</span><strong>${escapeHtml(summary.trackedChanges || 0)}</strong></div>
        <div class="detail-stat"><span>Sensitive files</span><strong>${escapeHtml(summary.sensitiveFiles || 0)}</strong></div>
      </div>
      <div class="workflow-gates">
        ${checks
          .map(
            (item) => `
              <div class="workflow-gate ${item.status === "passed" ? "passed" : item.status === "blocked" || item.status === "not_run" ? "failed" : "needs-review"}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.detail)}</span>
                  <span>${escapeHtml(item.whyItMatters)}</span>
                </div>
                <small>${escapeHtml(item.status)}</small>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${finalHumanReview
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Final human review</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderDomainSafetyPolicy(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Domain Safety Policy</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No domain safety policy yet</strong>
            <span>Run node scripts/build-domain-safety-policy.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const policy = Array.isArray(report.policy) ? report.policy : [];
  const statusClassName = summary.status === "blocked" ? "bad" : summary.status === "review" ? "warn" : "good";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Domain Safety Policy</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.policyDecision || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "review" ? "issue warn" : "empty"}">
          <strong>CNAME / domain safety</strong>
          <span>${escapeHtml(report.nextAction || "Review domain policy before push.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Domain files</span><strong>${escapeHtml(summary.domainFiles || 0)}</strong></div>
        <div class="detail-stat"><span>Staged</span><strong>${escapeHtml(summary.stagedDomainFiles || 0)}</strong></div>
        <div class="detail-stat"><span>Tracked</span><strong>${escapeHtml(summary.trackedDomainFiles || 0)}</strong></div>
        <div class="detail-stat"><span>Untracked</span><strong>${escapeHtml(summary.untrackedDomainFiles || 0)}</strong></div>
      </div>
      <div class="workflow-gates">
        ${checks
          .map(
            (item) => `
              <div class="workflow-gate ${item.status === "passed" ? "passed" : item.status === "blocked" || item.status === "not_run" ? "failed" : "needs-review"}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.detail)}</span>
                </div>
                <small>${escapeHtml(item.status)}</small>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${policy
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Domain rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPushConfirmationGuide(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Push Confirmation Guide</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No push confirmation guide yet</strong>
            <span>Run node scripts/build-push-confirmation-guide.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const checklist = Array.isArray(report.checklist) ? report.checklist : [];
  const statusClassName = summary.status === "blocked" ? "bad" : summary.status === "review" ? "warn" : "good";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Push Confirmation Guide</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.finalDecision || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "review" ? "issue warn" : "empty"}">
          <strong>Final human confirmation</strong>
          <span>${escapeHtml(report.nextAction || "Read the final confirmation before pushing.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Items</span><strong>${escapeHtml(summary.checklistItems || 0)}</strong></div>
        <div class="detail-stat"><span>Ready</span><strong>${escapeHtml(summary.ready || 0)}</strong></div>
        <div class="detail-stat"><span>Review</span><strong>${escapeHtml(summary.review || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
      </div>
      <div class="workflow-gates">
        ${checklist
          .map(
            (item) => `
              <div class="workflow-gate ${item.status === "ready" ? "passed" : item.status === "blocked" ? "failed" : "needs-review"}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.confirmation)}</span>
                  <span>${escapeHtml(item.evidence)}</span>
                </div>
                <small>${escapeHtml(item.status)}</small>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        <div class="workflow-step">
          <strong>Final confirmation text</strong>
          <span>${escapeHtml(report.finalConfirmationText || "Review every push gate before pushing.")}</span>
        </div>
      </div>
    </section>`;
}

function renderAdminOperationsManual(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Operations Manual</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No operations manual yet</strong>
            <span>Run node scripts/build-admin-operations-manual.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const workflows = Array.isArray(report.workflows) ? report.workflows : [];
  const principles = Array.isArray(report.principles) ? report.principles : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Operations Manual</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Workflows</span><strong>${escapeHtml(summary.workflows || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Push status</span><strong>${escapeHtml(summary.pushPackageStatus || "unknown")}</strong></div>
        <div class="detail-stat"><span>Deploy status</span><strong>${escapeHtml(summary.deploymentStatus || "unknown")}</strong></div>
      </div>
      <div class="mini-list operations-manual-list">
        ${workflows
          .map(
            (workflow) => `
              <div class="${workflow.risk === "very_high" || workflow.risk === "high" ? "needs-review" : "passed"}">
                <strong>${escapeHtml(workflow.title)}</strong>
                <span>${escapeHtml(workflow.risk)} risk · ${escapeHtml(workflow.purpose)}</span>
                <span>${escapeHtml(
                  (workflow.steps || [])
                    .slice(0, 3)
                    .map((step) => `${step.label}: ${step.command}`)
                    .join(" · ")
                )}</span>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${principles
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Operations principle</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderAdminQuickStart(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Admin Quick Start</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No quick start guide yet</strong>
            <span>Run node scripts/build-admin-quick-start.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const cards = Array.isArray(report.cards) ? report.cards : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Admin Quick Start</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="empty">
          <strong>Safest default</strong>
          <span>${escapeHtml(report.safestDefault || "When unsure, run the full control check first.")}</span>
        </div>
      </div>
      <div class="mini-list quick-start-list">
        ${cards
          .map(
            (card) => `
              <div class="${card.status === "blocked" ? "needs-review" : "passed"}">
                <strong>${escapeHtml(card.priority)}. ${escapeHtml(card.title)}</strong>
                <span>${escapeHtml(card.instruction)}</span>
                <span>${escapeHtml(card.command)}</span>
                <span>Done when: ${escapeHtml(card.doneWhen)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPublishReport(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Publish Result</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No publish report yet</strong>
            <span>Run node scripts/publish-article-draft.js --confirm only after all safety gates pass.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const operations = Array.isArray(report.operations) ? report.operations : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Publish Result</h2>
        <span class="pill ${status}">${escapeHtml(report.mode || "confirmed_publish")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Published</span><strong>${escapeHtml(summary.publishedDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Operations</span><strong>${escapeHtml(summary.operations || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list publish-result-list">
        ${
          operations.length
            ? operations
                .slice(0, 12)
                .map(
                  (item) => `
                    <div class="${item.type === "cleanup" ? "needs-review" : "passed"}">
                      <strong>${escapeHtml(item.type)}</strong>
                      <span>${escapeHtml(item.to || item.path || "")}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No publish operations yet</strong><span>Nothing has been published by the local command.</span></div>`
        }
      </div>
    </section>`;
}

function renderRestoreDryRun(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Restore Dry Run</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No restore dry-run yet</strong>
            <span>Run node scripts/restore-backup-snapshot-dry-run.js after creating a backup snapshot.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const plan = Array.isArray(report.restorePlan) ? report.restorePlan : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Restore Dry Run</h2>
        <span class="pill ${status}">${escapeHtml(report.mode || "dry_run")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Operations</span><strong>${escapeHtml(summary.restoreOperations || 0)}</strong></div>
        <div class="detail-stat"><span>Missing targets</span><strong>${escapeHtml(summary.missingTargets || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list restore-list">
        ${
          plan.length
            ? plan
                .slice(0, 12)
                .map(
                  (item) => `
                    <div class="passed">
                      <strong>${escapeHtml(item.to)}</strong>
                      <span>${escapeHtml(item.action)} from ${escapeHtml(item.from)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No restore operations planned</strong><span>There is no backup snapshot to restore from yet.</span></div>`
        }
      </div>
    </section>`;
}

function renderBackupSnapshot(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Backup Snapshot</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No backup snapshot dry-run yet</strong>
            <span>Run node scripts/backup-snapshot-dry-run.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const files = Array.isArray(report.files) ? report.files : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Backup Snapshot</h2>
        <span class="pill ${status}">${escapeHtml(report.mode || "dry_run")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Files</span><strong>${escapeHtml(summary.files || 0)}</strong></div>
        <div class="detail-stat"><span>Total bytes</span><strong>${escapeHtml(summary.totalBytes || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list backup-list">
        ${
          files.length
            ? files
                .slice(0, 12)
                .map(
                  (item) => `
                    <div class="passed">
                      <strong>${escapeHtml(item.path)}</strong>
                      <span>${escapeHtml(item.sizeBytes)} bytes · ${escapeHtml(item.reason)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No backup files needed</strong><span>There are no ready drafts waiting for publish.</span></div>`
        }
      </div>
    </section>`;
}

function renderBackupRestoreCenter(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Backup / Restore Center</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>Backup and restore status is not available yet</strong>
            <span>Run node scripts/build-backup-restore-center.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const backupState = report.backupState || {};
  const restoreState = report.restoreState || {};
  const safetyRules = Array.isArray(report.safetyRules) ? report.safetyRules : [];
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const blockers = Array.isArray(report.blockers) ? report.blockers : [];
  const status = summary.status === "blocked" ? "bad" : summary.status === "backup_needed" ? "warn" : "good";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Backup / Restore Center</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "backup_needed" ? "issue warn" : "empty"}">
          <strong>Backup and restore status</strong>
          <span>${escapeHtml(report.nextAction || "Review backup and restore status before publish.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Planned backup</span><strong>${escapeHtml(summary.backupFilesPlanned || 0)}</strong></div>
        <div class="detail-stat"><span>Backup copied</span><strong>${escapeHtml(summary.copiedFiles || 0)}</strong></div>
        <div class="detail-stat"><span>Restore ops</span><strong>${escapeHtml(summary.restoreOperations || 0)}</strong></div>
        <div class="detail-stat"><span>Missing targets</span><strong>${escapeHtml(summary.missingTargets || 0)}</strong></div>
      </div>
      <div class="mini-list backup-restore-center-list">
        <div class="${backupState.backupNeeded && !summary.confirmedBackupAvailable ? "needs-review" : "passed"}">
          <strong>Backup state</strong>
          <span>Dry-run: ${escapeHtml(summary.backupDryRunStatus || "missing")} · Confirmed backup: ${summary.confirmedBackupAvailable ? "yes" : "no"}</span>
          <span>${escapeHtml(backupState.confirmedBackupFolder || "No confirmed backup folder selected.")}</span>
        </div>
        <div class="${summary.restoreDryRunStatus === "passed" || summary.restoreDryRunStatus === "missing" ? "passed" : "needs-review"}">
          <strong>Restore state</strong>
          <span>Dry-run: ${escapeHtml(summary.restoreDryRunStatus || "missing")} · Confirmed restore: ${summary.restoreResultAvailable ? "yes" : "no"}</span>
          <span>${escapeHtml(restoreState.restoreDryRunReport || "Restore dry-run can be created after a backup exists.")}</span>
        </div>
        ${
          blockers.length
            ? blockers
                .slice(0, 4)
                .map(
                  (item) => `
                    <div class="needs-review">
                      <strong>${escapeHtml(item.scope || "blocker")}</strong>
                      <span>${escapeHtml(item.message)}</span>
                    </div>`
                )
                .join("")
            : ""
        }
        ${
          !blockers.length && warnings.length
            ? warnings
                .slice(0, 3)
                .map(
                  (item) => `
                    <div class="needs-review">
                      <strong>${escapeHtml(item.scope || "warning")}</strong>
                      <span>${escapeHtml(item.message)}</span>
                    </div>`
                )
                .join("")
            : ""
        }
      </div>
      <div class="workflow-list">
        ${safetyRules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Backup safety rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPublishWizard(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Publish Wizard</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>Step-by-step publish decision is not available yet</strong>
            <span>Run node scripts/build-publish-wizard.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const steps = Array.isArray(report.steps) ? report.steps : [];
  const rules = Array.isArray(report.finalSafetyRules) ? report.finalSafetyRules : [];
  const statusClassName =
    summary.status === "blocked"
      ? "bad"
      : summary.status === "ready_for_human_publish_review" || summary.status === "idle"
        ? "good"
        : "warn";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Publish Wizard</h2>
        <span class="pill ${statusClassName}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "idle" ? "empty" : "issue warn"}">
          <strong>Step-by-step publish decision</strong>
          <span>${escapeHtml(report.nextAction || "Review every publish step before confirmed publish.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Current step</span><strong>${escapeHtml(summary.currentStep || "unknown")}</strong></div>
        <div class="detail-stat"><span>Ready drafts</span><strong>${escapeHtml(summary.readyDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked drafts</span><strong>${escapeHtml(summary.blockedDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Planned ops</span><strong>${escapeHtml(summary.plannedFileOperations || 0)}</strong></div>
      </div>
      <div class="mini-list publish-wizard-list">
        ${steps
          .map((item) => {
            const itemClass = item.status === "blocked" || item.status === "not_run" ? "needs-review" : "passed";
            return `
              <div class="${itemClass}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.status)}</strong>
                <span>${escapeHtml(item.detail)}</span>
                <span>${escapeHtml(item.action)}</span>
                <span>${escapeHtml(item.source)}</span>
              </div>`;
          })
          .join("")}
      </div>
      <div class="workflow-list">
        ${rules
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Publish wizard rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPrePublishChecklist(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Pre-Publish Checklist</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No pre-publish checklist yet</strong>
            <span>Run node scripts/build-pre-publish-checklist.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const gates = Array.isArray(report.gates) ? report.gates : [];
  const humanReview = Array.isArray(report.humanReview) ? report.humanReview : [];
  const status = summary.status === "ready" || summary.status === "idle" ? "good" : summary.status === "review" ? "warn" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Pre-Publish Checklist</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "review" ? "issue warn" : "empty"}">
          <strong>${escapeHtml(summary.status === "ready" ? "Ready for final human review" : summary.status === "idle" ? "No active publish work" : "Next action")}</strong>
          <span>${escapeHtml(report.nextAction || "Run the full control check before publishing.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Passed gates</span><strong>${escapeHtml(summary.passed || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked gates</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
        <div class="detail-stat"><span>Ready drafts</span><strong>${escapeHtml(summary.readyDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Planned ops</span><strong>${escapeHtml(summary.plannedFileOperations || 0)}</strong></div>
      </div>
      <div class="workflow-gates">
        ${gates
          .map(
            (item) => `
              <div class="workflow-gate ${item.status === "passed" ? "passed" : item.status === "not_run" ? "needs-review" : "failed"}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${escapeHtml(item.detail)}</span>
                </div>
                <small>${escapeHtml(item.status)}</small>
              </div>`
          )
          .join("")}
      </div>
      <div class="workflow-list">
        ${humanReview
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Human review</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderDraftPublishSimulationSummary(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Publish Simulation</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No publish simulation yet</strong>
            <span>Run node scripts/build-draft-publish-simulation-summary.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const draftSummaries = Array.isArray(report.draftSummaries) ? report.draftSummaries : [];
  const requiredHumanChecks = Array.isArray(report.requiredHumanChecks) ? report.requiredHumanChecks : [];
  const status = summary.status === "ready" || summary.status === "idle" ? "good" : summary.status === "review" ? "warn" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Publish Simulation</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "blocked" ? "issue bad" : summary.status === "review" ? "issue warn" : "empty"}">
          <strong>Publish simulation</strong>
          <span>${escapeHtml(report.nextAction || "Review the simulated file impact before publishing.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Sim drafts</span><strong>${escapeHtml(summary.simulatedDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Ops</span><strong>${escapeHtml(summary.plannedOperations || 0)}</strong></div>
        <div class="detail-stat"><span>Discovery</span><strong>${escapeHtml(summary.discoveryUpdates || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
      </div>
      <div class="mini-list publish-simulation-list">
        ${
          draftSummaries.length
            ? draftSummaries
                .slice(0, 8)
                .map(
                  (item) => `
                    <div class="needs-review">
                      <strong>${escapeHtml(item.title || item.id)} · ${escapeHtml(item.plannedOperations || 0)} operation(s)</strong>
                      <span>Changed fields: ${escapeHtml((item.changedFields || []).join(", ") || "none")}</span>
                      <span>Public impact: ${escapeHtml((item.publicImpact || []).join(", ") || "none")}</span>
                      <span>Groups: ${escapeHtml((item.groupedOperations || []).map((group) => `${group.id} ${group.operations}`).join(" · "))}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No active publish simulation</strong><span>No ready draft is waiting to change public website files.</span></div>`
        }
      </div>
      <div class="workflow-list">
        ${requiredHumanChecks
          .slice(0, 5)
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Publish review</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPublishRollback(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Rollback Plan</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No rollback plan yet</strong>
            <span>Run node scripts/plan-publish-rollback.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const backups = Array.isArray(report.backupBeforePublish) ? report.backupBeforePublish : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Rollback Plan</h2>
        <span class="pill ${status}">${escapeHtml(report.mode || "plan_only")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Backup paths</span><strong>${escapeHtml(summary.backupPaths || 0)}</strong></div>
        <div class="detail-stat"><span>Restore paths</span><strong>${escapeHtml(summary.restorePaths || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list rollback-list">
        ${
          backups.length
            ? backups
                .map(
                  (item) => `
                    <div class="passed">
                      <strong>${escapeHtml(item.path)}</strong>
                      <span>${escapeHtml(item.reason)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No backup paths needed</strong><span>There are no ready drafts waiting for publish.</span></div>`
        }
      </div>
    </section>`;
}

function renderPublishDryRun(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Publish Dry Run</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No dry-run report yet</strong>
            <span>Run node scripts/publish-article-draft-dry-run.js --dry-run or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const plan = Array.isArray(report.plan) ? report.plan : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Publish Dry Run</h2>
        <span class="pill ${status}">${escapeHtml(report.mode || "dry_run")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Ready drafts</span><strong>${escapeHtml(summary.readyDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Operations</span><strong>${escapeHtml(summary.plannedFileOperations || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list dry-run-list">
        ${
          plan.length
            ? plan
                .map(
                  (item) => `
                    <div class="passed">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.wouldUpdate.length)} updates · ${escapeHtml(item.wouldRemoveAfterPublish.length)} cleanup steps</span>
                      <span>${escapeHtml(item.changedFields.join(", ") || "no changed fields")}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No publish operations planned</strong><span>Dry-run made no changes.</span></div>`
        }
      </div>
    </section>`;
}

function renderPublishReadiness(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Publish Readiness</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No readiness report yet</strong>
            <span>Run node scripts/check-publish-readiness.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const items = Array.isArray(report.items) ? report.items : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Publish Readiness</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Drafts</span><strong>${escapeHtml(summary.drafts || 0)}</strong></div>
        <div class="detail-stat"><span>Ready</span><strong>${escapeHtml(summary.readyDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blockedDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
      </div>
      <div class="mini-list readiness-list">
        ${
          items.length
            ? items
                .map(
                  (item) => `
                    <div class="${item.status === "ready" ? "passed" : "needs-review"}">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.status)} · ${escapeHtml(item.changeCount)} changes</span>
                      ${
                        item.blockers.length
                          ? `<span>Blockers: ${escapeHtml(item.blockers.join(" · "))}</span>`
                          : `<span>Preview and comparison checks are ready.</span>`
                      }
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No active drafts</strong><span>There is nothing waiting for publish.</span></div>`
        }
      </div>
    </section>`;
}

function renderDraftComparison(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Comparison</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No comparison report yet</strong>
            <span>Run node scripts/compare-article-drafts.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const comparisons = Array.isArray(report.comparisons) ? report.comparisons : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Comparison</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Drafts</span><strong>${escapeHtml(summary.drafts || 0)}</strong></div>
        <div class="detail-stat"><span>Changed</span><strong>${escapeHtml(summary.changedDrafts || 0)}</strong></div>
        <div class="detail-stat"><span>Total changes</span><strong>${escapeHtml(summary.totalChanges || 0)}</strong></div>
        <div class="detail-stat"><span>Critical</span><strong>${escapeHtml(summary.critical || 0)}</strong></div>
      </div>
      <div class="mini-list draft-comparison-list">
        ${
          comparisons.length
            ? comparisons
                .map(
                  (item) => `
                    <div class="${item.criticalChangeCount > 0 ? "needs-review" : "passed"}">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.changeCount)} changes · ${escapeHtml(item.changedFields.join(", ") || "no changed fields")}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No active drafts</strong><span>There is nothing to compare yet.</span></div>`
        }
      </div>
    </section>`;
}

function renderDraftQuality(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Quality</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No draft quality report yet</strong>
            <span>Run node scripts/audit-draft-quality.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const items = Array.isArray(report.items) ? report.items : [];
  const status = summary.status === "passed" ? "good" : summary.status === "review" ? "warn" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Quality</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Drafts</span><strong>${escapeHtml(summary.drafts || 0)}</strong></div>
        <div class="detail-stat"><span>Ready</span><strong>${escapeHtml(summary.ready || 0)}</strong></div>
        <div class="detail-stat"><span>Blocked</span><strong>${escapeHtml(summary.blocked || 0)}</strong></div>
        <div class="detail-stat"><span>Fixes</span><strong>${escapeHtml((summary.totalBlockers || 0) + (summary.totalWarnings || 0))}</strong></div>
      </div>
      <div class="mini-list draft-quality-list">
        ${
          items.length
            ? items
                .map(
                  (item) => `
                    <div class="${item.status === "ready" ? "passed" : "needs-review"}">
                      <strong>${escapeHtml(item.title || item.id)}</strong>
                      <span>${escapeHtml(item.status)} · score ${escapeHtml(item.score || 0)} · ${escapeHtml(item.kind || "draft")}</span>
                      ${
                        item.fixes && item.fixes.length
                          ? `<span>${escapeHtml(item.fixes.slice(0, 3).map((fix) => fix.fix).join(" · "))}</span>`
                          : `<span>No draft fixes needed.</span>`
                      }
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No active drafts</strong><span>There is no draft content waiting for quality review.</span></div>`
        }
      </div>
    </section>`;
}

function renderDraftFixList(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Fix List</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No draft fix list yet</strong>
            <span>Run node scripts/build-draft-fix-list.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const fixes = Array.isArray(report.fixes) ? report.fixes : [];
  const status = summary.status === "passed" ? "good" : summary.status === "action_needed" ? "warn" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Fix List</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${fixes.length ? "issue warn" : "empty"}">
          <strong>${escapeHtml(fixes.length ? "Next action" : "No draft fixes needed")}</strong>
          <span>${escapeHtml(report.nextAction || "No draft fixes are needed right now.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Fixes</span><strong>${escapeHtml(summary.fixes || 0)}</strong></div>
        <div class="detail-stat"><span>Blockers</span><strong>${escapeHtml(summary.blockers || 0)}</strong></div>
        <div class="detail-stat"><span>Warnings</span><strong>${escapeHtml(summary.warnings || 0)}</strong></div>
        <div class="detail-stat"><span>Drafts</span><strong>${escapeHtml(summary.drafts || 0)}</strong></div>
      </div>
      <div class="mini-list draft-fix-list">
        ${
          fixes.length
            ? fixes
                .slice(0, 10)
                .map(
                  (item) => `
                    <div class="${item.severity === "blocker" ? "needs-review" : "passed"}">
                      <strong>${escapeHtml(item.draftTitle)} · ${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(item.severity)} · ${escapeHtml(item.where || item.draftPath || "")}</span>
                      <span>${escapeHtml(item.howToFix || item.fix)}</span>
                      <span>Done when: ${escapeHtml(item.doneWhen || "Run the full control check and confirm this fix disappears.")}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No active fixes</strong><span>Drafts are either absent or already clean.</span></div>`
        }
      </div>
    </section>`;
}

function renderDraftEditPlan(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Edit Plan</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No draft edit plan yet</strong>
            <span>Run node scripts/build-draft-edit-plan.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const plans = Array.isArray(report.plans) ? report.plans : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Edit Plan</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="empty">Editable fields can be changed inside a draft. Controlled fields need review. Generated and locked fields should not be typed manually.</div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Drafts</span><strong>${escapeHtml(summary.drafts || 0)}</strong></div>
        <div class="detail-stat"><span>Editable fields</span><strong>${escapeHtml(summary.editableFields || 0)}</strong></div>
        <div class="detail-stat"><span>Controlled fields</span><strong>${escapeHtml(summary.controlledFields || 0)}</strong></div>
        <div class="detail-stat"><span>Locked fields</span><strong>${escapeHtml(summary.lockedFields || 0)}</strong></div>
      </div>
      <div class="mini-list draft-edit-plan-list">
        ${
          plans.length
            ? plans
                .slice(0, 6)
                .map((plan) => {
                  const fields = Array.isArray(plan.fields) ? plan.fields : [];
                  const previewFields = fields
                    .filter((field) => field.mode === "editable" || field.mode === "controlled" || field.publishRisk === "high")
                    .slice(0, 6);
                  return `
                    <div class="passed">
                      <strong>${escapeHtml(plan.title || plan.id)} · ${escapeHtml(plan.kind || "draft")}</strong>
                      <span>${escapeHtml(plan.draft || "")}</span>
                      <span>Editable ${escapeHtml(plan.summary ? plan.summary.editable : 0)} · Controlled ${escapeHtml(plan.summary ? plan.summary.controlled : 0)} · Locked ${escapeHtml(plan.summary ? plan.summary.locked : 0)}</span>
                      ${
                        previewFields.length
                          ? `<span>${escapeHtml(
                              previewFields
                                .map((field) => `${field.label}: ${field.action}`)
                                .join(" · ")
                            )}</span>`
                          : `<span>No editable or controlled fields found for this draft.</span>`
                      }
                    </div>`;
                })
                .join("")
            : `<div class="passed"><strong>No active draft edit plan</strong><span>There are no draft files waiting to be edited.</span></div>`
        }
      </div>
    </section>`;
}

function renderDraftEditGuide(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Edit Guide</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No draft edit guide yet</strong>
            <span>Run node scripts/build-draft-edit-guide.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const steps = Array.isArray(report.steps) ? report.steps : [];
  const workflow = Array.isArray(report.workflow) ? report.workflow : [];
  const status = summary.status === "passed" ? "good" : summary.status === "action_needed" ? "warn" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Edit Guide</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Draft fixes</span><strong>${escapeHtml(summary.draftFixes || 0)}</strong></div>
        <div class="detail-stat"><span>High-risk steps</span><strong>${escapeHtml(summary.highRiskSteps || 0)}</strong></div>
        <div class="detail-stat"><span>Controlled steps</span><strong>${escapeHtml(summary.controlledSteps || 0)}</strong></div>
        <div class="detail-stat"><span>Locked steps</span><strong>${escapeHtml(summary.lockedSteps || 0)}</strong></div>
      </div>
      <div class="mini-list draft-edit-guide-list">
        ${
          steps.length
            ? steps
                .slice(0, 8)
                .map(
                  (step) => `
                    <div class="${step.publishRisk === "high" || step.editMode === "locked" ? "needs-review" : "passed"}">
                      <strong>${escapeHtml(step.order)}. ${escapeHtml(step.draftTitle)} · ${escapeHtml(step.fieldLabel)}</strong>
                      <span>${escapeHtml(step.severity)} · ${escapeHtml(step.editMode)} · ${escapeHtml(step.publishRisk)} risk</span>
                      <span>${escapeHtml(step.instruction)}</span>
                      <span>Done when: ${escapeHtml(step.doneWhen)}</span>
                    </div>`
                )
                .join("")
            : `<div class="passed"><strong>No guided edits needed</strong><span>There are no active draft fixes waiting for manual editing.</span></div>`
        }
      </div>
      <div class="workflow-list">
        ${workflow
          .map(
            (item, index) => `
              <div class="workflow-step">
                <strong>${index + 1}. Safe editing rule</strong>
                <span>${escapeHtml(item)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderDraftPatchApplyGuide(report) {
  if (!report) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Draft Patch Apply Guide</h2>
          <span class="pill warn">not run</span>
        </div>
        <div class="health">
          <div class="issue warn">
            <strong>No patch apply guide yet</strong>
            <span>Run node scripts/build-draft-patch-apply-guide.js or the full control check.</span>
          </div>
        </div>
      </section>`;
  }

  const summary = report.summary || {};
  const contract = report.patchContract || {};
  const steps = Array.isArray(report.applySteps) ? report.applySteps : [];
  const redFlags = Array.isArray(report.redFlags) ? report.redFlags : [];
  const fieldRules = Array.isArray(report.fieldRules) ? report.fieldRules : [];
  const status = summary.status === "passed" ? "good" : "bad";

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Patch Apply Guide</h2>
        <span class="pill ${status}">${escapeHtml(summary.status || "unknown")}</span>
      </div>
      <div class="health">
        <div class="${summary.status === "passed" ? "empty" : "issue bad"}">
          <strong>Patch contract</strong>
          <span>${escapeHtml(contract.rule || "Browser patch output must target draft files only.")}</span>
        </div>
      </div>
      <div class="control-summary">
        <div class="detail-stat"><span>Patch mode</span><strong>${escapeHtml(summary.patchMode || "unknown")}</strong></div>
        <div class="detail-stat"><span>Editable</span><strong>${escapeHtml(summary.editableFields || 0)}</strong></div>
        <div class="detail-stat"><span>Controlled</span><strong>${escapeHtml(summary.controlledFields || 0)}</strong></div>
        <div class="detail-stat"><span>High risk</span><strong>${escapeHtml(summary.highRiskFields || 0)}</strong></div>
      </div>
      <div class="workflow-list">
        ${steps
          .map(
            (item) => `
              <div class="workflow-step">
                <strong>${escapeHtml(item.order)}. ${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.detail)}</span>
              </div>`
          )
          .join("")}
      </div>
      <div class="mini-list">
        <div class="needs-review">
          <strong>Red flags</strong>
          <span>${escapeHtml(redFlags.join(" · "))}</span>
        </div>
        ${fieldRules
          .filter((item) => item.mode !== "editable" || item.publishRisk === "high")
          .slice(0, 8)
          .map(
            (item) => `
              <div class="${item.publishRisk === "high" ? "needs-review" : "passed"}">
                <strong>${escapeHtml(item.label)} · ${escapeHtml(item.mode)} · ${escapeHtml(item.publishRisk)}</strong>
                <span>${escapeHtml(item.patchRule)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPublishWorkflow() {
  const steps = [
    ["Create Draft", "Published content is copied into a private draft file."],
    ["Edit Draft", "The founder edits the draft, not the public article."],
    ["Preview", "The draft is rendered locally before it can become public."],
    ["Control Check", "The full audit chain must pass before publishing."],
    ["Publish", "Only then can generated files, sitemap, llms.txt and Git commit be created."],
  ];

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Draft Publish Workflow</h2>
        <span class="pill good">approved</span>
      </div>
      <div class="workflow-list">
        ${steps
          .map(
            ([title, text], index) => `
              <div class="workflow-step">
                <strong>${index + 1}. ${escapeHtml(title)}</strong>
                <span>${escapeHtml(text)}</span>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderNewArticleWorkflow(categories) {
  const defaultCategory = categories.find((category) => category.id === "open-when-letters") || categories[0];
  const categoryId = defaultCategory ? defaultCategory.id : "open-when-letters";
  const command = `node scripts/create-new-article-draft.js new-article-slug --category ${categoryId} --title "New Article Title" --confirm`;

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>New Article Draft</h2>
        <span class="pill good">draft-only</span>
      </div>
      <div class="health">
        <div class="empty">New articles start as private drafts. They do not become public until preview, comparison, readiness, backup, and publish checks pass.</div>
      </div>
      <div class="workflow-list">
        <div class="workflow-step">
          <strong>1. Create a private draft</strong>
          <span>${escapeHtml(command)}</span>
        </div>
        <div class="workflow-step">
          <strong>2. Replace placeholders</strong>
          <span>Edit title, description, body, FAQ, related links, keywords, and CTA inside the draft JSON.</span>
        </div>
        <div class="workflow-step">
          <strong>3. Mark ready only after review</strong>
          <span>Set draftPublishIntent to ready only when the article is complete and should enter the publish chain.</span>
        </div>
      </div>
    </section>`;
}

function renderEditorRules(rules) {
  if (!rules || !Array.isArray(rules.fields)) return "";

  const counts = rules.fields.reduce((summary, field) => {
    summary[field.mode] = (summary[field.mode] || 0) + 1;
    return summary;
  }, {});

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Editor Rules</h2>
        <span class="pill good">draft-safe</span>
      </div>
      <div class="rule-summary">
        <div class="detail-stat"><span>Editable</span><strong>${escapeHtml(counts.editable || 0)}</strong></div>
        <div class="detail-stat"><span>Controlled</span><strong>${escapeHtml(counts.controlled || 0)}</strong></div>
        <div class="detail-stat"><span>Generated</span><strong>${escapeHtml(counts.generated || 0)}</strong></div>
        <div class="detail-stat"><span>Locked</span><strong>${escapeHtml(counts.locked || 0)}</strong></div>
      </div>
      <div class="rule-list">
        ${rules.fields
          .map(
            (field) => `
              <div class="rule-item risk-${escapeHtml(field.publishRisk)}">
                <strong>${escapeHtml(field.label)}</strong>
                <span class="field-mode ${escapeHtml(field.mode)}">${escapeHtml(field.mode)}</span>
                <p>${escapeHtml(field.why)}</p>
                <small>Publish risk: ${escapeHtml(field.publishRisk)}</small>
              </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function renderPanelGroup(title, description, body) {
  const sectionIds = {
    System: "system-section",
    Reports: "reports-section",
    Guides: "guides-section",
    "Git / Deploy": "git-deploy-section",
    "Publish Safety": "publish-section",
    Drafts: "drafts-section",
  };
  const sectionId = sectionIds[title] ? ` id="${escapeHtml(sectionIds[title])}"` : "";

  return `
    <section${sectionId} class="panel-group admin-anchor" aria-label="${escapeHtml(title)}">
      <div class="group-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(description)}</span>
      </div>
      <div class="group-stack">
        ${body}
      </div>
    </section>`;
}

function renderAdminNavigation() {
  const items = [
    ["Founder Center", "#founder-center", "Start here"],
    ["System", "#system-section", "Health and status"],
    ["Reports", "#reports-section", "Inventory and freshness"],
    ["Guides", "#guides-section", "Safe operating rules"],
    ["Git / Deploy", "#git-deploy-section", "Push and domain checks"],
    ["Publish", "#publish-section", "Dry-run and backup"],
    ["Drafts", "#drafts-section", "Draft workflow"],
    ["Content", "#content-section", "Articles and pages"],
  ];

  return `
    <nav class="admin-nav" aria-label="Admin Navigation">
      <div class="admin-nav-head">
        <span class="home-eyebrow">Admin Navigation</span>
        <strong>Jump to the area you need</strong>
      </div>
      <div class="admin-nav-links">
        ${items
          .map(
            ([label, href, hint]) => `
              <a href="${escapeHtml(href)}">
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(hint)}</span>
              </a>`
          )
          .join("")}
      </div>
    </nav>`;
}

function render(model) {
  const generated = new Date(model.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const articleJson = JSON.stringify(model.articles).replaceAll("</", "<\\/");
  const editorRulesJson = JSON.stringify(model.editorRules.article || {}).replaceAll("</", "<\\/");
  const controlReport = readControlReport();
  const adminReportIndex = readAdminReportIndex();
  const adminReportFreshness = readAdminReportFreshness();
  const adminFailurePlaybook = readAdminFailurePlaybook();
  const adminDependencyMap = readAdminDependencyMap();
  const adminReportDetailViewer = readAdminReportDetailViewer();
  const adminSystemOverview = readAdminSystemOverview();
  const founderDecisionCenter = readFounderDecisionCenter();
  const adminHomeBrief = readAdminHomeBrief();
  const adminWorkQueue = readAdminWorkQueue();
  const adminDashboardSnapshot = readAdminDashboardSnapshot();
  const adminCommandGuide = readAdminCommandGuide();
  const adminActionFlow = readAdminActionFlow();
  const adminCommandRiskMatrix = readAdminCommandRiskMatrix();
  const gitStatusReport = readGitStatusReport();
  const pushPackageReport = readPushPackageReport();
  const deploymentReadiness = readDeploymentReadiness();
  const safePushChecklist = readSafePushChecklist();
  const domainSafetyPolicy = readDomainSafetyPolicy();
  const pushConfirmationGuide = readPushConfirmationGuide();
  const adminOperationsManual = readAdminOperationsManual();
  const adminQuickStart = readAdminQuickStart();
  const draftComparisonReport = readDraftComparisonReport();
  const draftQualityReport = readDraftQualityReport();
  const draftFixListReport = readDraftFixListReport();
  const draftEditPlanReport = readDraftEditPlanReport();
  const draftEditGuideReport = readDraftEditGuideReport();
  const draftPatchApplyGuideReport = readDraftPatchApplyGuideReport();
  const publishReadinessReport = readPublishReadinessReport();
  const publishDryRunReport = readPublishDryRunReport();
  const publishRollbackPlan = readPublishRollbackPlan();
  const backupSnapshotReport = readBackupSnapshotReport();
  const prePublishChecklist = readPrePublishChecklist();
  const draftPublishSimulationSummary = readDraftPublishSimulationSummary();
  const backupRestoreCenter = readBackupRestoreCenter();
  const publishWizard = readPublishWizard();
  const restoreDryRunReport = readRestoreDryRunReport();
  const restoreReport = readRestoreReport();
  const publishReport = readPublishReport();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PersonalCapsule Admin Preview</title>
  <style>
    :root {
      --ink: #0b0907;
      --panel: #14110d;
      --panel-2: #1b1711;
      --line: rgba(216, 178, 90, .22);
      --gold: #d8b25a;
      --cream: #f4ead6;
      --muted: rgba(244, 234, 214, .64);
      --faint: rgba(244, 234, 214, .42);
      --good: #86c98a;
      --warn: #f0cf7a;
      --bad: #e58ba0;
      --blue: #7fb0e6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top left, rgba(216,178,90,.13), transparent 36%), var(--ink);
      color: var(--cream);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    a { color: inherit; }
    .shell { max-width: 1360px; margin: 0 auto; padding: 28px; }
    header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 24px;
      padding: 24px;
      border: 1px solid var(--line);
      background: linear-gradient(145deg, rgba(255,247,230,.055), rgba(255,247,230,.02));
      border-radius: 18px;
    }
    .brandline { color: var(--gold); font-size: 12px; text-transform: uppercase; letter-spacing: .18em; font-weight: 700; }
    h1 { margin: 8px 0 8px; font-size: clamp(30px, 4vw, 52px); line-height: 1; letter-spacing: -.03em; }
    .lead { margin: 0; color: var(--muted); max-width: 720px; font-size: 17px; }
    .syncbox {
      min-width: 260px;
      border: 1px solid rgba(255,247,230,.12);
      background: rgba(0,0,0,.16);
      border-radius: 14px;
      padding: 16px;
      color: var(--muted);
      font-size: 14px;
    }
    .syncbox strong { display: block; color: var(--cream); margin-top: 4px; }
    .grid { display: grid; gap: 16px; }
    .metrics { grid-template-columns: repeat(6, minmax(0, 1fr)); margin-bottom: 16px; }
    .metric {
      border: 1px solid var(--line);
      background: rgba(255,247,230,.04);
      border-radius: 14px;
      padding: 16px;
      min-height: 116px;
    }
    .metric span, .metric small { display: block; color: var(--muted); font-size: 13px; }
    .metric strong { display: block; font-size: 32px; line-height: 1.1; margin: 10px 0; }
    .admin-anchor { scroll-margin-top: 18px; }
    .admin-nav {
      display: grid;
      grid-template-columns: 230px minmax(0, 1fr);
      gap: 12px;
      align-items: stretch;
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid rgba(216,178,90,.2);
      border-radius: 18px;
      background: rgba(0,0,0,.14);
    }
    .admin-nav-head {
      display: grid;
      align-content: center;
      gap: 4px;
      padding: 10px;
    }
    .admin-nav-head strong {
      color: var(--cream);
      font-size: 15px;
      line-height: 1.25;
    }
    .admin-nav-links {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .admin-nav a {
      display: grid;
      gap: 3px;
      min-height: 62px;
      padding: 10px 11px;
      border: 1px solid rgba(255,247,230,.1);
      border-radius: 12px;
      background: rgba(255,247,230,.045);
      text-decoration: none;
    }
    .admin-nav a:hover {
      border-color: rgba(216,178,90,.42);
      background: rgba(216,178,90,.08);
    }
    .admin-nav a strong {
      color: var(--gold);
      font-size: 13px;
      line-height: 1.2;
    }
    .admin-nav a span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }
    .founder-center {
      display: grid;
      grid-template-columns: minmax(320px, .76fr) minmax(0, 1.24fr);
      gap: 16px;
      margin-bottom: 16px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background:
        radial-gradient(circle at top right, rgba(216,178,90,.12), transparent 38%),
        linear-gradient(145deg, rgba(255,247,230,.085), rgba(0,0,0,.18));
    }
    .founder-center-safe { border-color: rgba(134,201,138,.34); }
    .founder-center-review { border-color: rgba(240,207,122,.38); }
    .founder-center-blocked { border-color: rgba(229,139,160,.42); }
    .founder-center-main {
      display: grid;
      align-content: start;
      gap: 10px;
      padding: 4px;
    }
    .founder-center-main h2 {
      font-size: clamp(28px, 3.4vw, 46px);
      line-height: .98;
      margin: 0;
      letter-spacing: -.04em;
    }
    .founder-center-main strong {
      color: var(--cream);
      font-size: 18px;
      line-height: 1.25;
    }
    .founder-center-main p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    .founder-decision-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 9px;
    }
    .founder-decision {
      display: grid;
      align-content: start;
      gap: 5px;
      min-height: 154px;
      padding: 12px;
      border: 1px solid rgba(255,247,230,.1);
      border-radius: 13px;
      background: rgba(0,0,0,.15);
    }
    .founder-decision span {
      color: var(--faint);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .founder-decision strong {
      font-size: 16px;
      line-height: 1.18;
    }
    .founder-decision small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.34;
    }
    .founder-decision em {
      color: var(--faint);
      font-size: 10px;
      line-height: 1.25;
      font-style: normal;
      overflow-wrap: anywhere;
    }
    .founder-decision.decision-safe { border-color: rgba(134,201,138,.24); }
    .founder-decision.decision-safe strong { color: var(--good); }
    .founder-decision.decision-review { border-color: rgba(240,207,122,.34); }
    .founder-decision.decision-review strong { color: var(--warn); }
    .founder-decision.decision-blocked { border-color: rgba(229,139,160,.38); }
    .founder-decision.decision-blocked strong { color: var(--bad); }
    .founder-next-steps {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .home-brief {
      display: grid;
      grid-template-columns: minmax(280px, .85fr) minmax(0, 1.15fr);
      gap: 16px;
      margin-bottom: 16px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(145deg, rgba(255,247,230,.07), rgba(0,0,0,.14));
    }
    .home-brief-safe { border-color: rgba(134,201,138,.32); }
    .home-brief-review { border-color: rgba(240,207,122,.34); }
    .home-brief-blocked { border-color: rgba(229,139,160,.38); }
    .home-brief-main {
      display: grid;
      align-content: start;
      gap: 9px;
      padding: 4px;
    }
    .home-eyebrow {
      color: var(--gold);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .home-brief-main h2 {
      font-size: clamp(24px, 3vw, 38px);
      line-height: 1;
      margin: 0;
      letter-spacing: -.03em;
    }
    .home-brief-main strong {
      color: var(--cream);
      font-size: 17px;
      line-height: 1.25;
    }
    .home-brief-main p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    .home-action {
      display: grid;
      gap: 4px;
      margin-top: 6px;
      padding: 12px;
      border: 1px solid rgba(216,178,90,.22);
      border-radius: 13px;
      background: rgba(0,0,0,.14);
    }
    .home-action span {
      color: var(--faint);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .home-action b {
      color: var(--gold);
      font-size: 14px;
      line-height: 1.35;
    }
    .home-decision-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .home-decision {
      display: grid;
      gap: 5px;
      min-height: 118px;
      padding: 12px;
      border: 1px solid rgba(255,247,230,.1);
      border-radius: 13px;
      background: rgba(0,0,0,.14);
    }
    .home-decision span {
      color: var(--faint);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .home-decision strong {
      font-size: 17px;
      line-height: 1.2;
    }
    .home-decision small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .home-decision.decision-safe { border-color: rgba(134,201,138,.23); }
    .home-decision.decision-safe strong { color: var(--good); }
    .home-decision.decision-review { border-color: rgba(240,207,122,.32); }
    .home-decision.decision-review strong { color: var(--warn); }
    .home-decision.decision-blocked { border-color: rgba(229,139,160,.36); }
    .home-decision.decision-blocked strong { color: var(--bad); }
    .home-rules {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .home-rules span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      border: 1px solid rgba(255,247,230,.08);
      border-radius: 11px;
      background: rgba(0,0,0,.1);
      padding: 10px;
    }
    .layout { display: grid; grid-template-columns: 310px minmax(0, 1fr); gap: 16px; align-items: start; }
    .panel {
      border: 1px solid var(--line);
      background: rgba(255,247,230,.04);
      border-radius: 16px;
      overflow: hidden;
    }
    .panel-group {
      display: grid;
      gap: 10px;
      padding: 10px;
      border: 1px solid rgba(216,178,90,.14);
      background: rgba(0,0,0,.1);
      border-radius: 18px;
    }
    .group-head {
      display: grid;
      gap: 3px;
      padding: 4px 4px 0;
    }
    .group-head strong {
      color: var(--gold);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .12em;
      line-height: 1.2;
    }
    .group-head span {
      color: var(--faint);
      font-size: 12px;
      line-height: 1.35;
    }
    .group-stack {
      display: grid;
      gap: 10px;
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid rgba(216,178,90,.15);
      background: rgba(0,0,0,.12);
    }
    h2 { margin: 0; font-size: 17px; letter-spacing: -.01em; }
    .panel-head small { color: var(--faint); }
    .stack { display: grid; gap: 16px; }
    .health { padding: 18px; display: grid; gap: 10px; }
    .empty {
      border: 1px solid rgba(134,201,138,.28);
      background: rgba(134,201,138,.08);
      color: var(--good);
      border-radius: 12px;
      padding: 14px;
      font-size: 14px;
    }
    .issue {
      display: grid;
      gap: 4px;
      border-radius: 12px;
      padding: 12px;
      font-size: 14px;
      border: 1px solid rgba(255,247,230,.12);
    }
    .issue.bad { color: var(--bad); border-color: rgba(229,139,160,.34); }
    .issue.warn { color: var(--warn); border-color: rgba(240,207,122,.34); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 13px 14px; text-align: left; border-bottom: 1px solid rgba(255,247,230,.08); vertical-align: top; }
    th { color: var(--faint); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; background: rgba(0,0,0,.1); }
    td strong { display: block; font-weight: 650; }
    td small { display: block; color: var(--faint); margin-top: 3px; }
    .table-wrap { overflow-x: auto; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid rgba(255,247,230,.14);
      background: rgba(255,247,230,.04);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      white-space: nowrap;
    }
    .pill.good { color: var(--good); border-color: rgba(134,201,138,.3); background: rgba(134,201,138,.08); }
    .pill.warn { color: var(--warn); border-color: rgba(240,207,122,.3); background: rgba(240,207,122,.08); }
    .pill.bad { color: var(--bad); border-color: rgba(229,139,160,.3); background: rgba(229,139,160,.08); }
    .side-list { padding: 10px; display: grid; gap: 8px; }
    .side-item {
      display: grid;
      gap: 3px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(0,0,0,.12);
      border: 1px solid rgba(255,247,230,.08);
    }
    .side-item strong { font-size: 14px; }
    .side-item span { color: var(--muted); font-size: 13px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .tools {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) 220px 160px 150px auto;
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid rgba(216,178,90,.15);
      background: rgba(0,0,0,.08);
    }
    .field {
      display: grid;
      gap: 5px;
    }
    .field span {
      color: var(--faint);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .field small {
      color: var(--faint);
      font-size: 11px;
      line-height: 1.35;
    }
    .field-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .field-mode {
      border: 1px solid rgba(255,247,230,.12);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
      line-height: 1.4;
      color: var(--muted);
      background: rgba(255,247,230,.04);
      text-transform: uppercase;
      letter-spacing: .04em;
      white-space: nowrap;
    }
    .field-mode.editable { color: var(--gold); border-color: rgba(216,178,90,.28); background: rgba(216,178,90,.07); }
    .field-mode.generated { color: var(--blue); border-color: rgba(127,176,230,.28); background: rgba(127,176,230,.07); }
    .field-mode.controlled { color: var(--warn); border-color: rgba(240,207,122,.28); background: rgba(240,207,122,.07); }
    .field-mode.locked { color: var(--bad); border-color: rgba(229,139,160,.28); background: rgba(229,139,160,.07); }
    .field-mode.readonly { color: var(--faint); }
    input, select {
      width: 100%;
      min-height: 42px;
      border: 1px solid rgba(255,247,230,.13);
      border-radius: 11px;
      background: rgba(0,0,0,.18);
      color: var(--cream);
      padding: 0 12px;
      font: inherit;
      outline: none;
    }
    textarea {
      width: 100%;
      min-height: 92px;
      border: 1px solid rgba(255,247,230,.13);
      border-radius: 11px;
      background: rgba(0,0,0,.18);
      color: var(--cream);
      padding: 12px;
      font: inherit;
      resize: vertical;
      outline: none;
    }
    input[readonly], textarea[readonly], select:disabled {
      color: var(--muted);
      cursor: default;
    }
    input:focus, select:focus { border-color: rgba(216,178,90,.55); box-shadow: 0 0 0 3px rgba(216,178,90,.1); }
    .mini-btn {
      min-height: 34px;
      border: 1px solid rgba(216,178,90,.28);
      border-radius: 10px;
      background: rgba(216,178,90,.08);
      color: var(--gold);
      padding: 0 11px;
      font-weight: 700;
      cursor: pointer;
    }
    .mini-btn:hover { border-color: rgba(216,178,90,.55); background: rgba(216,178,90,.13); }
    .result-count {
      align-self: end;
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      background: rgba(255,247,230,.045);
      color: var(--muted);
      font-size: 13px;
      border: 1px solid rgba(255,247,230,.09);
      white-space: nowrap;
    }
    .detail-card {
      padding: 18px;
      display: grid;
      gap: 14px;
    }
    .detail-card h3 {
      margin: 0;
      font-size: 20px;
      line-height: 1.15;
    }
    .detail-card p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .control-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid rgba(216,178,90,.15);
    }
    .control-steps {
      display: grid;
      gap: 8px;
      padding: 14px;
    }
    .control-step {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.12);
      border-radius: 11px;
      padding: 10px;
      font-size: 13px;
    }
    .control-step span { color: var(--muted); white-space: nowrap; }
    .control-step.passed { border-color: rgba(134,201,138,.2); }
    .control-step.failed { border-color: rgba(229,139,160,.32); }
    .control-step.failed strong { color: var(--bad); }
    .workflow-status-hero {
      display: grid;
      gap: 6px;
      margin: 14px;
      padding: 14px;
      border-radius: 13px;
      border: 1px solid rgba(255,247,230,.1);
      background: rgba(0,0,0,.14);
    }
    .workflow-status-hero strong {
      font-size: 18px;
      line-height: 1.2;
    }
    .workflow-status-hero p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    .workflow-status-hero.passed,
    .workflow-status-hero.idle {
      border-color: rgba(134,201,138,.22);
      background: rgba(134,201,138,.07);
    }
    .workflow-status-hero.needs-review {
      border-color: rgba(240,207,122,.3);
      background: rgba(240,207,122,.07);
    }
    .workflow-status-hero.failed {
      border-color: rgba(229,139,160,.32);
      background: rgba(229,139,160,.07);
    }
    .workflow-status-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 0 14px 14px;
      border-bottom: 1px solid rgba(216,178,90,.15);
    }
    .workflow-gates {
      display: grid;
      gap: 8px;
      padding: 14px;
    }
    .workflow-gate {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.12);
      border-radius: 11px;
      padding: 10px;
    }
    .workflow-gate div {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .workflow-gate strong { font-size: 13px; }
    .workflow-gate span { color: var(--muted); font-size: 12px; }
    .workflow-gate small {
      color: var(--muted);
      border: 1px solid rgba(255,247,230,.12);
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
      white-space: nowrap;
    }
    .workflow-gate.passed { border-color: rgba(134,201,138,.22); }
    .workflow-gate.passed small { color: var(--good); border-color: rgba(134,201,138,.3); background: rgba(134,201,138,.07); }
    .workflow-gate.needs-review { border-color: rgba(240,207,122,.3); }
    .workflow-gate.needs-review small { color: var(--warn); border-color: rgba(240,207,122,.3); background: rgba(240,207,122,.07); }
    .workflow-gate.failed { border-color: rgba(229,139,160,.32); }
    .workflow-gate.failed small { color: var(--bad); border-color: rgba(229,139,160,.32); background: rgba(229,139,160,.07); }
    .workflow-list {
      display: grid;
      gap: 8px;
      padding: 14px;
    }
    .workflow-step {
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.12);
      border-radius: 11px;
      padding: 10px;
      display: grid;
      gap: 3px;
    }
    .workflow-step strong { font-size: 13px; }
    .workflow-step span { color: var(--muted); font-size: 12px; }
    .rule-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid rgba(216,178,90,.15);
    }
    .rule-list {
      display: grid;
      gap: 8px;
      padding: 14px;
      max-height: 540px;
      overflow: auto;
    }
    .rule-item {
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.12);
      border-radius: 11px;
      padding: 10px;
      display: grid;
      gap: 6px;
    }
    .rule-item strong { font-size: 13px; }
    .rule-item p { margin: 0; color: var(--muted); font-size: 12px; }
    .rule-item small { color: var(--faint); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .rule-item.risk-high { border-color: rgba(229,139,160,.26); }
    .rule-item.risk-medium { border-color: rgba(240,207,122,.24); }
    .rule-item.risk-low { border-color: rgba(134,201,138,.2); }
    .detail-stat {
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.13);
      border-radius: 12px;
      padding: 11px;
    }
    .detail-stat span { display: block; color: var(--faint); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .detail-stat strong { display: block; margin-top: 4px; font-size: 16px; }
    .seo-preview {
      border: 1px solid rgba(127,176,230,.22);
      background: rgba(127,176,230,.065);
      border-radius: 13px;
      padding: 13px;
      display: grid;
      gap: 5px;
    }
    .seo-preview strong { color: #9fc6f0; font-size: 15px; line-height: 1.25; }
    .seo-preview span { color: var(--good); font-size: 12px; overflow-wrap: anywhere; }
    .seo-preview p { font-size: 13px; }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }
    .tag {
      display: inline-flex;
      border: 1px solid rgba(216,178,90,.22);
      border-radius: 999px;
      padding: 4px 9px;
      color: var(--gold);
      background: rgba(216,178,90,.07);
      font-size: 12px;
      font-weight: 700;
    }
    .mini-list {
      display: grid;
      gap: 8px;
    }
    .mini-list div {
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.12);
      border-radius: 11px;
      padding: 10px;
    }
    .mini-list strong { display: block; font-size: 13px; }
    .mini-list span { display: block; color: var(--muted); font-size: 12px; margin-top: 3px; }
    .mini-list .passed { border-color: rgba(134,201,138,.22); }
    .mini-list .needs-review { border-color: rgba(240,207,122,.3); }
    .mini-list .needs-review strong { color: var(--warn); }
    .section-label {
      color: var(--faint);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .09em;
      font-weight: 800;
      margin-bottom: -6px;
    }
    .editor-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 18px;
    }
    .editor-grid .wide { grid-column: 1 / -1; }
    .editor-help {
      color: var(--muted);
      padding: 0 18px 18px;
      font-size: 13px;
    }
    .editor-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 14px 18px 0;
    }
    .editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 14px 18px 0;
    }
    .patch-output {
      margin: 0 18px 18px;
      min-height: 150px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      color: var(--muted);
    }
    .block-preview {
      display: grid;
      gap: 8px;
      max-height: 360px;
      overflow: auto;
      padding-right: 4px;
    }
    .block-item {
      border: 1px solid rgba(255,247,230,.09);
      background: rgba(0,0,0,.12);
      border-radius: 11px;
      padding: 10px;
      display: grid;
      gap: 4px;
    }
    .block-item span {
      color: var(--gold);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 800;
    }
    .block-item p { margin: 0; color: var(--muted); font-size: 13px; }
    .hidden-row { display: none; }
    footer { color: var(--faint); padding: 20px 0 4px; font-size: 13px; }
    @media (max-width: 1100px) {
      .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .layout, .two-col, .tools, .home-brief, .home-rules, .founder-center, .founder-decision-strip, .founder-next-steps, .admin-nav { grid-template-columns: 1fr; }
      .admin-nav-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      header { display: grid; }
      .syncbox { min-width: 0; }
    }
    @media (max-width: 680px) {
      .shell { padding: 16px; }
      header { padding: 18px; border-radius: 14px; }
      .metrics, .home-decision-grid, .admin-nav-links { grid-template-columns: 1fr; }
      .metric { min-height: 104px; padding: 14px; }
      .metric strong { font-size: 26px; }
      th, td { padding: 11px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <div class="brandline">PersonalCapsule Website Admin</div>
        <h1>Read-only control preview</h1>
        <p class="lead">This local preview shows what the future admin panel can safely read today. It does not publish, edit, delete, or expose secrets.</p>
      </div>
      <aside class="syncbox">
        Generated from local content model
        <strong>${escapeHtml(generated)}</strong>
        <span>${escapeHtml(model.site.url)}</span>
      </aside>
    </header>

    ${renderAdminNavigation()}

    <section id="founder-center" class="admin-anchor">
      ${renderFounderDecisionCenter(founderDecisionCenter)}
      ${renderAdminHomeBrief(adminHomeBrief)}
      ${renderAdminWorkQueue(adminWorkQueue)}
    </section>

    <section class="grid metrics" aria-label="Website summary">
      ${renderMetric("HTML pages", model.summary.totalHtmlPages, "Current static pages")}
      ${renderMetric("Blog articles", model.summary.totalBlogArticles, "Structured content files")}
      ${renderMetric("Categories", model.summary.totalBlogCategories, "Managed blog groups")}
      ${renderMetric("Drafts", model.summary.articleStatuses.draft, "Not public")}
      ${renderMetric("Archived", model.summary.articleStatuses.archived, "Hidden from publishing")}
      ${renderMetric("Warnings", model.summary.seoWarnings, "Before publish checks")}
      ${renderMetric("Good", model.summary.articleQuality.good, "Ready quality")}
      ${renderMetric("Review", model.summary.articleQuality.review, "Needs attention")}
      ${renderMetric("Risk", model.summary.articleQuality.risk, "Should not publish")}
    </section>

    <section class="layout">
      <aside class="stack">
        ${renderPanelGroup(
          "System",
          "Daily health, workflow status, and founder-level overview.",
          `
            <section class="panel">
              <div class="panel-head">
                <h2>Health</h2>
                <span class="pill ${model.summary.seoWarnings === 0 ? "good" : "warn"}">${model.summary.seoWarnings === 0 ? "clean" : "review"}</span>
              </div>
              <div class="health">
                ${renderHealthIssues(model)}
              </div>
            </section>

            ${renderPublishWorkflowStatus({
              model,
              controlReport,
              draftComparisonReport,
              publishReadinessReport,
              publishDryRunReport,
              publishRollbackPlan,
              backupSnapshotReport,
              restoreDryRunReport,
            })}

            ${renderAdminDashboardSnapshot(adminDashboardSnapshot)}
            ${renderAdminSystemOverview(adminSystemOverview)}
            ${renderControlCenter(controlReport)}
          `
        )}

        ${renderPanelGroup(
          "Reports",
          "Report inventory, freshness, dependencies, and recovery context.",
          `
            ${renderAdminReportIndex(adminReportIndex)}
            ${renderAdminReportFreshness(adminReportFreshness)}
            ${renderAdminFailurePlaybook(adminFailurePlaybook)}
            ${renderAdminDependencyMap(adminDependencyMap)}
            ${renderAdminReportDetailViewer(adminReportDetailViewer)}
          `
        )}

        ${renderPanelGroup(
          "Guides",
          "Safe operating instructions and command references.",
          `
            ${renderAdminQuickStart(adminQuickStart)}
            ${renderAdminCommandGuide(adminCommandGuide)}
            ${renderAdminActionFlow(adminActionFlow)}
            ${renderAdminCommandRiskMatrix(adminCommandRiskMatrix)}
            ${renderAdminOperationsManual(adminOperationsManual)}
          `
        )}

        ${renderPanelGroup(
          "Git / Deploy",
          "Local Git state, push package, and Cloudflare deployment readiness.",
          `
            ${renderGitStatusReport(gitStatusReport)}
            ${renderPushPackageReport(pushPackageReport)}
            ${renderSafePushChecklist(safePushChecklist)}
            ${renderDomainSafetyPolicy(domainSafetyPolicy)}
            ${renderPushConfirmationGuide(pushConfirmationGuide)}
            ${renderDeploymentReadiness(deploymentReadiness)}
          `
        )}

        ${renderPanelGroup(
          "Publish Safety",
          "Dry-run, backup, rollback, and restore checks before anything goes live.",
          `
            ${renderPublishReadiness(publishReadinessReport)}
            ${renderPublishReport(publishReport)}
            ${renderPublishDryRun(publishDryRunReport)}
            ${renderPublishRollback(publishRollbackPlan)}
            ${renderBackupSnapshot(backupSnapshotReport)}
            ${renderBackupRestoreCenter(backupRestoreCenter)}
            ${renderPublishWizard(publishWizard)}
            ${renderPrePublishChecklist(prePublishChecklist)}
            ${renderDraftPublishSimulationSummary(draftPublishSimulationSummary)}
            ${renderRestoreDryRun(restoreDryRunReport)}
            ${renderRestoreReport(restoreReport)}
          `
        )}

        ${renderPanelGroup(
          "Drafts",
          "Draft quality, edit guidance, comparison, and new article workflow.",
          `
            ${renderDraftQuality(draftQualityReport)}
            ${renderDraftFixList(draftFixListReport)}
            ${renderDraftEditPlan(draftEditPlanReport)}
            ${renderDraftEditGuide(draftEditGuideReport)}
            ${renderDraftPatchApplyGuide(draftPatchApplyGuideReport)}
            ${renderDraftComparison(draftComparisonReport)}
            ${renderPublishWorkflow()}
            ${renderNewArticleWorkflow(model.categories)}
            ${renderEditorRules(model.editorRules.article)}
          `
        )}

        <section class="panel">
          <div class="panel-head">
            <h2>Category map</h2>
            <small>${model.categories.length} groups</small>
          </div>
          <div class="side-list">
            ${model.categories
              .map(
                (category) => `
                  <div class="side-item">
                    <strong>${escapeHtml(category.name)}</strong>
                    <span>${category.articleCount} articles · ${category.keywordCount} keywords</span>
                  </div>`
              )
              .join("")}
          </div>
        </section>
      </aside>

      <div id="content-section" class="stack admin-anchor">
        <section class="panel">
          <div class="panel-head">
            <h2>Blog articles</h2>
            <small>Read-only searchable list</small>
          </div>
          <div class="tools" aria-label="Article filters">
            <label class="field">
              <span>Search</span>
              <input id="articleSearch" type="search" placeholder="Search title, slug, category or description">
            </label>
            <label class="field">
              <span>Category</span>
              <select id="categoryFilter">
                <option value="all">All categories</option>
                ${renderCategoryOptions(model.categories)}
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select id="statusFilter">
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label class="field">
              <span>Quality</span>
              <select id="qualityFilter">
                <option value="all">All quality</option>
                <option value="good">Good</option>
                <option value="review">Review</option>
                <option value="risk">Risk</option>
              </select>
            </label>
            <div class="result-count"><span id="articleCount">${model.articles.length}</span>&nbsp;articles</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Quality</th>
                  <th>Issues</th>
                  <th>SEO title</th>
                  <th>Description</th>
                  <th>Blocks</th>
                  <th>FAQ</th>
                  <th>Related</th>
                  <th>Modified</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>${renderArticles(model.articles)}</tbody>
            </table>
          </div>
        </section>

        <section class="two-col">
          <section class="panel">
            <div class="panel-head">
              <h2>Selected article</h2>
              <small>Read-only detail</small>
            </div>
            <div class="detail-card" id="articleDetail">
              <h3>No article selected</h3>
              <p>Use the View button in the article table to inspect SEO, FAQ, related links, CTA and publishing fields before editing features exist.</p>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Draft Edit Form v1</h2>
              <small>Local form only</small>
            </div>
            <div class="editor-legend">
              <span class="field-mode editable">Editable</span>
              <span class="field-mode controlled">Controlled</span>
              <span class="field-mode generated">Generated</span>
              <span class="field-mode locked">Locked</span>
            </div>
            <div class="editor-grid" id="articleEditor">
              <label class="field wide">
                <span class="field-head"><span>No article selected</span><span class="field-mode readonly">Read-only</span></span>
                <textarea readonly>Select an article from the table to preview and locally edit safe draft fields.</textarea>
              </label>
            </div>
            <div class="editor-actions">
              <button class="mini-btn" type="button" id="buildPatchButton">Build draft patch</button>
              <button class="mini-btn" type="button" id="resetEditorButton">Reset form</button>
            </div>
            <p class="editor-help">This Draft Edit Form v1 only edits values inside this browser preview. Patch targets a draft file, never a published article file. It does not save, publish, delete, commit or deploy anything.</p>
            <textarea class="patch-output" id="draftPatchOutput" readonly>Local draft patch will appear here after you select an article and click Build draft patch. Apply it only to a draft file after human review.</textarea>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Categories</h2>
              <small>Sitemap and llms status</small>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Articles</th>
                    <th>Keywords</th>
                    <th>SEO</th>
                    <th>Meta</th>
                    <th>Sitemap</th>
                    <th>llms</th>
                  </tr>
                </thead>
                <tbody>${renderCategories(model.categories)}</tbody>
              </table>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Pages</h2>
              <small>${model.pages.length} public files</small>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Type</th>
                    <th>Route</th>
                    <th>Canonical</th>
                    <th>Meta</th>
                  </tr>
                </thead>
                <tbody>${renderPages(model.pages)}</tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </section>

    <footer>
      Local admin preview only. Next step: turn this read-only preview into a protected interface.
    </footer>
  </main>
  <script>
    const articles = ${articleJson};
    const editorRules = ${editorRulesJson};
    const editorRuleByKey = new Map((editorRules.fields || []).map((rule) => [rule.key, rule]));
    const articleById = new Map(articles.map((article) => [article.id, article]));
    const searchInput = document.getElementById("articleSearch");
    const categoryFilter = document.getElementById("categoryFilter");
    const statusFilter = document.getElementById("statusFilter");
    const qualityFilter = document.getElementById("qualityFilter");
    const articleCount = document.getElementById("articleCount");
    const detail = document.getElementById("articleDetail");
    const editor = document.getElementById("articleEditor");
    const buildPatchButton = document.getElementById("buildPatchButton");
    const resetEditorButton = document.getElementById("resetEditorButton");
    const draftPatchOutput = document.getElementById("draftPatchOutput");
    const rows = Array.from(document.querySelectorAll("[data-article-row]"));
    let selectedArticle = null;

    function esc(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function applyFilters() {
      const query = searchInput.value.trim().toLowerCase();
      const category = categoryFilter.value;
      const status = statusFilter.value;
      const quality = qualityFilter.value;
      let visible = 0;

      for (const row of rows) {
        const matchesSearch = query === "" || row.dataset.search.includes(query);
        const matchesCategory = category === "all" || row.dataset.category === category;
        const matchesStatus = status === "all" || row.dataset.status === status;
        const matchesQuality = quality === "all" || row.dataset.quality === quality;
        const show = matchesSearch && matchesCategory && matchesStatus && matchesQuality;
        row.classList.toggle("hidden-row", !show);
        if (show) visible += 1;
      }

      articleCount.textContent = visible;
    }

    function renderDetail(article) {
      const keywords = Array.isArray(article.keywords) ? article.keywords : [];
      const related = Array.isArray(article.related) ? article.related : [];
      const faq = Array.isArray(article.faq) ? article.faq : [];
      const qualityChecks = Array.isArray(article.qualityChecks) ? article.qualityChecks : [];
      const qualityIssues = Array.isArray(article.qualityIssues) ? article.qualityIssues : [];
      const cta = article.cta || {};

      detail.innerHTML = [
        "<h3>" + esc(article.title) + "</h3>",
        "<p>" + esc(article.description) + "</p>",
        "<div class='section-label'>SEO Preview</div>",
        "<div class='seo-preview'>",
          "<strong>" + esc(article.seoTitle) + "</strong>",
          "<span>" + esc(article.url) + "</span>",
          "<p>" + esc(article.description) + "</p>",
        "</div>",
        "<div class='detail-grid'>",
          "<div class='detail-stat'><span>Category</span><strong>" + esc(article.categoryName) + "</strong></div>",
          "<div class='detail-stat'><span>Status</span><strong>" + esc(article.status) + "</strong></div>",
          "<div class='detail-stat'><span>Quality</span><strong>" + esc(article.qualityStatus) + " · " + esc(article.qualityScore) + "</strong></div>",
          "<div class='detail-stat'><span>Open issues</span><strong>" + esc(article.qualityIssueCount) + "</strong></div>",
          "<div class='detail-stat'><span>SEO title length</span><strong>" + esc(article.seoTitleLength) + "</strong></div>",
          "<div class='detail-stat'><span>Description length</span><strong>" + esc(article.descriptionLength) + "</strong></div>",
          "<div class='detail-stat'><span>Body blocks</span><strong>" + esc(article.bodyBlockCount) + "</strong></div>",
          "<div class='detail-stat'><span>Related articles</span><strong>" + esc(article.relatedCount) + "</strong></div>",
        "</div>",
        "<div class='section-label'>Fix list</div>",
        qualityIssues.length
          ? "<div class='mini-list'>" + qualityIssues.map((issue) => "<div class='needs-review'><strong>" + esc(issue.label) + " · -" + esc(issue.lostPoints) + " points</strong><span>Why: " + esc(issue.reason) + "</span><span>Fix: " + esc(issue.fix) + "</span></div>").join("") + "</div>"
          : "<div class='empty'>No open quality issues for this article.</div>",
        "<div class='section-label'>Quality checks</div>",
        "<div class='mini-list'>" + qualityChecks.map((check) => "<div class='" + (check.passed ? "passed" : "needs-review") + "'><strong>" + (check.passed ? "Passed" : "Needs review") + " · " + esc(check.label) + "</strong><span>Why: " + esc(check.reason) + "</span><span>Fix: " + esc(check.fix) + "</span><span>Weight: " + esc(check.weight) + "</span></div>").join("") + "</div>",
        "<div class='section-label'>Keywords</div>",
        "<div class='tag-list'>" + keywords.map((keyword) => "<span class='tag'>" + esc(keyword) + "</span>").join("") + "</div>",
        "<div class='section-label'>CTA</div>",
        "<div class='mini-list'><div><strong>" + esc(cta.heading || "No CTA heading") + "</strong><span>" + esc(cta.text || "No CTA text") + "</span><span>Type: " + esc(article.ctaType) + "</span></div></div>",
        "<div class='section-label'>Related links</div>",
        "<div class='mini-list'>" + related.map((item) => "<div><strong>" + esc(item.label || "") + "</strong><span>" + esc(item.href || "") + "</span></div>").join("") + "</div>",
        "<div class='section-label'>FAQ</div>",
        "<div class='mini-list'>" + faq.map((item) => "<div><strong>" + esc(item.question || "") + "</strong><span>" + esc(item.answer || "") + "</span></div>").join("") + "</div>",
        "<p><strong>Slug:</strong> " + esc(article.slug) + "</p>"
      ].join("");
    }

    function labelForMode(mode) {
      if (mode === "editable") return "Editable";
      if (mode === "controlled") return "Controlled";
      if (mode === "generated") return "Generated";
      if (mode === "locked") return "Locked";
      return "Read-only";
    }

    function ruleFor(key, fallback = {}) {
      return editorRuleByKey.get(key) || fallback;
    }

    function field(key, label, value, options = {}) {
      const rule = ruleFor(key, {
        label,
        mode: options.mode || "locked",
        why: "No editor rule is defined for this field yet.",
      });
      const wide = options.wide ? " wide" : "";
      const multiline = options.multiline;
      const mode = rule.mode || options.mode || "locked";
      const isEditable = mode === "editable";
      const modeLabel = options.modeLabel || labelForMode(mode);
      const safeLabel = esc(rule.label || label);
      const safeValue = esc(value || "");
      const head = "<span class='field-head'><span>" + safeLabel + "</span><span class='field-mode " + esc(mode) + "'>" + esc(modeLabel) + "</span></span>";
      const help = rule.why ? "<small>" + esc(rule.why) + "</small>" : "";
      const editAttrs = isEditable ? " data-edit-key='" + esc(key) + "'" : " readonly";
      if (multiline) {
        return "<label class='field" + wide + "'>" + head + "<textarea" + editAttrs + ">" + safeValue + "</textarea>" + help + "</label>";
      }
      return "<label class='field" + wide + "'>" + head + "<input" + editAttrs + " value=\\"" + safeValue + "\\">" + help + "</label>";
    }

    function renderBlocks(blocks) {
      if (!Array.isArray(blocks) || blocks.length === 0) {
        return "<div class='block-item'><span>Empty</span><p>No body blocks found.</p></div>";
      }
      return blocks.map((block, index) => {
        const type = block.type || "unknown";
        const label = type + " " + (block.level ? "H" + block.level + " " : "") + "#" + (index + 1);
        let text = block.text || "";
        if (Array.isArray(block.items)) {
          text = block.items.map((item) => typeof item === "string" ? item : item.text).filter(Boolean).join(" · ");
        }
        return "<div class='block-item'><span>" + esc(label) + "</span><p>" + esc(text) + "</p></div>";
      }).join("");
    }

    function renderEditor(article) {
      const keywordText = Array.isArray(article.keywords) ? article.keywords.join(", ") : "";
      selectedArticle = article;
      editor.innerHTML = [
        field("id", "Internal ID", article.id),
        field("status", "Status", article.status),
        field("title", "Title", article.title, { wide: true }),
        field("seoTitle", "SEO title", article.seoTitle, { wide: true }),
        field("slug", "Slug", article.slug),
        field("category", "Category", article.categoryName),
        field("description", "Meta description", article.description, { wide: true, multiline: true }),
        field("excerpt", "Excerpt", article.excerpt || "", { wide: true, multiline: true }),
        field("keywords", "Keywords", keywordText, { wide: true, multiline: true }),
        field("datePublished", "Published date", article.datePublished || ""),
        field("dateModified", "Modified date", article.dateModified || ""),
        field("cta", "CTA type", article.ctaType || "none"),
        field("readTime", "Read time", article.readTime || ""),
        field("qualityScore", "Quality score", article.qualityStatus + " · " + article.qualityScore, { mode: "generated" }),
        "<div class='field wide'><span class='field-head'><span>Body blocks</span><span class='field-mode " + esc(ruleFor("body").mode || "editable") + "'>" + esc(labelForMode(ruleFor("body").mode || "editable")) + "</span></span><div class='block-preview'>" + renderBlocks(article.body) + "</div><small>" + esc(ruleFor("body").why || "") + "</small></div>"
      ].join("");
      draftPatchOutput.value = "Edit safe fields, then click Build draft patch. Patch targets a draft file, never a published article file. Body blocks remain preview-only in v1.";
    }

    function parsePatchValue(key, value) {
      if (key === "keywords") {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
      }
      return value;
    }

    function originalPatchValue(article, key) {
      if (key === "keywords" && Array.isArray(article.keywords)) {
        return article.keywords.join(", ");
      }
      return String(article[key] || "");
    }

    function summarizeChangedField(key, fromValue, toValue) {
      const rule = ruleFor(key, {
        label: key,
        mode: "editable",
        publishRisk: "medium",
        why: "No editor rule is defined for this field yet.",
      });
      return {
        key,
        label: rule.label || key,
        mode: rule.mode || "editable",
        publishRisk: rule.publishRisk || "medium",
        from: parsePatchValue(key, fromValue),
        to: parsePatchValue(key, toValue),
        reviewRequired: rule.mode !== "editable" || rule.publishRisk === "high",
        why: rule.why || "",
      };
    }

    function buildDraftPatch() {
      if (!selectedArticle) {
        draftPatchOutput.value = "Select an article first.";
        return;
      }

      const changedFields = {};
      const changedFieldDetails = [];
      const editableFields = Array.from(editor.querySelectorAll("[data-edit-key]"));

      for (const control of editableFields) {
        const key = control.dataset.editKey;
        const current = control.value;
        const originalValue = originalPatchValue(selectedArticle, key);

        if (current !== originalValue) {
          changedFields[key] = parsePatchValue(key, current);
          changedFieldDetails.push(summarizeChangedField(key, originalValue, current));
        }
      }

      const changedFieldCount = Object.keys(changedFields).length;
      const targetDraftPath = "content/drafts/articles/" + selectedArticle.id + ".draft.json";

      const patch = {
        mode: "local_draft_patch_v2",
        articleId: selectedArticle.id,
        title: selectedArticle.title,
        sourceArticlePath: "content/articles/" + selectedArticle.id + ".json",
        targetDraftPath,
        safety: {
          status: changedFieldCount === 0 ? "no_changes" : "draft_only_review_required",
          rule: "Do not apply this patch to content/articles. Apply it only to the target draft file after human review.",
          browserOnly: true,
          savesFiles: false,
          publishesFiles: false,
          commitsFiles: false,
          deploysFiles: false,
        },
        changedFieldCount,
        changedFields,
        changedFieldDetails,
        nextSteps:
          changedFieldCount === 0
            ? [
                "No field changed. Select an article and edit an editable field first.",
              ]
            : [
                "Create a private draft first if it does not already exist.",
                "Apply these values only inside the target draft JSON.",
                "Run node scripts/run-admin-control-check.js.",
                "Review draft preview, quality checks, and publish dry-run before marking ready.",
              ],
      };

      draftPatchOutput.value = JSON.stringify(patch, null, 2);
    }

    function resetEditor() {
      if (!selectedArticle) {
        draftPatchOutput.value = "Select an article first.";
        return;
      }
      renderEditor(selectedArticle);
    }

    searchInput.addEventListener("input", applyFilters);
    categoryFilter.addEventListener("change", applyFilters);
    statusFilter.addEventListener("change", applyFilters);
    qualityFilter.addEventListener("change", applyFilters);

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-detail-id]");
      if (!button) return;
      const article = articleById.get(button.dataset.detailId);
      if (article) {
        selectedArticle = article;
        renderDetail(article);
        renderEditor(article);
      }
    });

    buildPatchButton.addEventListener("click", buildDraftPatch);
    resetEditorButton.addEventListener("click", resetEditor);
  </script>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(MODEL_FILE)) {
    console.error("Missing admin read model. Run scripts/build-admin-read-model.js first.");
    process.exit(1);
  }

  const model = JSON.parse(fs.readFileSync(MODEL_FILE, "utf8"));
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, render(model));

  console.log("PersonalCapsule Admin Preview");
  console.log("=============================");
  console.log(`Output: ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`Articles: ${model.summary.totalBlogArticles}`);
  console.log(`Categories: ${model.summary.totalBlogCategories}`);
  console.log(`Warnings: ${model.summary.seoWarnings}`);
}

main();
