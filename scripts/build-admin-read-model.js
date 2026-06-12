#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "admin-read-model.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "docs" || entry.name === "outputs") continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function textBetween(html, regex) {
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function attrContent(html, name) {
  const regex = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i");
  return textBetween(html, regex);
}

function propertyContent(html, property) {
  const regex = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']*)["']`, "i");
  return textBetween(html, regex);
}

function linkHref(html, rel) {
  const regex = new RegExp(`<link\\s+rel=["']${rel}["']\\s+href=["']([^"']*)["']`, "i");
  return textBetween(html, regex);
}

function routeForHtml(filePath) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, "/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.replace(/\/index\.html$/, "/")}`;
  return `/${relative.replace(/\.html$/, "")}`;
}

function classifyPage(route) {
  if (route === "/") return "home";
  if (route === "/about/") return "about";
  if (route === "/changelog/") return "changelog";
  if (route === "/blog/") return "blog_index";
  if (route.startsWith("/blog/category/")) return "blog_category";
  if (route.startsWith("/blog/")) return "blog_article";
  if (route === "/open-when-capsule/") return "open_when_tool";
  if (route === "/privacy" || route === "/terms") return "legal_page";
  return "static_page";
}

function statusCounts(items) {
  return items.reduce(
    (counts, item) => {
      const status = item.status || "unknown";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    { published: 0, draft: 0, archived: 0 }
  );
}

function makeLengthStatus(value, min, max) {
  const length = typeof value === "string" ? value.length : 0;
  if (length === 0) return "missing";
  if (length < min) return "short";
  if (length > max) return "long";
  return "ok";
}

function collectWarnings({ categories, articles, pages }) {
  const warnings = [];

  for (const category of categories) {
    if (category.seoTitleStatus !== "ok") {
      warnings.push({
        scope: "category",
        id: category.id,
        message: `Category SEO title status is ${category.seoTitleStatus}.`,
      });
    }
    if (category.descriptionStatus !== "ok") {
      warnings.push({
        scope: "category",
        id: category.id,
        message: `Category meta description status is ${category.descriptionStatus}.`,
      });
    }
  }

  for (const article of articles) {
    if (article.seoTitleStatus !== "ok") {
      warnings.push({
        scope: "article",
        id: article.id,
        message: `Article SEO title status is ${article.seoTitleStatus}.`,
      });
    }
    if (article.descriptionStatus !== "ok") {
      warnings.push({
        scope: "article",
        id: article.id,
        message: `Article meta description status is ${article.descriptionStatus}.`,
      });
    }
    if (article.relatedCount < 2) {
      warnings.push({
        scope: "article",
        id: article.id,
        message: "Article has fewer than 2 related articles.",
      });
    }
  }

  for (const page of pages) {
    if (!page.title) {
      warnings.push({ scope: "page", path: page.path, message: "Page title is missing." });
    }
    if (!page.canonicalUrl) {
      warnings.push({ scope: "page", path: page.path, message: "Canonical URL is missing." });
    }
    if (!page.metaDescription) {
      warnings.push({ scope: "page", path: page.path, message: "Meta description is missing." });
    }
  }

  return warnings;
}

function main() {
  const site = readJson(path.join(CONTENT_DIR, "site.json"));
  const blog = readJson(path.join(CONTENT_DIR, "blog.json"));

  const rawCategories = listJson(path.join(CONTENT_DIR, "categories")).map(readJson);
  const rawArticles = listJson(path.join(CONTENT_DIR, "articles")).map(readJson);
  const categoryById = new Map(rawCategories.map((category) => [category.id, category]));

  const categories = rawCategories
    .map((category) => {
      const categoryArticles = rawArticles.filter((article) => article.category === category.id);
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        status: category.status,
        url: category.url,
        seoTitle: category.seoTitle,
        seoTitleLength: category.seoTitle.length,
        seoTitleStatus: makeLengthStatus(category.seoTitle, 10, 65),
        description: category.description,
        descriptionLength: category.description.length,
        descriptionStatus: makeLengthStatus(category.description, 70, 165),
        keywordCount: category.keywords.length,
        articleCount: categoryArticles.length,
        publishedArticleCount: categoryArticles.filter((article) => article.status === "published").length,
        sitemapInclude: category.sitemapInclude === true,
        llmsInclude: category.llmsInclude === true,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const articles = rawArticles
    .map((article) => {
      const category = categoryById.get(article.category);
      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
        category: article.category,
        categoryName: category ? category.name : "",
        url: article.url,
        seoTitle: article.seoTitle,
        seoTitleLength: article.seoTitle.length,
        seoTitleStatus: makeLengthStatus(article.seoTitle, 10, 65),
        description: article.description,
        descriptionLength: article.description.length,
        descriptionStatus: makeLengthStatus(article.description, 70, 165),
        keywords: article.keywords,
        keywordCount: article.keywords.length,
        bodyBlockCount: article.body.length,
        faqCount: article.faq.length,
        faq: article.faq,
        relatedCount: article.related.length,
        related: article.related,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        readTime: article.readTime,
        ctaType: article.cta && article.cta.type ? article.cta.type : "none",
        cta: article.cta || null,
      };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.title.localeCompare(b.title));

  const pages = walk(ROOT)
    .filter((filePath) => filePath.endsWith(".html"))
    .map((filePath) => {
      const html = fs.readFileSync(filePath, "utf8");
      const route = routeForHtml(filePath);
      return {
        path: path.relative(ROOT, filePath).replace(/\\/g, "/"),
        route,
        url: `${site.siteUrl}${route === "/" ? "/" : route}`,
        type: classifyPage(route),
        title: textBetween(html, /<title>([^<]*)<\/title>/i),
        metaDescription: attrContent(html, "description"),
        canonicalUrl: linkHref(html, "canonical"),
        ogTitle: propertyContent(html, "og:title"),
        twitterTitle: attrContent(html, "twitter:title"),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));

  const warnings = collectWarnings({ categories, articles, pages });

  const model = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    site: {
      name: site.siteName,
      url: site.siteUrl,
      author: site.author,
      supportEmail: site.supportEmail,
    },
    blog: {
      id: blog.id,
      url: blog.url,
      title: blog.seoTitle,
      description: blog.description,
    },
    summary: {
      totalHtmlPages: pages.length,
      totalBlogCategories: categories.length,
      totalBlogArticles: articles.length,
      articleStatuses: statusCounts(articles),
      categoryStatuses: statusCounts(categories),
      seoWarnings: warnings.length,
      draftPages: articles.filter((article) => article.status === "draft").length,
      archivedPages: articles.filter((article) => article.status === "archived").length,
    },
    health: {
      critical: [],
      warnings,
    },
    categories,
    articles,
    pages,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(model, null, 2)}\n`);

  console.log("PersonalCapsule Admin Read Model");
  console.log("================================");
  console.log(`Output: ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`HTML pages: ${model.summary.totalHtmlPages}`);
  console.log(`Categories: ${model.summary.totalBlogCategories}`);
  console.log(`Articles: ${model.summary.totalBlogArticles}`);
  console.log(`Warnings: ${model.summary.seoWarnings}`);
}

main();
