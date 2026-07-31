#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CROSS_VALIDATION = join(ROOT, "benchmark", "results-public", "cross-validation", "summary.json");
const DEFAULT_OUT = join(ROOT, "benchmark", "results-public", "reviews");

function usage() {
  return [
    "Usage: node scripts/generate-review-scaffold.js [options]",
    "",
    "Generate per-finding review templates from cross-validation output.",
    "",
    "Options:",
    "  --input <path>    Cross-validation summary. Default: benchmark/results-public/cross-validation/summary.json",
    "  --out <path>      Review output directory. Default: benchmark/results-public/reviews",
    "  --help            Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: DEFAULT_CROSS_VALIDATION, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--input") { args.input = resolve(argv[++i]); continue; }
    if (arg === "--out") { args.out = resolve(argv[++i]); continue; }
  }
  return args;
}

function evidenceSummary(finding) {
  return (finding.evidence ?? [])
    .map((e) => `${e.source}: ${e.category} at ${e.file}:${e.line}`)
    .join("; ");
}

function reviewFilename(serverId, finding, index) {
  const toolSlug = (finding.tool ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const idSlug = (finding.id ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${serverId}--${toolSlug}--${idSlug}--${index}.json`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const crossValidation = JSON.parse(await readFile(args.input, "utf-8"));
  const perFinding = crossValidation.per_finding ?? [];

  await mkdir(args.out, { recursive: true });

  let generated = 0;

  for (let i = 0; i < perFinding.length; i += 1) {
    const entry = perFinding[i];
    const finding = entry.finding;
    const serverId = entry.server_id;
    const corroboration = entry.corroboration;

    const primaryEvidence = finding.evidence?.[0];

    const review = {
      schema_version: "hintlint.review.v1",
      finding_ref: {
        server_id: serverId,
        tool: finding.tool ?? "unknown",
        finding_id: finding.id ?? "unknown",
        file: primaryEvidence?.file ?? "unknown",
        line: primaryEvidence?.line ?? 0
      },
      finding_details: {
        severity: finding.severity ?? "unknown",
        type: finding.type ?? "unknown",
        message: finding.message ?? "",
        evidence_summary: evidenceSummary(finding),
        declared_annotations: finding.declared_annotations ?? {},
        suggested_annotations: finding.suggested_annotations ?? {}
      },
      corroboration: {
        engines_confirming: corroboration?.engines_confirming ?? ["builtin"],
        engines_no_signal: corroboration?.engines_no_signal ?? [],
        confirmation_count: corroboration?.confirmation_count ?? 1
      },
      review: {
        verdict: null,
        reviewer: null,
        reviewed_at: null,
        security_impact: null,
        suggested_patch: null,
        notes: null
      }
    };

    const filename = reviewFilename(serverId, finding, i);
    await writeFile(join(args.out, filename), JSON.stringify(review, null, 2));
    generated++;
  }

  console.log(`Generated ${generated} review templates in ${args.out}`);
}

main().catch((error) => {
  console.error(`generate-review-scaffold: ${error.message}`);
  process.exit(1);
});
