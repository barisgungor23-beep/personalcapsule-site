#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "git-status-report.json");

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function parseStatusLine(line) {
  const indexStatus = line.slice(0, 1);
  const worktreeStatus = line.slice(1, 2);
  const file = line.slice(3);
  const rawStatus = line.slice(0, 2);

  let group = "modified";
  if (rawStatus === "??") group = "untracked";
  else if (indexStatus !== " ") group = "staged";
  else if (worktreeStatus !== " ") group = "unstaged";

  return {
    rawStatus,
    group,
    file,
  };
}

function main() {
  const branch = runGit(["branch", "--show-current"]);
  const latestCommit = runGit(["log", "-1", "--oneline"]);
  const status = runGit(["status", "--short"]);
  const blockers = [];

  if (branch.status !== 0) {
    blockers.push({
      scope: "git_branch",
      message: branch.stderr || "Could not read current Git branch.",
    });
  }

  if (latestCommit.status !== 0) {
    blockers.push({
      scope: "git_log",
      message: latestCommit.stderr || "Could not read latest Git commit.",
    });
  }

  if (status.status !== 0) {
    blockers.push({
      scope: "git_status",
      message: status.stderr || "Could not read Git status.",
    });
  }

  const files = status.stdout
    ? status.stdout
        .split("\n")
        .filter(Boolean)
        .map(parseStatusLine)
    : [];
  const untracked = files.filter((item) => item.group === "untracked");
  const staged = files.filter((item) => item.group === "staged");
  const unstaged = files.filter((item) => item.group === "unstaged");
  const modified = files.filter((item) => item.group === "modified");

  let pushSafety = "clean";
  let nextAction = "Working tree is clean. Review the latest commit before pushing.";

  if (blockers.length > 0) {
    pushSafety = "blocked";
    nextAction = "Fix Git command errors before trusting repository status.";
  } else if (staged.length > 0 || unstaged.length > 0 || modified.length > 0) {
    pushSafety = "review_changes";
    nextAction = "Review and commit tracked changes before pushing.";
  } else if (untracked.length > 0) {
    pushSafety = "review_untracked";
    nextAction = "Review untracked files before pushing. They are not included in commits unless explicitly added.";
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status: blockers.length > 0 ? "failed" : "passed",
      branch: branch.stdout || null,
      latestCommit: latestCommit.stdout || null,
      totalChangedFiles: files.length,
      staged: staged.length,
      unstaged: unstaged.length,
      modified: modified.length,
      untracked: untracked.length,
      pushSafety,
    },
    nextAction,
    blockers,
    files,
    rules: [
      "Do not push if tracked changes are unreviewed.",
      "Do not add untracked files unless you know exactly why they exist.",
      "Review git diff before every push.",
      "Generated local reports under outputs should stay ignored.",
      "A clean or intentionally reviewed working tree is required before Cloudflare deployment.",
    ],
    guarantee:
      "Read-only Git status report. This script only runs read-only git commands and writes a local report. It does not add, commit, push, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Git Status Report");
  console.log("=================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Branch: ${report.summary.branch || "unknown"}`);
  console.log(`Latest commit: ${report.summary.latestCommit || "unknown"}`);
  console.log(`Changed files: ${report.summary.totalChangedFiles}`);
  console.log(`Push safety: ${report.summary.pushSafety}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_FILE).replace(/\\/g, "/")}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
