#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RULES_FILE = path.join(ROOT, "content", "admin", "article-editor-rules.json");

const allowedModes = new Set(["editable", "controlled", "generated", "locked"]);
const allowedRisks = new Set(["low", "medium", "high"]);
const requiredFields = [
  "id",
  "status",
  "title",
  "seoTitle",
  "slug",
  "category",
  "description",
  "excerpt",
  "keywords",
  "body",
  "faq",
  "related",
  "datePublished",
  "dateModified",
  "readTime",
  "cta",
  "url",
];

const report = {
  critical: [],
  warnings: [],
};

function add(level, message) {
  report[level].push(message);
}

function readRules() {
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
  } catch (error) {
    add("critical", `Cannot read editor rules: ${error.message}`);
    return null;
  }
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function main() {
  const rules = readRules();
  if (rules) {
    if (rules.contentType !== "blog_article") {
      add("critical", "Editor rules must target blog_article content.");
    }

    if (!Array.isArray(rules.workflow) || rules.workflow.length < 3) {
      add("critical", "Editor workflow must include draft, preview and audit steps.");
    }

    if (!Array.isArray(rules.fields)) {
      add("critical", "Editor rules must include fields array.");
    } else {
      const seen = new Set();
      for (const field of rules.fields) {
        if (!isText(field.key)) add("critical", "A field rule is missing key.");
        if (!isText(field.label)) add("critical", `Field ${field.key || "unknown"} is missing label.`);
        if (!allowedModes.has(field.mode)) {
          add("critical", `Field ${field.key || "unknown"} has invalid mode: ${field.mode}`);
        }
        if (!isText(field.why)) add("critical", `Field ${field.key || "unknown"} is missing why.`);
        if (!allowedRisks.has(field.publishRisk)) {
          add("critical", `Field ${field.key || "unknown"} has invalid publishRisk: ${field.publishRisk}`);
        }
        if (field.key) {
          if (seen.has(field.key)) add("critical", `Duplicate field rule: ${field.key}`);
          seen.add(field.key);
        }
      }

      for (const key of requiredFields) {
        if (!seen.has(key)) add("critical", `Missing required field rule: ${key}`);
      }

      const editableCount = rules.fields.filter((field) => field.mode === "editable").length;
      const lockedHighRiskCount = rules.fields.filter(
        (field) => field.mode === "locked" && field.publishRisk === "high"
      ).length;
      if (editableCount === 0) add("warnings", "No editable fields are defined.");
      if (lockedHighRiskCount === 0) add("warnings", "No high-risk locked fields are defined.");
    }
  }

  console.log("PersonalCapsule Editor Rules Audit");
  console.log("==================================");
  console.log(`Critical: ${report.critical.length}`);
  console.log(`Warnings: ${report.warnings.length}`);

  console.log("\nCritical Issues");
  if (report.critical.length === 0) console.log("  None");
  for (const issue of report.critical) console.log(`  - ${issue}`);

  console.log("\nWarnings");
  if (report.warnings.length === 0) console.log("  None");
  for (const issue of report.warnings) console.log(`  - ${issue}`);

  if (report.critical.length > 0) {
    process.exitCode = 1;
  }
}

main();
