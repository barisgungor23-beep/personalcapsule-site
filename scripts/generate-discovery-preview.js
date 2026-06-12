#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "outputs/generated/discovery");
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
const BLOG = JSON.parse(fs.readFileSync(path.join(ROOT, "content/blog.json"), "utf8"));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseSitemapEntries() {
  const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  return Array.from(sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)).map((match) => {
    const block = match[1];
    const value = (tag) => {
      const tagMatch = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return tagMatch ? tagMatch[1].trim().replace(/&amp;/g, "&") : "";
    };
    return {
      loc: value("loc"),
      lastmod: value("lastmod"),
      changefreq: value("changefreq"),
      priority: value("priority"),
    };
  });
}

function readPublishedCategories() {
  return fs
    .readdirSync(path.join(ROOT, "content/categories"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(`content/categories/${name}`))
    .filter((category) => category.status === "published");
}

function readPublishedArticles() {
  return fs
    .readdirSync(path.join(ROOT, "content/articles"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(`content/articles/${name}`))
    .filter((article) => article.status === "published");
}

function mergeSitemapEntries(baseEntries, categories, articles) {
  const entries = new Map(baseEntries.map((entry) => [entry.loc, entry]));
  const upsert = (entry) => entries.set(entry.loc, { ...(entries.get(entry.loc) || {}), ...entry });

  upsert({
    loc: BLOG.url,
    lastmod: entries.get(BLOG.url)?.lastmod || "2026-06-06",
    changefreq: "weekly",
    priority: "0.8",
  });

  for (const category of categories) {
    if (category.sitemapInclude === false) continue;
    upsert({
      loc: category.url || `${SITE.siteUrl}/blog/category/${category.slug}`,
      lastmod: entries.get(category.url)?.lastmod || "2026-06-12",
      changefreq: "weekly",
      priority: entries.get(category.url)?.priority || "0.75",
    });
  }

  for (const article of articles) {
    if (article.sitemapInclude === false) continue;
    upsert({
      loc: article.url || `${SITE.siteUrl}/blog/${article.slug}`,
      lastmod: article.dateModified || entries.get(article.url)?.lastmod || "2026-06-12",
      changefreq: "monthly",
      priority: entries.get(article.url)?.priority || "0.7",
    });
  }

  return Array.from(entries.values());
}

function renderSitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `
  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

function categoryTitle(categoryId, categories) {
  const category = categories.find((item) => item.id === categoryId);
  return category ? category.name : categoryId;
}

function renderOpenWhenSection(articles) {
  const openWhenArticles = articles.filter((article) => article.category === "open-when-letters");
  if (!openWhenArticles.length) return "";
  return `## Open When Letters Articles

${openWhenArticles.map((article) => `- ${article.title}: ${article.url}`).join("\n")}`;
}

function renderModelSummary(categories, articles) {
  const grouped = categories
    .filter((category) => category.llmsInclude !== false)
    .map((category) => ({
      category,
      articles: articles.filter(
        (article) => article.category === category.id && article.llmsInclude !== false
      ),
    }))
    .filter((group) => group.articles.length > 0);

  return grouped
    .map(
      (group) => `## ${categoryTitle(group.category.id, categories)} Articles

${group.articles.map((article) => `- ${article.title}: ${article.url}`).join("\n")}`
    )
    .join("\n\n");
}

function renderLlms(categories, articles) {
  const current = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8").trim();
  const section = renderModelSummary(categories, articles) || renderOpenWhenSection(articles);
  const withoutOpenWhen = current.replace(/\n## Open When Letters Articles[\s\S]*$/i, "").trim();
  return `${withoutOpenWhen}

${section}
`;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const categories = readPublishedCategories();
  const articles = readPublishedArticles();
  const sitemapEntries = mergeSitemapEntries(parseSitemapEntries(), categories, articles);

  const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
  const llmsPath = path.join(OUTPUT_DIR, "llms.txt");
  fs.writeFileSync(sitemapPath, renderSitemap(sitemapEntries));
  fs.writeFileSync(llmsPath, renderLlms(categories, articles));
  console.log(`Generated ${path.relative(ROOT, sitemapPath)}`);
  console.log(`Generated ${path.relative(ROOT, llmsPath)}`);
}

main();
