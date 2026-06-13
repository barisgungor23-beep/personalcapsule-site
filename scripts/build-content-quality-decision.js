#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(ADMIN_OUTPUT_DIR, "content-quality-decision-report.json");

const MODEL_FILE = path.join(ADMIN_OUTPUT_DIR, "admin-read-model.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function issueIds(article) {
  return Array.isArray(article.qualityIssues) ? article.qualityIssues.map((issue) => issue.id) : [];
}

function main() {
  const model = readJsonIfExists(MODEL_FILE);
  const blockers = [];
  const warnings = [];

  if (!model) {
    blockers.push({
      scope: "admin_read_model",
      message: "Admin read model is missing. Run node scripts/build-admin-read-model.js first.",
    });
  }

  const articles = model && Array.isArray(model.articles) ? model.articles : [];
  const categories = model && Array.isArray(model.categories) ? model.categories : [];
  const publishedArticles = articles.filter((article) => article.status === "published");
  const qualityCounts = countBy(publishedArticles, (article) => article.qualityStatus || "unknown");
  const reviewArticles = publishedArticles.filter((article) => article.qualityStatus === "review");
  const riskArticles = publishedArticles.filter((article) => article.qualityStatus === "risk");
  const issueCounts = countBy(
    publishedArticles.flatMap((article) => issueIds(article)),
    (id) => id
  );

  const missingFaq = publishedArticles.filter((article) => issueIds(article).includes("faq"));
  const missingCta = publishedArticles.filter((article) => issueIds(article).includes("cta"));
  const missingFaqAndCta = publishedArticles.filter((article) => {
    const ids = issueIds(article);
    return ids.includes("faq") && ids.includes("cta");
  });

  const categorySummaries = categories.map((category) => {
    const categoryArticles = publishedArticles.filter((article) => article.category === category.id);
    const categoryQuality = countBy(categoryArticles, (article) => article.qualityStatus || "unknown");
    return {
      id: category.id,
      name: category.name,
      articleCount: categoryArticles.length,
      good: categoryQuality.good || 0,
      review: categoryQuality.review || 0,
      risk: categoryQuality.risk || 0,
      seoTitleStatus: category.seoTitleStatus,
      descriptionStatus: category.descriptionStatus,
      sitemapInclude: Boolean(category.sitemapInclude),
      llmsInclude: Boolean(category.llmsInclude),
    };
  });

  const topFixCandidates = reviewArticles
    .slice()
    .sort((a, b) => {
      if ((b.qualityIssueCount || 0) !== (a.qualityIssueCount || 0)) {
        return (b.qualityIssueCount || 0) - (a.qualityIssueCount || 0);
      }
      return (a.qualityScore || 0) - (b.qualityScore || 0);
    })
    .slice(0, 12)
    .map((article) => ({
      id: article.id,
      title: article.title,
      category: article.categoryName || article.category,
      score: article.qualityScore,
      issues: issueIds(article),
      url: article.url,
      suggestedFix:
        issueIds(article).includes("faq") && issueIds(article).includes("cta")
          ? "Add one honest FAQ and a soft App Store/Open When CTA."
          : issueIds(article).includes("faq")
            ? "Add one honest FAQ that directly answers the article intent."
            : issueIds(article).includes("cta")
              ? "Add a soft CTA that matches the article topic."
              : "Review the article quality details before editing.",
    }));

  const geoSignals = [
    {
      label: "Structured topic coverage",
      status: categorySummaries.length >= 5 ? "good" : "review",
      meaning:
        "The site has multiple clear topic clusters, which helps search engines and AI systems understand what PersonalCapsule is about.",
    },
    {
      label: "Direct answer coverage",
      status: missingFaq.length === 0 ? "good" : "review",
      meaning:
        missingFaq.length === 0
          ? "Articles already include direct FAQ-style answers."
          : `${missingFaq.length} article(s) are missing FAQ answers, which weakens snippet and AI-answer usefulness.`,
    },
    {
      label: "Next-step clarity",
      status: missingCta.length === 0 ? "good" : "review",
      meaning:
        missingCta.length === 0
          ? "Articles already include clear next steps."
          : `${missingCta.length} article(s) are missing a soft CTA, which weakens conversion from content to App Store.`,
    },
    {
      label: "Indexable category structure",
      status: categorySummaries.every((category) => category.sitemapInclude && category.llmsInclude) ? "good" : "review",
      meaning:
        "Category pages should stay visible in sitemap and llms so Google and AI tools can understand the content clusters.",
    },
  ];

  if (riskArticles.length > 0) {
    warnings.push({
      scope: "article_quality",
      message: `${riskArticles.length} article(s) are marked risk and should be fixed before publishing new content.`,
    });
  }

  const shouldImproveExisting = reviewArticles.length > publishedArticles.length / 2;
  const status = blockers.length > 0 ? "blocked" : riskArticles.length > 0 || shouldImproveExisting ? "review" : "good";
  const founderAnswer =
    blockers.length > 0
      ? "Content quality cannot be trusted until the admin model is rebuilt."
      : riskArticles.length > 0
        ? "Fix risky articles before adding new content."
        : shouldImproveExisting
          ? "The site is healthy, but existing articles need light FAQ/CTA improvements before more new content."
          : "Content quality is healthy. It is reasonable to wait and observe Search Console data.";

  const recommendedAction =
    blockers.length > 0
      ? "Run node scripts/run-admin-control-check.js."
      : riskArticles.length > 0
        ? "Fix risk articles first."
        : shouldImproveExisting
          ? "Improve existing review articles in small batches instead of adding new articles immediately."
          : "Wait, observe search data, and only edit when a clear opportunity appears.";

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      articles: publishedArticles.length,
      good: qualityCounts.good || 0,
      review: qualityCounts.review || 0,
      risk: qualityCounts.risk || 0,
      categories: categorySummaries.length,
      missingFaq: missingFaq.length,
      missingCta: missingCta.length,
      missingFaqAndCta: missingFaqAndCta.length,
      topFixCandidates: topFixCandidates.length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    founderAnswer,
    recommendedAction,
    plainMeaning:
      "This report does not change content. It turns existing SEO/GEO quality signals into a simple founder decision: wait, improve existing articles, or fix risks first.",
    issueCounts,
    geoSignals,
    categorySummaries,
    topFixCandidates,
    suggestedBatch: topFixCandidates.slice(0, 5),
    doNow: [
      shouldImproveExisting
        ? "Pick 3-5 review articles and add missing FAQ/CTA fields through the draft workflow."
        : "Do not rush new content. Watch Search Console and Cloudflare data first.",
      "Keep category pages indexed in sitemap and llms.",
      "Run the full control check after every content edit.",
    ],
    doNot: [
      "Do not bulk-edit all 30 review articles at once.",
      "Do not add fake reviews, fake statistics, or unsupported claims.",
      "Do not change live article JSON directly; use the draft workflow.",
    ],
    blockers,
    warnings,
    sources: [relative(MODEL_FILE)],
    guarantee:
      "Read-only content quality decision report. This script reads the local admin model and writes a local decision report only. It does not edit content, publish files, copy backups, restore files, stage files, commit, push, pull, reset, delete, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Content Quality Decision");
  console.log("========================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Articles: ${report.summary.articles}`);
  console.log(`Good: ${report.summary.good}`);
  console.log(`Review: ${report.summary.review}`);
  console.log(`Risk: ${report.summary.risk}`);
  console.log(`Report: ${relative(OUTPUT_FILE)}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
