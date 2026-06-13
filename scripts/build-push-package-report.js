#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_OUTPUT_DIR = path.join(ROOT, "outputs", "admin");
const REPORT_FILE = path.join(ADMIN_OUTPUT_DIR, "push-package-report.json");

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

function parseAheadBehind(value) {
  const [aheadRaw, behindRaw] = String(value || "").split(/\s+/);
  return {
    ahead: Number.parseInt(aheadRaw || "0", 10) || 0,
    behind: Number.parseInt(behindRaw || "0", 10) || 0,
  };
}

function parseCommit(line) {
  const [hash, ...messageParts] = line.split(" ");
  return {
    hash,
    message: messageParts.join(" "),
  };
}

function main() {
  const branch = runGit(["branch", "--show-current"]);
  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const statusBranch = runGit(["status", "--short", "--branch"]);
  const blockers = [];
  const warnings = [];

  if (branch.status !== 0) {
    blockers.push({
      scope: "git_branch",
      message: branch.stderr || "Could not read current branch.",
    });
  }

  if (upstream.status !== 0) {
    warnings.push({
      scope: "git_upstream",
      message: upstream.stderr || "No upstream branch is configured.",
    });
  }

  let ahead = 0;
  let behind = 0;
  let commits = [];

  if (upstream.status === 0) {
    const counts = runGit(["rev-list", "--left-right", "--count", `HEAD...${upstream.stdout}`]);
    if (counts.status === 0) {
      const parsed = parseAheadBehind(counts.stdout);
      ahead = parsed.ahead;
      behind = parsed.behind;
    } else {
      blockers.push({
        scope: "git_ahead_behind",
        message: counts.stderr || "Could not compare local branch with upstream.",
      });
    }

    const log = runGit(["log", "--oneline", "--max-count=50", `${upstream.stdout}..HEAD`]);
    if (log.status === 0 && log.stdout) {
      commits = log.stdout.split("\n").filter(Boolean).map(parseCommit);
    }
  }

  let status = "clean";
  let nextAction = "There are no local commits waiting to be pushed.";

  if (blockers.length > 0) {
    status = "blocked";
    nextAction = "Fix Git package errors before trusting the push package.";
  } else if (behind > 0) {
    status = "blocked";
    nextAction = "Local branch is behind upstream. Pull or reconcile remote changes before pushing.";
  } else if (ahead > 0) {
    status = "review";
    nextAction = `Review ${ahead} local commit(s) before pushing. Pushing will send this package to GitHub and may trigger Cloudflare deployment.`;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      branch: branch.stdout || null,
      upstream: upstream.status === 0 ? upstream.stdout : null,
      ahead,
      behind,
      commits: commits.length,
      blockers: blockers.length,
      warnings: warnings.length,
    },
    nextAction,
    blockers,
    warnings,
    statusBranch: statusBranch.stdout || null,
    commits,
    rules: [
      "Review every local commit before pushing.",
      "Do not push if the branch is behind upstream.",
      "Remember that Cloudflare Pages may deploy after GitHub receives the push.",
      "Push only when deployment readiness and local content checks are acceptable.",
      "Keep unrelated or experimental commits out of the deploy package.",
    ],
    guarantee:
      "Read-only push package report. This script only runs read-only git commands and writes a local report. It does not add, commit, push, pull, reset, or deploy.",
  };

  fs.mkdirSync(ADMIN_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  console.log("PersonalCapsule Push Package Report");
  console.log("===================================");
  console.log(`Status: ${report.summary.status}`);
  console.log(`Branch: ${report.summary.branch || "unknown"}`);
  console.log(`Upstream: ${report.summary.upstream || "none"}`);
  console.log(`Ahead: ${report.summary.ahead}`);
  console.log(`Behind: ${report.summary.behind}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_FILE).replace(/\\/g, "/")}`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
