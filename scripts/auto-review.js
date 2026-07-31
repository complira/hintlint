#!/usr/bin/env node

/**
 * Automated finding reviewer.
 *
 * For each unreviewed finding, reads the actual source code and verifies:
 *   1. The reported sink exists at or near the evidence line
 *   2. The claimed annotations (or lack thereof) match what's in source
 *
 * Auto-assigns verdicts:
 *   - true_positive: sink confirmed AND annotations match the claim
 *   - false_positive: sink not found OR annotations are actually declared correctly
 *   - needs_maintainer_context: sink confirmed but annotation status is ambiguous
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REVIEWS = join(ROOT, "benchmark", "results-public", "reviews");
const DEFAULT_REPORTS = join(ROOT, "benchmark", "results-public", "reports");
const DEFAULT_WORKDIR = join(ROOT, "benchmark", "external", "public-mcp", "repos");

function usage() {
  return [
    "Usage: node scripts/auto-review.js [options]",
    "",
    "Automatically verify findings by reading source code.",
    "",
    "Options:",
    "  --reviews <path>   Reviews directory. Default: benchmark/results-public/reviews",
    "  --reports <path>   Reports directory. Default: benchmark/results-public/reports",
    "  --workdir <path>   Cloned repos. Default: benchmark/external/public-mcp/repos",
    "  --dry-run          Show verdicts without writing",
    "  --force            Re-review already reviewed findings",
    "  --help             Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    reviews: DEFAULT_REVIEWS,
    reports: DEFAULT_REPORTS,
    workdir: DEFAULT_WORKDIR,
    dryRun: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--reviews") { args.reviews = resolve(argv[++i]); continue; }
    if (arg === "--reports") { args.reports = resolve(argv[++i]); continue; }
    if (arg === "--workdir") { args.workdir = resolve(argv[++i]); continue; }
    if (arg === "--dry-run") { args.dryRun = true; continue; }
    if (arg === "--force") { args.force = true; continue; }
  }
  return args;
}

// ---------- Source verification ----------

const LINE_WINDOW = 10;

/**
 * Annotation patterns to search for in Python source.
 * These cover both @mcp.tool(annotations={...}) and ToolAnnotations(...) styles.
 */
const PYTHON_ANNOTATION_PATTERNS = [
  /annotations\s*=\s*\{/,
  /ToolAnnotations\s*\(/,
  /destructiveHint\s*[=:]\s*True/i,
  /destructive_hint\s*[=:]\s*True/i,
  /readOnlyHint\s*[=:]\s*True/i,
  /read_only_hint\s*[=:]\s*True/i,
];

const TS_ANNOTATION_PATTERNS = [
  /annotations\s*:\s*\{/,
  /destructiveHint\s*:\s*true/,
  /readOnlyHint\s*:\s*true/,
  /openWorldHint\s*:\s*(true|false)/,
];

function readSourceLines(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n");
  } catch {
    return null;
  }
}

/**
 * Check if a sink pattern exists at or near the reported line.
 */
function verifySinkAtLine(lines, lineNumber, sinkPattern) {
  if (!lines || !sinkPattern) return { found: false, actualLine: null };

  // Normalize sink pattern for search (remove trailing parens/spaces)
  const searchStr = sinkPattern.replace(/[(\s]+$/, "").trim();
  if (!searchStr) return { found: false, actualLine: null };

  const startLine = Math.max(0, lineNumber - 1 - LINE_WINDOW);
  const endLine = Math.min(lines.length, lineNumber - 1 + LINE_WINDOW);

  for (let i = startLine; i < endLine; i++) {
    if (lines[i].includes(searchStr)) {
      return { found: true, actualLine: i + 1, content: lines[i].trim() };
    }
  }
  return { found: false, actualLine: null };
}

/**
 * Search for annotation declarations near a tool registration.
 * Looks backward from the evidence line up to 100 lines for annotation patterns.
 */
function findAnnotationsNearTool(lines, lineNumber, language) {
  if (!lines) return { found: false, patterns: [] };

  const patterns = language === "python" ? PYTHON_ANNOTATION_PATTERNS : TS_ANNOTATION_PATTERNS;
  const startLine = Math.max(0, lineNumber - 1 - 100);
  const endLine = Math.min(lines.length, lineNumber - 1 + 10);
  const foundPatterns = [];

  for (let i = startLine; i < endLine; i++) {
    for (const pattern of patterns) {
      if (pattern.test(lines[i])) {
        foundPatterns.push({
          pattern: pattern.source,
          line: i + 1,
          content: lines[i].trim()
        });
      }
    }
  }

  return { found: foundPatterns.length > 0, patterns: foundPatterns };
}

/**
 * Detect the language from the file extension.
 */
function languageFromFile(filePath) {
  if (/\.py$/.test(filePath)) return "python";
  if (/\.(ts|tsx|js|mjs|cjs)$/.test(filePath)) return "typescript";
  return "unknown";
}

/**
 * Determine the verdict for a finding based on source verification.
 */
function autoVerdict(finding, findingReport, repoDir) {
  const ref = finding.finding_ref;
  const details = finding.finding_details;
  const filePath = join(repoDir, ref.file);
  const lines = readSourceLines(filePath);

  if (!lines) {
    return {
      verdict: "needs_maintainer_context",
      notes: `Source file not found: ${ref.file}`,
      impact: null
    };
  }

  // Get the full finding from the report to access evidence details
  const reportFindings = findingReport?.findings ?? [];
  const fullFinding = reportFindings.find(
    (f) => f.tool === ref.tool && f.id === ref.finding_id
  );
  const evidenceRecords = fullFinding?.evidence ?? [];
  const primaryEvidence = evidenceRecords[0];
  const sinkPattern = primaryEvidence?.sink;
  const language = languageFromFile(ref.file);

  // Step 1: Verify the sink exists at the reported location
  const sinkCheck = verifySinkAtLine(lines, ref.line, sinkPattern);

  // Step 2: Check if annotations are declared near the tool
  const annotationCheck = findAnnotationsNearTool(lines, ref.line, language);

  // Decision logic per finding type
  if (details.type === "missing_or_false_destructive_hint") {
    // DESTRUCTIVE-001: claims destructiveHint is missing
    if (!sinkCheck.found) {
      return {
        verdict: "false_positive",
        notes: `Sink pattern "${sinkPattern}" not found within ${LINE_WINDOW} lines of line ${ref.line}.`,
        impact: null
      };
    }

    // Check if destructiveHint is actually declared
    const hasDestructiveAnnotation = annotationCheck.patterns.some(
      (p) => /destructive/i.test(p.content)
    );
    if (hasDestructiveAnnotation) {
      const matchLine = annotationCheck.patterns.find((p) => /destructive/i.test(p.content));
      return {
        verdict: "false_positive",
        notes: `Sink confirmed at line ${sinkCheck.actualLine}, but destructiveHint IS declared at line ${matchLine.line}: "${matchLine.content}". Extractor missed annotation.`,
        impact: null
      };
    }

    // Sink confirmed, no destructive annotation found
    return {
      verdict: "true_positive",
      notes: `Sink "${sinkCheck.content}" confirmed at line ${sinkCheck.actualLine}. No destructiveHint annotation found in surrounding ${100} lines.`,
      impact: `Tool '${ref.tool}' performs destructive operation (${primaryEvidence?.category}) without declaring destructiveHint=true. MCP clients relying on annotations cannot gate this action.`
    };
  }

  if (details.type === "false_readonly") {
    // READONLY-001: claims readOnlyHint=true but evidence shows mutation
    if (!sinkCheck.found) {
      return {
        verdict: "false_positive",
        notes: `Sink pattern "${sinkPattern}" not found within ${LINE_WINDOW} lines of line ${ref.line}.`,
        impact: null
      };
    }

    // Verify that readOnlyHint is actually declared true
    const declaredReadOnly = details.declared_annotations?.readOnlyHint === true;
    if (!declaredReadOnly) {
      return {
        verdict: "false_positive",
        notes: `Sink confirmed but tool does not actually declare readOnlyHint=true. Finding premise is wrong.`,
        impact: null
      };
    }

    return {
      verdict: "true_positive",
      notes: `Sink "${sinkCheck.content}" confirmed at line ${sinkCheck.actualLine}. Tool declares readOnlyHint=true but performs ${primaryEvidence?.category}.`,
      impact: `Tool '${ref.tool}' declares readOnlyHint=true but source evidence shows ${primaryEvidence?.category} at line ${sinkCheck.actualLine}.`
    };
  }

  if (details.type === "false_open_world") {
    // OPEN-WORLD-001: claims openWorldHint=false but evidence shows external effect
    if (!sinkCheck.found) {
      return {
        verdict: "false_positive",
        notes: `Sink pattern "${sinkPattern}" not found within ${LINE_WINDOW} lines of line ${ref.line}.`,
        impact: null
      };
    }

    return {
      verdict: "true_positive",
      notes: `Sink "${sinkCheck.content}" confirmed at line ${sinkCheck.actualLine}. Tool declares openWorldHint=false but has external side effect.`,
      impact: `Tool '${ref.tool}' declares openWorldHint=false but source shows ${primaryEvidence?.category} at line ${sinkCheck.actualLine}.`
    };
  }

  if (details.type?.startsWith("tool_input_to_")) {
    // FLOW findings: tool input reaches dangerous sink
    if (!sinkCheck.found) {
      return {
        verdict: "false_positive",
        notes: `Sink pattern "${sinkPattern}" not found within ${LINE_WINDOW} lines of line ${ref.line}.`,
        impact: null
      };
    }

    return {
      verdict: "true_positive",
      notes: `Sink "${sinkCheck.content}" confirmed at line ${sinkCheck.actualLine}. Tool input may reach ${primaryEvidence?.category}.`,
      impact: `Tool '${ref.tool}' has input that reaches ${primaryEvidence?.category} at line ${sinkCheck.actualLine} without recognized validation.`
    };
  }

  // Unknown finding type — flag for manual review
  return {
    verdict: "needs_maintainer_context",
    notes: `Unknown finding type: ${details.type}. Requires manual review.`,
    impact: null
  };
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const reviewFiles = (await readdir(args.reviews)).filter((f) => f.endsWith(".json"));
  let reviewed = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let needsContext = 0;
  let skipped = 0;

  // Cache loaded reports
  const reportCache = new Map();

  for (const file of reviewFiles) {
    const reviewPath = join(args.reviews, file);
    const review = JSON.parse(await readFile(reviewPath, "utf-8"));

    // Skip already reviewed unless --force
    if (review.review.verdict !== null && !args.force) {
      skipped++;
      continue;
    }

    const serverId = review.finding_ref.server_id;
    const repoDir = join(args.workdir, serverId);

    // Load report for this server (cached)
    if (!reportCache.has(serverId)) {
      const reportPath = join(args.reports, `${serverId}.json`);
      if (existsSync(reportPath)) {
        reportCache.set(serverId, JSON.parse(await readFile(reportPath, "utf-8")));
      } else {
        reportCache.set(serverId, null);
      }
    }
    const report = reportCache.get(serverId);

    // Run auto-review
    const result = autoVerdict(review, report, repoDir);

    const icon = result.verdict === "true_positive" ? "TP" :
                 result.verdict === "false_positive" ? "FP" : "??";
    console.log(`  ${icon}  ${serverId} / ${review.finding_ref.tool} — ${result.verdict}`);
    if (result.notes) console.log(`      ${result.notes.slice(0, 120)}`);

    if (!args.dryRun) {
      review.review.verdict = result.verdict;
      review.review.reviewer = "auto-review";
      review.review.reviewed_at = new Date().toISOString();
      review.review.notes = result.notes;
      review.review.security_impact = result.impact;
      await writeFile(reviewPath, JSON.stringify(review, null, 2));
    }

    reviewed++;
    if (result.verdict === "true_positive") truePositives++;
    else if (result.verdict === "false_positive") falsePositives++;
    else needsContext++;
  }

  console.log(`\n--- Auto-Review Summary ---`);
  console.log(`Reviewed: ${reviewed} (skipped ${skipped} already reviewed)`);
  console.log(`True positive: ${truePositives}`);
  console.log(`False positive: ${falsePositives}`);
  console.log(`Needs context: ${needsContext}`);
  if (args.dryRun) console.log(`(dry-run — no files written)`);
}

main().catch((error) => {
  console.error(`auto-review: ${error.message}`);
  process.exit(1);
});
