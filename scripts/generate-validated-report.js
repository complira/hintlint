#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REVIEWS = join(ROOT, "benchmark", "results-public", "reviews");
const DEFAULT_OUT = join(ROOT, "benchmark", "results-public");

function usage() {
  return [
    "Usage: node scripts/generate-validated-report.js [options]",
    "",
    "Read review verdicts and produce a validated-only report.",
    "",
    "Options:",
    "  --reviews <path>   Reviews directory. Default: benchmark/results-public/reviews",
    "  --out <path>       Output directory. Default: benchmark/results-public",
    "  --help             Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = { reviews: DEFAULT_REVIEWS, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--reviews") { args.reviews = resolve(argv[++i]); continue; }
    if (arg === "--out") { args.out = resolve(argv[++i]); continue; }
  }
  return args;
}

function severityRank(severity) {
  const ranks = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return ranks[severity] ?? -1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const files = (await readdir(args.reviews)).filter((f) => f.endsWith(".json"));
  const reviews = [];

  for (const file of files) {
    const review = JSON.parse(await readFile(join(args.reviews, file), "utf-8"));
    reviews.push({ file, ...review });
  }

  const confirmed = reviews.filter((r) => r.review.verdict === "true_positive");
  const falsePositive = reviews.filter((r) => r.review.verdict === "false_positive");
  const notRelevant = reviews.filter((r) => r.review.verdict === "not_security_relevant");
  const needsContext = reviews.filter((r) => r.review.verdict === "needs_maintainer_context");
  const unreviewed = reviews.filter((r) => r.review.verdict === null);

  // Sort confirmed by severity
  confirmed.sort((a, b) => severityRank(b.finding_details.severity) - severityRank(a.finding_details.severity));

  // JSON report
  const jsonReport = {
    artifact_version: "hintlint.validated-report.v1",
    generated_at: new Date().toISOString(),
    totals: {
      total: reviews.length,
      confirmed: confirmed.length,
      false_positive: falsePositive.length,
      not_security_relevant: notRelevant.length,
      needs_maintainer_context: needsContext.length,
      unreviewed: unreviewed.length
    },
    confirmed: confirmed.map(compactReview),
    false_positive: falsePositive.map(compactReview),
    not_security_relevant: notRelevant.map(compactReview),
    needs_maintainer_context: needsContext.map(compactReview),
    unreviewed: unreviewed.map(compactReview)
  };

  await writeFile(join(args.out, "validated-report.json"), JSON.stringify(jsonReport, null, 2));

  // Markdown report
  const md = [];
  md.push("# HintLint Validated Findings Report");
  md.push("");
  md.push(`Generated: ${jsonReport.generated_at}`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`| Status | Count |`);
  md.push(`| --- | --- |`);
  md.push(`| Confirmed (true positive) | ${confirmed.length} |`);
  md.push(`| False positive | ${falsePositive.length} |`);
  md.push(`| Not security relevant | ${notRelevant.length} |`);
  md.push(`| Needs maintainer context | ${needsContext.length} |`);
  md.push(`| Unreviewed | ${unreviewed.length} |`);
  md.push(`| **Total** | **${reviews.length}** |`);
  md.push("");

  if (confirmed.length > 0) {
    md.push("## Confirmed Findings");
    md.push("");
    md.push("| Server | Tool | Finding | Severity | Engines | Impact |");
    md.push("| --- | --- | --- | --- | --- | --- |");
    for (const r of confirmed) {
      const engines = r.corroboration?.engines_confirming?.join(", ") ?? "builtin";
      const impact = r.review.security_impact ?? "-";
      md.push(`| ${r.finding_ref.server_id} | ${r.finding_ref.tool} | ${r.finding_ref.finding_id} | ${r.finding_details.severity} | ${engines} | ${impact} |`);
    }
    md.push("");
  }

  if (unreviewed.length > 0) {
    md.push("## Unreviewed Candidates");
    md.push("");
    md.push("| Server | Tool | Finding | Severity | Engines |");
    md.push("| --- | --- | --- | --- | --- |");
    for (const r of unreviewed) {
      const engines = r.corroboration?.engines_confirming?.join(", ") ?? "builtin";
      md.push(`| ${r.finding_ref.server_id} | ${r.finding_ref.tool} | ${r.finding_ref.finding_id} | ${r.finding_details.severity} | ${engines} |`);
    }
    md.push("");
  }

  md.push("## Methodology");
  md.push("");
  md.push("- Findings were produced by HintLint's built-in static detector and cross-validated");
  md.push("  against independent analysis engines (Semgrep, CodeQL, Bandit, ESLint).");
  md.push("- Each finding was manually reviewed and assigned a verdict.");
  md.push("- Only confirmed true positives should be cited in public claims.");
  md.push("");

  await writeFile(join(args.out, "validated-report.md"), md.join("\n"));

  console.log(`Validated report: ${confirmed.length} confirmed, ${falsePositive.length} false positive, ${unreviewed.length} unreviewed`);
  console.log(`Written to: ${join(args.out, "validated-report.json")}`);
  console.log(`Written to: ${join(args.out, "validated-report.md")}`);
}

function compactReview(r) {
  return {
    server_id: r.finding_ref.server_id,
    tool: r.finding_ref.tool,
    finding_id: r.finding_ref.finding_id,
    severity: r.finding_details.severity,
    type: r.finding_details.type,
    file: r.finding_ref.file,
    line: r.finding_ref.line,
    engines: r.corroboration?.engines_confirming ?? ["builtin"],
    verdict: r.review.verdict,
    reviewer: r.review.reviewer,
    security_impact: r.review.security_impact,
    notes: r.review.notes
  };
}

main().catch((error) => {
  console.error(`generate-validated-report: ${error.message}`);
  process.exit(1);
});
