#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODEL_FILE = path.join(ROOT, "outputs", "admin", "admin-read-model.json");

const report = {
  critical: [],
  warnings: [],
};

function add(level, message) {
  report[level].push(message);
}

function readModel() {
  if (!fs.existsSync(MODEL_FILE)) {
    add("critical", "Admin read model does not exist. Run scripts/build-admin-read-model.js first.");
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(MODEL_FILE, "utf8"));
  } catch (error) {
    add("critical", `Admin read model is invalid JSON: ${error.message}`);
    return null;
  }
}

function requireArray(model, key) {
  if (!Array.isArray(model[key])) {
    add("critical", `Missing array: ${key}`);
    return [];
  }
  return model[key];
}

function requireSummaryNumber(model, key) {
  if (!model.summary || typeof model.summary[key] !== "number") {
    add("critical", `Missing summary number: ${key}`);
    return 0;
  }
  return model.summary[key];
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
  const model = readModel();

  if (model) {
    if (model.schemaVersion !== 1) {
      add("critical", `Unexpected schemaVersion: ${model.schemaVersion}`);
    }

    const categories = requireArray(model, "categories");
    const articles = requireArray(model, "articles");
    const pages = requireArray(model, "pages");

    const totalBlogCategories = requireSummaryNumber(model, "totalBlogCategories");
    const totalBlogArticles = requireSummaryNumber(model, "totalBlogArticles");
    const totalHtmlPages = requireSummaryNumber(model, "totalHtmlPages");

    if (categories.length !== totalBlogCategories) {
      add("critical", `Category count mismatch: summary says ${totalBlogCategories}, model has ${categories.length}.`);
    }
    if (articles.length !== totalBlogArticles) {
      add("critical", `Article count mismatch: summary says ${totalBlogArticles}, model has ${articles.length}.`);
    }
    if (pages.length !== totalHtmlPages) {
      add("critical", `HTML page count mismatch: summary says ${totalHtmlPages}, model has ${pages.length}.`);
    }

    if (!model.summary.articleQuality || typeof model.summary.articleQuality !== "object") {
      add("critical", "Missing summary articleQuality counts.");
    } else {
      const qualityTotal =
        (model.summary.articleQuality.good || 0) +
        (model.summary.articleQuality.review || 0) +
        (model.summary.articleQuality.risk || 0);
      if (qualityTotal !== articles.length) {
        add("critical", `Article quality count mismatch: summary says ${qualityTotal}, model has ${articles.length}.`);
      }
    }

    const categoryIds = new Set(categories.map((category) => category.id));
    for (const article of articles) {
      if (!categoryIds.has(article.category)) {
        add("critical", `Article ${article.id} points to unknown category ${article.category}.`);
      }
      if (typeof article.qualityScore !== "number" || article.qualityScore < 0 || article.qualityScore > 100) {
        add("critical", `Article ${article.id} has invalid qualityScore.`);
      }
      if (!["good", "review", "risk"].includes(article.qualityStatus)) {
        add("critical", `Article ${article.id} has invalid qualityStatus: ${article.qualityStatus}.`);
      }
      if (!Array.isArray(article.qualityChecks) || article.qualityChecks.length === 0) {
        add("critical", `Article ${article.id} has no qualityChecks.`);
      }
      if (!Array.isArray(article.qualityIssues)) {
        add("critical", `Article ${article.id} has no qualityIssues array.`);
      }
      if (typeof article.qualityIssueCount !== "number") {
        add("critical", `Article ${article.id} has invalid qualityIssueCount.`);
      }
      if (Array.isArray(article.qualityIssues) && article.qualityIssueCount !== article.qualityIssues.length) {
        add("critical", `Article ${article.id} qualityIssueCount does not match qualityIssues length.`);
      }
      if (Array.isArray(article.qualityChecks)) {
        for (const check of article.qualityChecks) {
          if (!check.reason || !check.fix) {
            add("critical", `Article ${article.id} has a quality check without reason or fix.`);
          }
        }
      }
    }

    const countedByCategory = new Map();
    for (const article of articles) {
      countedByCategory.set(article.category, (countedByCategory.get(article.category) || 0) + 1);
    }

    for (const category of categories) {
      const actualCount = countedByCategory.get(category.id) || 0;
      if (category.articleCount !== actualCount) {
        add("critical", `Category ${category.id} says ${category.articleCount} articles, but actual count is ${actualCount}.`);
      }
      if (category.status === "published" && category.publishedArticleCount === 0) {
        add("warnings", `Published category ${category.id} has no published articles.`);
      }
    }

    if (!pages.some((page) => page.route === "/")) {
      add("critical", "Home page is missing from admin page list.");
    }
    if (!pages.some((page) => page.route === "/blog/")) {
      add("critical", "Blog index is missing from admin page list.");
    }

    if (model.health && Array.isArray(model.health.critical) && model.health.critical.length > 0) {
      for (const issue of model.health.critical) {
        add("critical", `Model health critical issue: ${JSON.stringify(issue)}`);
      }
    }
  }

  console.log("PersonalCapsule Admin Read Model Audit");
  console.log("======================================");
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
