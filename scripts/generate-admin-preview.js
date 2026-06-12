#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODEL_FILE = path.join(ROOT, "outputs", "admin", "admin-read-model.json");
const OUTPUT_FILE = path.join(ROOT, "outputs", "admin", "index.html");

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
        <tr>
          <td>
            <strong>${escapeHtml(article.title)}</strong>
            <small>${escapeHtml(article.slug)}</small>
          </td>
          <td>${escapeHtml(article.categoryName)}</td>
          <td><span class="pill ${statusClass(article.status)}">${escapeHtml(article.status)}</span></td>
          <td>${article.seoTitleLength}</td>
          <td><span class="pill ${statusClass(article.descriptionStatus)}">${escapeHtml(article.descriptionStatus)}</span></td>
          <td>${article.bodyBlockCount}</td>
          <td>${article.faqCount}</td>
          <td>${article.relatedCount}</td>
          <td>${escapeHtml(article.dateModified || "")}</td>
        </tr>`
    )
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

function render(model) {
  const generated = new Date(model.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

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
    .layout { display: grid; grid-template-columns: 310px minmax(0, 1fr); gap: 16px; align-items: start; }
    .panel {
      border: 1px solid var(--line);
      background: rgba(255,247,230,.04);
      border-radius: 16px;
      overflow: hidden;
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
    footer { color: var(--faint); padding: 20px 0 4px; font-size: 13px; }
    @media (max-width: 1100px) {
      .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .layout, .two-col { grid-template-columns: 1fr; }
      header { display: grid; }
      .syncbox { min-width: 0; }
    }
    @media (max-width: 680px) {
      .shell { padding: 16px; }
      header { padding: 18px; border-radius: 14px; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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

    <section class="grid metrics" aria-label="Website summary">
      ${renderMetric("HTML pages", model.summary.totalHtmlPages, "Current static pages")}
      ${renderMetric("Blog articles", model.summary.totalBlogArticles, "Structured content files")}
      ${renderMetric("Categories", model.summary.totalBlogCategories, "Managed blog groups")}
      ${renderMetric("Drafts", model.summary.articleStatuses.draft, "Not public")}
      ${renderMetric("Archived", model.summary.articleStatuses.archived, "Hidden from publishing")}
      ${renderMetric("Warnings", model.summary.seoWarnings, "Before publish checks")}
    </section>

    <section class="layout">
      <aside class="stack">
        <section class="panel">
          <div class="panel-head">
            <h2>Health</h2>
            <span class="pill ${model.summary.seoWarnings === 0 ? "good" : "warn"}">${model.summary.seoWarnings === 0 ? "clean" : "review"}</span>
          </div>
          <div class="health">
            ${renderHealthIssues(model)}
          </div>
        </section>

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

      <div class="stack">
        <section class="panel">
          <div class="panel-head">
            <h2>Blog articles</h2>
            <small>Read-only list</small>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>SEO title</th>
                  <th>Description</th>
                  <th>Blocks</th>
                  <th>FAQ</th>
                  <th>Related</th>
                  <th>Modified</th>
                </tr>
              </thead>
              <tbody>${renderArticles(model.articles)}</tbody>
            </table>
          </div>
        </section>

        <section class="two-col">
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
