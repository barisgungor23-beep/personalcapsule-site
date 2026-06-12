#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, "·")
    .replace(/&larr;/g, "←")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "));
}

function attr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = tag.match(pattern);
  return match ? decodeHtml(match[1]) : "";
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function getMeta(html, selectorName, selectorValue) {
  const metas = Array.from(html.matchAll(/<meta\b[^>]*>/gi)).map((m) => m[0]);
  for (const tag of metas) {
    if (attr(tag, selectorName) === selectorValue) return attr(tag, "content");
  }
  return "";
}

function getJsonLd(html) {
  return Array.from(
    html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  )
    .map((m) => JSON.parse(m[1].trim()))
    .flatMap((item) => (Array.isArray(item["@graph"]) ? item["@graph"] : [item]));
}

function extractTextAndLinks(html) {
  const links = [];
  const text = decodeHtml(
    html.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, label) => {
      const cleanLabel = stripTags(label);
      links.push({ text: cleanLabel, href: decodeHtml(href) });
      return cleanLabel;
    })
  );
  return links.length ? { text, links } : { text };
}

function parseProse(html) {
  let prose = firstMatch(html, /<div class="prose">([\s\S]*?)<\/div>\s*<div class="article-cta/i);
  prose = prose.replace(/<h2>FAQ<\/h2>[\s\S]*$/i, "");
  const blocks = [];
  const tokenPattern =
    /<(p|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1>|<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\3>/gi;
  let match;

  while ((match = tokenPattern.exec(prose))) {
    const tag = match[1];
    if (tag === "p") {
      blocks.push({ type: "paragraph", ...extractTextAndLinks(match[2]) });
    } else if (tag === "h2" || tag === "h3") {
      blocks.push({ type: "heading", level: Number(tag.slice(1)), ...extractTextAndLinks(match[2]) });
    } else if (tag === "blockquote") {
      blocks.push({ type: "quote", ...extractTextAndLinks(match[2]) });
    } else {
      const listTag = match[3];
      const attrs = match[4] || "";
      const start = attr(`<ol ${attrs}>`, "start");
      const items = Array.from(match[5].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).map((item) => {
        const parsed = extractTextAndLinks(item[1]);
        return parsed.links ? parsed : parsed.text;
      });
      const block = { type: "list", items };
      if (listTag === "ol") block.ordered = true;
      if (start) block.start = Number(start);
      blocks.push(block);
    }
  }

  return blocks;
}

function parseFaq(jsonLdBlocks) {
  const faq = jsonLdBlocks.find((block) => block["@type"] === "FAQPage");
  if (!faq || !Array.isArray(faq.mainEntity)) return [];
  return faq.mainEntity.map((item) => ({
    question: item.name,
    answer: item.acceptedAnswer.text,
  }));
}

function parseRelated(html) {
  const related = firstMatch(html, /<div class="related">[\s\S]*?<div class="related-list">([\s\S]*?)<\/div><\/div>/i);
  return Array.from(related.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)).map(
    (match) => ({
      href: decodeHtml(match[1]),
      label: stripTags(match[2]),
    })
  );
}

function parseCta(html) {
  const cta = firstMatch(html, /<div class="article-cta reveal">([\s\S]*?)<a class="appstore"/i);
  return {
    heading: stripTags(firstMatch(cta, /<h3>([\s\S]*?)<\/h3>/i)),
    text: stripTags(firstMatch(cta, /<p>([\s\S]*?)<\/p>/i)),
    appStoreTracking: "website",
  };
}

function importArticle(slug, categoryId) {
  const htmlPath = path.join(ROOT, "blog", `${slug}.html`);
  const html = fs.readFileSync(htmlPath, "utf8");
  const jsonLdBlocks = getJsonLd(html);
  const articleSchema = jsonLdBlocks.find((block) => block["@type"] === "Article") || {};
  const h1 = stripTags(firstMatch(html, /<div class="article-head">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i));
  const eyebrow = stripTags(firstMatch(html, /<div class="article-head">[\s\S]*?<div class="eyebrow">([\s\S]*?)<\/div>/i));
  const articleMeta = stripTags(firstMatch(html, /<div class="article-meta">([\s\S]*?)<\/div>/i));
  const readTime = articleMeta.includes("·") ? articleMeta.split("·").pop().trim() : "4 min read";

  const article = {
    id: slug,
    type: "blog_article",
    status: "published",
    category: categoryId,
    title: h1 || articleSchema.headline,
    seoTitle: stripTags(firstMatch(html, /<title>([\s\S]*?)<\/title>/i)),
    slug,
    url:
      articleSchema.mainEntityOfPage && articleSchema.mainEntityOfPage["@id"]
        ? articleSchema.mainEntityOfPage["@id"]
        : `https://personalcapsule.app/blog/${slug}`,
    description: getMeta(html, "name", "description"),
    keywords: getMeta(html, "name", "keywords")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    excerpt: getMeta(html, "name", "description"),
    eyebrow: eyebrow || categoryId,
    readTime: readTime || "4 min read",
    datePublished: articleSchema.datePublished || "2026-06-12",
    dateModified: articleSchema.dateModified || "2026-06-12",
    schemaAbout: articleSchema.about || [],
    body: parseProse(html),
    faq: parseFaq(jsonLdBlocks),
    cta: parseCta(html),
    related: parseRelated(html),
  };

  if (html.includes('href="../open-when-capsule/"')) {
    article.breadcrumbOpenWhen = true;
  }

  const outputPath = path.join(ROOT, "content/articles", `${slug}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(article, null, 2)}\n`);
  console.log(`Imported ${path.relative(ROOT, outputPath)}`);
}

function main() {
  const args = process.argv.slice(2);
  const categoryArgIndex = args.indexOf("--category");
  const categoryId =
    categoryArgIndex >= 0 && args[categoryArgIndex + 1]
      ? args[categoryArgIndex + 1]
      : "open-when-letters";
  const slugs =
    categoryArgIndex >= 0 ? args.filter((_, index) => index !== categoryArgIndex && index !== categoryArgIndex + 1) : args;
  if (slugs.length === 0) {
    console.error(
      "Usage: node scripts/import-article-json-from-html.js [--category category-id] article-slug [...more-slugs]"
    );
    process.exit(1);
  }
  for (const slug of slugs) importArticle(slug, categoryId);
}

main();
