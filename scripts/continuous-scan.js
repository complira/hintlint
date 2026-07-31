#!/usr/bin/env node

/**
 * Continuous enterprise scanning loop.
 *
 * Watches an enterprise manifest for MCP servers, scans on schedule,
 * compares against previous results, and reports new/resolved drift.
 *
 * Usage:
 *   node scripts/continuous-scan.js --manifest catalog.json --interval 3600
 *
 * This is the enterprise loop:
 *   1. Read the manifest (enterprise's approved MCP server catalog)
 *   2. For each server: clone/update, scan, auto-review
 *   3. Compare against previous scan results (diff)
 *   4. Write diff report: new findings, resolved findings, unchanged
 *   5. Optionally notify via webhook
 *   6. Sleep and repeat
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return [
    "Usage: node scripts/continuous-scan.js [options]",
    "",
    "Continuous MCP server scanning for enterprise catalogs.",
    "",
    "Options:",
    "  --manifest <path>     Enterprise MCP catalog. Required.",
    "  --out <path>          Output directory. Default: benchmark/results-enterprise",
    "  --interval <seconds>  Scan interval. Default: 3600 (1 hour). 0 = single run.",
    "  --webhook <url>       Webhook URL for drift notifications",
    "  --semgrep <mode>      auto, local, docker, or none. Default: auto",
    "  --auto-review         Run auto-review after scan. Default: true",
    "  --help                Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    manifest: null,
    out: join(ROOT, "benchmark", "results-enterprise"),
    interval: 3600,
    webhook: null,
    semgrep: "auto",
    autoReview: true
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--manifest") { args.manifest = resolve(argv[++i]); continue; }
    if (arg === "--out") { args.out = resolve(argv[++i]); continue; }
    if (arg === "--interval") { args.interval = parseInt(argv[++i], 10); continue; }
    if (arg === "--webhook") { args.webhook = argv[++i]; continue; }
    if (arg === "--semgrep") { args.semgrep = argv[++i]; continue; }
    if (arg === "--no-auto-review") { args.autoReview = false; continue; }
  }
  return args;
}

function runScript(scriptPath, scriptArgs) {
  return new Promise((res, rej) => {
    const child = spawn("node", [scriptPath, ...scriptArgs], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("error", rej);
    child.on("close", (code) => {
      if (code === 0) res({ stdout, stderr });
      else rej(new Error(`Script exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

/**
 * Compare current scan summary against previous and produce a diff.
 */
function diffFindings(previousFindings, currentFindings) {
  const prevKeys = new Set(previousFindings.map(findingKey));
  const currKeys = new Set(currentFindings.map(findingKey));

  const newFindings = currentFindings.filter((f) => !prevKeys.has(findingKey(f)));
  const resolvedFindings = previousFindings.filter((f) => !currKeys.has(findingKey(f)));
  const unchanged = currentFindings.filter((f) => prevKeys.has(findingKey(f)));

  return { newFindings, resolvedFindings, unchanged };
}

function findingKey(finding) {
  const f = finding.finding ?? finding;
  return `${f.tool}:${f.id}:${(f.evidence?.[0]?.file ?? "")}:${(f.evidence?.[0]?.line ?? 0)}`;
}

/**
 * Send webhook notification for new drift findings.
 */
async function notifyWebhook(webhookUrl, payload) {
  try {
    const body = JSON.stringify(payload);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function runScanCycle(args, cycleNumber) {
  const timestamp = new Date().toISOString();
  const cycleDir = join(args.out, "scans", `cycle-${cycleNumber}`);
  const reportsDir = join(cycleDir, "reports");
  const reviewsDir = join(cycleDir, "reviews");

  await mkdir(reportsDir, { recursive: true });
  await mkdir(reviewsDir, { recursive: true });

  console.log(`\n=== Scan Cycle ${cycleNumber} — ${timestamp} ===\n`);

  // Step 1: Run the main scanner
  console.log("Step 1: Scanning MCP servers...");
  try {
    const scanResult = await runScript(join(ROOT, "scripts", "scan-public-mcp.js"), [
      "--manifest", args.manifest,
      "--out", cycleDir,
      "--semgrep", args.semgrep,
      "--skip-fetch" // don't skip fetch — we want latest
    ].filter((a) => a !== "--skip-fetch")); // remove skip-fetch so it fetches latest
    console.log(scanResult.stdout.trim().split("\n").slice(-5).join("\n"));
  } catch (err) {
    console.error(`Scan failed: ${err.message}`);
    return null;
  }

  // Step 2: Cross-validate with available tools
  console.log("\nStep 2: Cross-validating...");
  try {
    await runScript(join(ROOT, "scripts", "cross-validate-public.js"), [
      "--reports", reportsDir,
      "--out", join(cycleDir, "cross-validation"),
      "--tools", "bandit"
    ]);
  } catch {
    console.log("  Cross-validation skipped (tools unavailable)");
  }

  // Step 3: Generate review scaffold
  console.log("Step 3: Generating review scaffold...");
  const cvSummaryPath = join(cycleDir, "cross-validation", "summary.json");
  if (existsSync(cvSummaryPath)) {
    try {
      await runScript(join(ROOT, "scripts", "generate-review-scaffold.js"), [
        "--input", cvSummaryPath,
        "--out", reviewsDir
      ]);
    } catch {
      console.log("  Review scaffold generation skipped");
    }
  }

  // Step 4: Auto-review
  if (args.autoReview) {
    console.log("Step 4: Auto-reviewing findings...");
    try {
      const reviewResult = await runScript(join(ROOT, "scripts", "auto-review.js"), [
        "--reviews", reviewsDir,
        "--reports", reportsDir
      ]);
      console.log(reviewResult.stdout.trim().split("\n").slice(-5).join("\n"));
    } catch {
      console.log("  Auto-review skipped");
    }
  }

  // Step 5: Generate validated report
  console.log("Step 5: Generating validated report...");
  try {
    await runScript(join(ROOT, "scripts", "generate-validated-report.js"), [
      "--reviews", reviewsDir,
      "--out", cycleDir
    ]);
  } catch {
    console.log("  Report generation skipped");
  }

  // Step 6: Diff against previous cycle
  const currentSummaryPath = join(cycleDir, "summary.json");
  const previousCycleDir = join(args.out, "scans", `cycle-${cycleNumber - 1}`);
  const previousSummaryPath = join(previousCycleDir, "summary.json");

  let diff = null;
  if (existsSync(currentSummaryPath)) {
    const currentSummary = JSON.parse(await readFile(currentSummaryPath, "utf-8"));
    const currentFindings = currentSummary.top_findings ?? [];

    if (existsSync(previousSummaryPath)) {
      const previousSummary = JSON.parse(await readFile(previousSummaryPath, "utf-8"));
      const previousFindings = previousSummary.top_findings ?? [];
      diff = diffFindings(previousFindings, currentFindings);

      console.log(`\nDiff: ${diff.newFindings.length} new, ${diff.resolvedFindings.length} resolved, ${diff.unchanged.length} unchanged`);
    } else {
      diff = { newFindings: currentFindings, resolvedFindings: [], unchanged: [] };
      console.log(`\nFirst scan: ${currentFindings.length} findings`);
    }

    // Write diff report
    const diffReport = {
      artifact_version: "hintlint.scan-diff.v1",
      cycle: cycleNumber,
      generated_at: timestamp,
      previous_cycle: cycleNumber > 1 ? cycleNumber - 1 : null,
      new_findings: diff.newFindings.length,
      resolved_findings: diff.resolvedFindings.length,
      unchanged: diff.unchanged.length,
      new: diff.newFindings,
      resolved: diff.resolvedFindings
    };
    await writeFile(join(cycleDir, "diff-report.json"), JSON.stringify(diffReport, null, 2));

    // Step 7: Webhook notification
    if (args.webhook && diff.newFindings.length > 0) {
      console.log(`\nNotifying webhook: ${diff.newFindings.length} new findings...`);
      const sent = await notifyWebhook(args.webhook, {
        event: "hintlint.new_drift",
        cycle: cycleNumber,
        timestamp,
        new_findings: diff.newFindings.length,
        findings: diff.newFindings.slice(0, 10).map((f) => ({
          server: f.server_id ?? "unknown",
          tool: f.tool,
          finding: f.id,
          severity: f.severity
        }))
      });
      console.log(sent ? "  Webhook sent" : "  Webhook failed");
    }
  }

  // Update latest symlink
  const latestPath = join(args.out, "latest");
  await writeFile(latestPath, cycleDir);

  return diff;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  if (!args.manifest) {
    console.error("Error: --manifest is required");
    console.log(usage());
    process.exit(1);
  }

  await mkdir(args.out, { recursive: true });

  // Determine starting cycle number
  let cycleNumber = 1;
  const scansDir = join(args.out, "scans");
  if (existsSync(scansDir)) {
    const { readdirSync } = await import("node:fs");
    const existing = readdirSync(scansDir)
      .filter((d) => d.startsWith("cycle-"))
      .map((d) => parseInt(d.replace("cycle-", ""), 10))
      .filter((n) => !isNaN(n));
    if (existing.length > 0) {
      cycleNumber = Math.max(...existing) + 1;
    }
  }

  if (args.interval === 0) {
    // Single run
    await runScanCycle(args, cycleNumber);
  } else {
    // Continuous loop
    console.log(`Continuous scanning: interval=${args.interval}s, manifest=${args.manifest}`);
    while (true) {
      await runScanCycle(args, cycleNumber);
      cycleNumber++;
      console.log(`\nNext scan in ${args.interval}s...`);
      await new Promise((r) => setTimeout(r, args.interval * 1000));
    }
  }
}

main().catch((error) => {
  console.error(`continuous-scan: ${error.message}`);
  process.exit(1);
});
