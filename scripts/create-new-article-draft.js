#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_FILE = path.join(ROOT, "content", "site.json");
const CATEGORIES_DIR = path.join(ROOT, "content", "categories");
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const DRAFTS_DIR = path.join(ROOT, "content", "drafts", "articles");

function usage() {
  console.log("Usage:");
  console.log("  node scripts/create-new-article-draft.js <article-id> --category <category-id> --title \"Article title\" --confirm");
  console.log("  node scripts/create-new-article-draft.js <article-id> --category <category-id> --title \"Article title\" --dry-run");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function isSafeId(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function main() {
  const articleId = process.argv[2];
  const categoryId = option("--category");
  const title = option("--title");
  const dryRun = process.argv.includes("--dry-run");
  const confirmed = process.argv.includes("--confirm");
  const blockers = [];

  if (!articleId || articleId.startsWith("--")) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!isSafeId(articleId)) {
    blockers.push("Article id must use lowercase letters, numbers, and hyphens only.");
  }
  if (!categoryId || !isSafeId(categoryId)) {
    blockers.push("Category id is required and must use lowercase letters, numbers, and hyphens only.");
  }
  if (!title || title.trim().length < 8) {
    blockers.push("Title is required and should be at least 8 characters.");
  }
  if (!dryRun && !confirmed) {
    blockers.push("Creating a new article draft requires --confirm. Use --dry-run to preview only.");
  }

  const site = fs.existsSync(SITE_FILE) ? readJson(SITE_FILE) : null;
  const categoryPath = categoryId ? path.join(CATEGORIES_DIR, `${categoryId}.json`) : null;
  const articlePath = path.join(ARTICLES_DIR, `${articleId}.json`);
  const draftPath = path.join(DRAFTS_DIR, `${articleId}.draft.json`);

  if (!site || !site.siteUrl) {
    blockers.push("Site config is missing content/site.json or siteUrl.");
  }
  if (categoryPath && !fs.existsSync(categoryPath)) {
    blockers.push(`Category does not exist: content/categories/${categoryId}.json`);
  }
  if (fs.existsSync(articlePath)) {
    blockers.push(`Published article already exists: content/articles/${articleId}.json`);
  }
  if (fs.existsSync(draftPath)) {
    blockers.push(`Draft already exists: content/drafts/articles/${articleId}.draft.json`);
  }

  if (blockers.length > 0) {
    usage();
    console.error("\nBlocked:");
    for (const blocker of blockers) console.error(`- ${blocker}`);
    process.exitCode = 1;
    return;
  }

  const now = new Date().toISOString();
  const date = localDate();
  const cleanTitle = title.trim();
  const draft = {
    id: articleId,
    type: "blog_article",
    status: "draft",
    draftKind: "new_article",
    draftPublishIntent: "editing",
    draftCreatedAt: now,
    draftUpdatedAt: now,
    draftSourcePath: `content/articles/${articleId}.json`,
    draftNote: "New private article draft. Replace placeholder fields, generate preview, compare, and run full control check before publishing.",
    category: categoryId,
    title: cleanTitle,
    seoTitle: `${cleanTitle} | PersonalCapsule`,
    slug: articleId,
    url: `${site.siteUrl.replace(/\/$/, "")}/blog/${articleId}`,
    description: "Draft description. Replace this with a clear SEO description before publishing.",
    keywords: [
      articleId.replace(/-/g, " "),
      "PersonalCapsule",
      "private journal",
      "digital time capsule",
      "future self",
    ],
    excerpt: "Draft excerpt. Replace this with a short reader-friendly summary before publishing.",
    eyebrow: "Draft Article",
    readTime: "4 min read",
    datePublished: date,
    dateModified: date,
    schemaAbout: [
      articleId.replace(/-/g, " "),
      "PersonalCapsule",
    ],
    body: [
      {
        type: "paragraph",
        text: "Draft introduction. Explain the reader problem, why this topic matters, and how PersonalCapsule can help in a natural, non-salesy way.",
      },
      {
        type: "heading",
        level: 2,
        text: "Draft section heading",
      },
      {
        type: "paragraph",
        text: "Draft paragraph. Replace this with useful, specific, and honest guidance before publishing.",
      },
      {
        type: "heading",
        level: 2,
        text: "How to use this idea",
      },
      {
        type: "list",
        items: [
          "Replace this placeholder with a practical step.",
          "Add examples that match the search intent.",
          "Keep privacy and on-device storage claims accurate.",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Final thoughts",
      },
      {
        type: "paragraph",
        text: "Draft conclusion. Summarize the idea and gently connect it to creating a private capsule.",
      },
    ],
    faq: [
      {
        question: "Draft question?",
        answer: "Draft answer. Replace this with a useful answer before publishing.",
      },
      {
        question: "Is PersonalCapsule private?",
        answer: "PersonalCapsule does not require an account. Capsule content stays on device, with optional iCloud sync depending on the user's settings.",
      },
    ],
    related: [],
    cta: {
      label: "Create your own private capsule",
      url: site.appStore && site.appStore.campaigns ? site.appStore.campaigns.website : site.siteUrl,
    },
  };

  if (dryRun) {
    console.log("New article draft dry run passed");
    console.log(`Draft: content/drafts/articles/${articleId}.draft.json`);
    console.log("No file was created.");
    return;
  }

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  console.log("New article draft created");
  console.log(`Draft: content/drafts/articles/${articleId}.draft.json`);
  console.log("Status: draft");
  console.log("Publish intent: editing");
  console.log("No public article was created.");
}

main();
