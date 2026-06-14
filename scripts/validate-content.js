#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");

const report = {
  critical: [],
  warnings: [],
};

function add(level, file, message) {
  report[level].push({ file, message });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    add("critical", path.relative(ROOT, filePath), `Invalid JSON: ${error.message}`);
    return null;
  }
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireString(file, object, key) {
  if (!isNonEmptyString(object[key])) {
    add("critical", file, `Missing required string: ${key}`);
  }
}

function requireArray(file, object, key) {
  if (!Array.isArray(object[key])) {
    add("critical", file, `Missing required array: ${key}`);
  }
}

function validateSite(site) {
  const file = "content/site.json";
  if (!site) return;
  requireString(file, site, "siteName");
  requireString(file, site, "siteUrl");
  requireString(file, site, "author");
  requireString(file, site, "supportEmail");
  if (!site.appStore || !site.appStore.campaigns) {
    add("critical", file, "Missing appStore.campaigns.");
  } else {
    for (const campaign of ["website"]) {
      if (!isNonEmptyString(site.appStore.campaigns[campaign])) {
        add("critical", file, `Missing App Store campaign URL: ${campaign}`);
      }
    }
  }
}

function validateCategory(file, category) {
  if (!category) return;
  requireString(file, category, "id");
  requireString(file, category, "type");
  requireString(file, category, "status");
  requireString(file, category, "name");
  requireString(file, category, "slug");
  requireString(file, category, "seoTitle");
  requireString(file, category, "description");
  requireArray(file, category, "keywords");
  requireString(file, category, "intro");

  if (category.type !== "blog_category") {
    add("critical", file, `Unexpected category type: ${category.type}`);
  }
  if (!["draft", "published", "archived"].includes(category.status)) {
    add("critical", file, `Invalid status: ${category.status}`);
  }
  if (category.seoTitle && category.seoTitle.length > 65) {
    add("warnings", file, `SEO title is long (${category.seoTitle.length} chars).`);
  }
  if (category.description && category.description.length > 165) {
    add("warnings", file, `Description is long (${category.description.length} chars).`);
  }
}

function validateArticle(file, article, categories) {
  if (!article) return;
  requireString(file, article, "id");
  requireString(file, article, "type");
  requireString(file, article, "status");
  requireString(file, article, "category");
  requireString(file, article, "title");
  requireString(file, article, "seoTitle");
  requireString(file, article, "slug");
  requireString(file, article, "description");
  requireArray(file, article, "keywords");
  requireArray(file, article, "body");
  requireArray(file, article, "faq");
  requireArray(file, article, "related");

  if (article.type !== "blog_article") {
    add("critical", file, `Unexpected article type: ${article.type}`);
  }
  if (!["draft", "published", "archived"].includes(article.status)) {
    add("critical", file, `Invalid status: ${article.status}`);
  }
  if (article.category && !categories.has(article.category)) {
    add("critical", file, `Unknown category: ${article.category}`);
  }
  if (article.seoTitle && article.seoTitle.length > 65) {
    add("warnings", file, `SEO title is long (${article.seoTitle.length} chars).`);
  }
  if (article.description && article.description.length > 165) {
    add("warnings", file, `Description is long (${article.description.length} chars).`);
  }
  if (Array.isArray(article.related) && article.related.length < 2) {
    add("warnings", file, "Article has fewer than 2 related links.");
  }
  if (Array.isArray(article.body)) {
    article.body.forEach((block, index) => {
      if (!block || typeof block !== "object") {
        add("critical", file, `Body block ${index} is not an object.`);
        return;
      }
      if (!isNonEmptyString(block.type)) {
        add("critical", file, `Body block ${index} is missing type.`);
      }
      if (isNonEmptyString(block.type) && !["heading", "paragraph", "quote", "list", "table"].includes(block.type)) {
        add("critical", file, `Body block ${index} has unsupported type: ${block.type}.`);
      }
      if (block.type === "heading") {
        if (![2, 3].includes(block.level)) {
          add("critical", file, `Heading block ${index} has invalid level.`);
        }
        if (!isNonEmptyString(block.text)) {
          add("critical", file, `Heading block ${index} is missing text.`);
        }
      }
      if (block.type === "paragraph" && !isNonEmptyString(block.text)) {
        add("critical", file, `Paragraph block ${index} is missing text.`);
      }
      if (block.type === "quote" && !isNonEmptyString(block.text)) {
        add("critical", file, `Quote block ${index} is missing text.`);
      }
      if (block.type === "list" && (!Array.isArray(block.items) || block.items.length === 0)) {
        add("critical", file, `List block ${index} has no items.`);
      }
      if (block.type === "list" && Array.isArray(block.items)) {
        block.items.forEach((item, itemIndex) => {
          if (typeof item === "string") return;
          if (!item || typeof item !== "object" || !isNonEmptyString(item.text)) {
            add("critical", file, `List block ${index} item ${itemIndex} is invalid.`);
          }
        });
      }
      if (block.type === "table") {
        if (!Array.isArray(block.headers) || block.headers.length === 0) {
          add("critical", file, `Table block ${index} has no headers.`);
        } else {
          block.headers.forEach((header, headerIndex) => {
            if (!isNonEmptyString(header)) {
              add("critical", file, `Table block ${index} header ${headerIndex} is invalid.`);
            }
          });
        }
        if (!Array.isArray(block.rows) || block.rows.length === 0) {
          add("critical", file, `Table block ${index} has no rows.`);
        } else {
          block.rows.forEach((row, rowIndex) => {
            if (!Array.isArray(row)) {
              add("critical", file, `Table block ${index} row ${rowIndex} is invalid.`);
              return;
            }
            if (Array.isArray(block.headers) && row.length !== block.headers.length) {
              add(
                "critical",
                file,
                `Table block ${index} row ${rowIndex} has ${row.length} cells, expected ${block.headers.length}.`
              );
            }
            row.forEach((cell, cellIndex) => {
              if (typeof cell === "string") {
                if (!isNonEmptyString(cell)) {
                  add("critical", file, `Table block ${index} row ${rowIndex} cell ${cellIndex} is empty.`);
                }
                return;
              }
              if (!cell || typeof cell !== "object" || !isNonEmptyString(cell.text)) {
                add("critical", file, `Table block ${index} row ${rowIndex} cell ${cellIndex} is invalid.`);
              }
            });
          });
        }
      }
    });
  }
}

function printSection(title, items) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log("  None");
    return;
  }
  for (const item of items) {
    console.log(`  - ${item.file}: ${item.message}`);
  }
}

function main() {
  const site = readJson(path.join(CONTENT_DIR, "site.json"));
  validateSite(site);

  const categoryFiles = listJson(path.join(CONTENT_DIR, "categories"));
  const categories = new Set();
  for (const filePath of categoryFiles) {
    const category = readJson(filePath);
    if (category && category.id) categories.add(category.id);
    validateCategory(path.relative(ROOT, filePath), category);
  }

  const articleFiles = listJson(path.join(CONTENT_DIR, "articles"));
  for (const filePath of articleFiles) {
    validateArticle(path.relative(ROOT, filePath), readJson(filePath), categories);
  }

  console.log("PersonalCapsule Content Validation");
  console.log("==================================");
  console.log(`Categories: ${categoryFiles.length}`);
  console.log(`Articles: ${articleFiles.length}`);
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  printSection("Critical Issues", report.critical);
  printSection("Warnings", report.warnings);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
