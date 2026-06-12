#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
const OUTPUT_DIR = path.join(ROOT, "outputs/generated");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function jsonLd(value) {
  return JSON.stringify(value);
}

function appStoreUrl(campaign) {
  return SITE.appStore.campaigns[campaign] || SITE.appStore.campaigns.website;
}

function appleSvg() {
  return '<svg viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
}

function linkText(text, links = []) {
  let output = escapeHtml(text);
  for (const link of links) {
    const escapedText = escapeHtml(link.text);
    const anchor = `<a href="${escapeAttr(link.href)}">${escapedText}</a>`;
    output = output.replace(escapedText, anchor);
  }
  return output.replace(/\n/g, "<br>");
}

function renderBody(blocks) {
  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p>${linkText(block.text, block.links)}</p>`;
      }
      if (block.type === "heading") {
        return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
      }
      if (block.type === "list") {
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
      throw new Error(`Unsupported block type: ${block.type}`);
    })
    .join("\n");
}

function renderFaq(faq) {
  if (!faq || faq.length === 0) return "";
  return [
    "<h2>FAQ</h2>",
    ...faq.flatMap((item) => [
      `<h3>${escapeHtml(item.question)}</h3>`,
      `<p>${escapeHtml(item.answer)}</p>`,
    ]),
  ].join("\n");
}

function renderRelated(related) {
  if (!related || related.length === 0) return "";
  return `<div class="related"><div class="eyebrow">Related Articles</div><div class="related-list">${related
    .map((item) => `<a href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("")}</div></div>`;
}

function renderCta(article) {
  const cta = article.cta;
  if (!cta) return "";
  return `<div class="article-cta reveal"><h3>${escapeHtml(cta.heading)}</h3><p>${escapeHtml(
    cta.text
  )}</p><a class="appstore" href="${escapeAttr(
    appStoreUrl(cta.appStoreTracking)
  )}" target="_blank" rel="noopener">${appleSvg()}<span class="as-txt"><span class="as-small">Download on the</span><span class="as-big">App Store</span></span></a></div>`;
}

function renderHead(article, category) {
  const canonical = article.url;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: SITE.assets.ogImage,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      "@type": "Person",
      name: SITE.author,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.siteName,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    about: article.schemaAbout || [],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE.siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE.siteUrl}/blog/` },
      {
        "@type": "ListItem",
        position: 3,
        name: category.name,
        item: `${SITE.siteUrl}/blog/category/${category.slug}`,
      },
      { "@type": "ListItem", position: 4, name: article.title, item: canonical },
    ],
  };

  const faqSchema =
    article.faq && article.faq.length
      ? `<script type="application/ld+json">${jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: article.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        })}</script>`
      : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(
    article.seoTitle
  )}</title><meta name="description" content="${escapeAttr(
    article.description
  )}"><meta name="keywords" content="${escapeAttr(
    article.keywords.join(", ")
  )}"><meta name="author" content="${escapeAttr(
    SITE.author
  )}"><meta name="theme-color" content="#0b0907"><link rel="icon" type="image/png" sizes="32x32" href="${SITE.siteUrl}/favicon-32x32.png"><link rel="apple-touch-icon" sizes="180x180" href="${SITE.siteUrl}/apple-touch-icon.png"><link rel="manifest" href="${SITE.siteUrl}/site.webmanifest"><link rel="canonical" href="${escapeAttr(
    canonical
  )}"><meta property="og:type" content="article"><meta property="og:site_name" content="${escapeAttr(
    SITE.siteName
  )}"><meta property="og:title" content="${escapeAttr(
    article.seoTitle
  )}"><meta property="og:description" content="${escapeAttr(
    article.description
  )}"><meta property="og:url" content="${escapeAttr(
    canonical
  )}"><meta property="og:image" content="${SITE.assets.ogImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeAttr(
    article.seoTitle
  )}"><meta name="twitter:description" content="${escapeAttr(
    article.description
  )}"><meta name="twitter:image" content="${SITE.assets.ogImage}"><link rel="preload" href="../fonts/hanken-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="../fonts/fraunces-normal-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="../fonts.css"><link rel="stylesheet" href="../styles.css"><script type="application/ld+json">${jsonLd(
    articleSchema
  )}</script><script type="application/ld+json">${jsonLd(
    breadcrumbSchema
  )}</script>${faqSchema}
<!-- Cloudflare Web Analytics -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "ea06127e65ee4078b5e86ad842b9fe2c"}'></script>
<!-- End Cloudflare Web Analytics -->
<script id="github-pages-domain-redirect">
(function(){
  if (location.hostname === "barisgungor23-beep.github.io") {
    var path = location.pathname.replace(/^\\/personalcapsule-site\\/?/, "/");
    location.replace("https://personalcapsule.app" + path + location.search + location.hash);
  }
})();
</script>
</head>`;
}

function renderPage(article, category) {
  return `${renderHead(article, category)}<body><div class="atmos"><div class="glow-orb" style="width:520px;height:520px;top:-120px;right:-100px;background:radial-gradient(circle,rgba(216,178,90,.28),transparent 70%)"></div><div class="glow-orb" style="width:480px;height:480px;bottom:6%;left:-140px;background:radial-gradient(circle,rgba(224,120,60,.18),transparent 70%)"></div><div class="grain"></div></div><nav id="nav" class="solid"><div class="nav-inner"><a class="brand" href="../" style="text-decoration:none"><img src="../icon.jpg" alt="PersonalCapsule icon"><span>PersonalCapsule</span></a><div class="nav-links"><a href="../about/">About</a><a href="../changelog/">Changelog</a><a href="../#faq">FAQ</a><a href="../blog/">Blog</a><a href="../open-when-capsule/">Open When</a></div><a class="appstore sm" href="${escapeAttr(
    appStoreUrl("website")
  )}" target="_blank" rel="noopener" aria-label="Download on the App Store">${appleSvg()}<span class="as-txt"><span class="as-small">Download on the</span><span class="as-big">App Store</span></span></a></div></nav><article class="article"><div class="breadcrumb"><a href="../">Home</a> / <a href="./">Blog</a> / <a href="category/${escapeAttr(
    category.slug
  )}">${escapeHtml(category.name)}</a></div><div class="article-head"><div class="eyebrow">${escapeHtml(
    article.eyebrow || category.name
  )}</div><h1>${escapeHtml(article.title)}</h1><div class="article-meta">${escapeHtml(
    SITE.siteName
  )} &middot; ${escapeHtml(article.readTime || "4 min read")}</div></div><div class="prose">
${renderBody(article.body)}
${renderFaq(article.faq)}
</div>${renderCta(article)}${renderRelated(
    article.related
  )}<a class="back-home" href="./">&larr; Back to all articles</a></article><footer><div class="foot-inner"><a class="foot-brand" href="../" style="text-decoration:none;color:inherit"><img src="../icon.jpg" alt="" aria-hidden="true"><span>PersonalCapsule</span></a><div class="foot-links"><a href="../about/">About</a><a href="../changelog/">Changelog</a><a href="../blog/">Blog</a><a href="../open-when-capsule/">Open When</a><a href="../#faq">FAQ</a><a href="${SITE.siteUrl}/privacy">Privacy</a><a href="${SITE.siteUrl}/terms">Terms</a><a href="mailto:${escapeAttr(
    SITE.supportEmail
  )}">Support</a></div><div class="foot-copy">&copy; 2026 PersonalCapsule &middot; Made for your future self.</div></div></footer><script>const nav=document.getElementById("nav");addEventListener("scroll",()=>{nav.classList.toggle("solid",scrollY>40)});const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:.12});document.querySelectorAll(".reveal").forEach(el=>io.observe(el));</script></body></html>`;
}

function main() {
  const articleId = process.argv[2] || "open-when-letters";
  const article = readJson(`content/articles/${articleId}.json`);
  const category = readJson(`content/categories/${article.category}.json`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${article.slug}.html`);
  fs.writeFileSync(outputPath, renderPage(article, category));
  console.log(`Generated ${path.relative(ROOT, outputPath)}`);
}

main();

