#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runScan } from "../src/index.js";
import { SEVERITY_RANK } from "../src/policy.js";
import { toRegistryArtifact } from "../src/reporters/registry-artifact.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = join(ROOT, "benchmark", "manifest.json");
const DEFAULT_OUT = join(ROOT, "benchmark", "results");

function usage() {
  return [
    "Usage: node scripts/scan-benchmark.js [options]",
    "",
    "Options:",
    "  --manifest <path>      Benchmark manifest. Default: benchmark/manifest.json",
    "  --out <path>           Output directory. Default: benchmark/results",
    "  --include-disabled     Include disabled manifest entries",
    "  --help                 Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    out: DEFAULT_OUT,
    includeDisabled: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (arg === "--manifest") {
      args.manifest = resolve(argv[++index]);
      continue;
    }
    if (arg === "--out") {
      args.out = resolve(argv[++index]);
      continue;
    }
    if (arg === "--include-disabled") {
      args.includeDisabled = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveSourcePath(manifestDir, server) {
  if (!server.source?.path) {
    return null;
  }
  return resolve(manifestDir, server.source.path);
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function severitySort(a, b) {
  return (SEVERITY_RANK[b.severity] ?? -1) - (SEVERITY_RANK[a.severity] ?? -1)
    || a.server_id.localeCompare(b.server_id)
    || a.tool.localeCompare(b.tool)
    || a.id.localeCompare(b.id);
}

function aggregate(manifest, manifestPath, scans, skipped, failures, generatedAt) {
  const severityCounts = {};
  const findingIdCounts = {};
  const findingTypeCounts = {};
  const allFindings = [];

  for (const scan of scans) {
    for (const finding of scan.report.findings) {
      increment(severityCounts, finding.severity);
      increment(findingIdCounts, finding.id);
      increment(findingTypeCounts, finding.type);
      allFindings.push({
        server_id: scan.server.id,
        server_name: scan.server.name,
        id: finding.id,
        severity: finding.severity,
        type: finding.type,
        tool: finding.tool,
        confidence: finding.confidence,
        message: finding.message,
        evidence: (finding.evidence ?? []).slice(0, 2).map((item) => ({
          file: item.file,
          line: item.line,
          category: item.category,
          sink: item.sink
        }))
      });
    }
  }

  const sourceBackedFindings = allFindings.filter((finding) => finding.confidence === "source-backed");
  const annotationDriftTypes = new Set([
    "false_readonly",
    "missing_or_false_destructive_hint",
    "false_open_world"
  ]);

  return {
    artifact_version: "hintlint.benchmark-summary.v1",
    generated_at: generatedAt,
    manifest: {
      name: manifest.name,
      path: relative(ROOT, manifestPath),
      claim_level: manifest.methodology?.claim_level ?? "curated",
      scope: manifest.methodology?.scope ?? ""
    },
    totals: {
      servers_configured: manifest.servers.length,
      servers_scanned: scans.length,
      servers_skipped: skipped.length,
      servers_failed: failures.length,
      tools_scanned: scans.reduce((sum, scan) => sum + scan.report.summary.tools_scanned, 0),
      handlers_resolved: scans.reduce((sum, scan) => sum + scan.report.summary.handlers_resolved, 0),
      source_evidence: scans.reduce((sum, scan) => sum + scan.report.summary.source_evidence, 0),
      project_evidence: scans.reduce((sum, scan) => sum + scan.report.summary.project_evidence, 0),
      findings: allFindings.length,
      source_backed_findings: sourceBackedFindings.length,
      annotation_drift_findings: sourceBackedFindings.filter((finding) => annotationDriftTypes.has(finding.type)).length,
      unsafe_flow_findings: sourceBackedFindings.filter((finding) => finding.id.startsWith("HINTLINT-FLOW-")).length,
      validation_findings: sourceBackedFindings.filter((finding) => finding.id.startsWith("HINTLINT-VALIDATION-")).length
    },
    counts_by_severity: sortedObject(severityCounts),
    counts_by_finding_id: sortedObject(findingIdCounts),
    counts_by_finding_type: sortedObject(findingTypeCounts),
    servers: scans.map((scan) => ({
      id: scan.server.id,
      name: scan.server.name,
      tags: scan.server.tags ?? [],
      tools_scanned: scan.report.summary.tools_scanned,
      source_evidence: scan.report.summary.source_evidence,
      findings: scan.report.summary.findings,
      source_backed_findings: scan.report.findings.filter((finding) => finding.confidence === "source-backed").length,
      raw_report: relative(ROOT, scan.reportPath),
      registry_artifact: relative(ROOT, scan.artifactPath)
    })),
    top_findings: allFindings.sort(severitySort).slice(0, 25),
    skipped,
    failures
  };
}

function markdownTable(headers, rows) {
  if (rows.length === 0) {
    return "None.\n";
  }
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n") + "\n";
}

function renderMarkdown(summary, manifest) {
  const countRows = Object.entries(summary.counts_by_finding_id).map(([id, count]) => [id, String(count)]);
  const serverRows = summary.servers.map((server) => [
    server.id,
    String(server.tools_scanned),
    String(server.source_evidence),
    String(server.findings),
    String(server.source_backed_findings)
  ]);
  const findingRows = summary.top_findings.slice(0, 12).map((finding) => [
    finding.server_id,
    finding.tool,
    finding.severity,
    finding.id,
    finding.evidence[0] ? `${finding.evidence[0].file}:${finding.evidence[0].line}` : "n/a"
  ]);

  return [
    "# HintLint Annotation Drift Report",
    "",
    `Generated: ${summary.generated_at}`,
    "",
    "## Scope",
    "",
    manifest.methodology?.scope ?? "Curated source-available MCP server scan.",
    "",
    `Claim level: ${summary.manifest.claim_level}`,
    "",
    "This report counts only source-backed HintLint findings as evidence. Metadata-only scans and skipped entries are not treated as proof.",
    "",
    "## Aggregate Stats",
    "",
    `- Servers scanned: ${summary.totals.servers_scanned}`,
    `- Tools scanned: ${summary.totals.tools_scanned}`,
    `- Source evidence records: ${summary.totals.source_evidence}`,
    `- Findings: ${summary.totals.findings}`,
    `- Source-backed findings: ${summary.totals.source_backed_findings}`,
    `- Annotation drift findings: ${summary.totals.annotation_drift_findings}`,
    `- Unsafe-flow findings: ${summary.totals.unsafe_flow_findings}`,
    `- Validation-asymmetry findings: ${summary.totals.validation_findings}`,
    "",
    "## Finding Counts",
    "",
    markdownTable(["Finding", "Count"], countRows),
    "## Server Results",
    "",
    markdownTable(["Server", "Tools", "Evidence", "Findings", "Source-backed"], serverRows),
    "## Top Source-Backed Findings",
    "",
    markdownTable(["Server", "Tool", "Severity", "Finding", "Evidence"], findingRows),
    "## Methodology",
    "",
    "- Run `node scripts/scan-benchmark.js` from the repository root.",
    "- The script scans enabled entries from `benchmark/manifest.json`.",
    "- Raw HintLint reports are written to `benchmark/results/reports/`.",
    "- Registry artifacts are written to `benchmark/results/registry/`.",
    "- Aggregate stats are written to `benchmark/results/summary.json`.",
    "",
    "## Constraints",
    "",
    "- This checked-in run uses local fixtures, not a public ecosystem sample.",
    "- Public prevalence claims require a curated external manifest and reproducible commit pins.",
    "- Semgrep live execution remains deferred unless Semgrep JSON is supplied separately.",
    "- Upstream maintainer PRs are not opened by this script.",
    ""
  ].join("\n");
}

async function scanBenchmark(args) {
  const manifestPath = resolve(args.manifest);
  const manifestDir = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outDir = resolve(args.out);
  const reportsDir = join(outDir, "reports");
  const registryDir = join(outDir, "registry");
  const generatedAt = new Date().toISOString();

  await mkdir(reportsDir, { recursive: true });
  await mkdir(registryDir, { recursive: true });

  const scans = [];
  const skipped = [];
  const failures = [];

  for (const server of manifest.servers) {
    if (!server.enabled && !args.includeDisabled) {
      skipped.push({ id: server.id, reason: "disabled" });
      continue;
    }

    const targetPath = resolveSourcePath(manifestDir, server);
    if (!targetPath) {
      skipped.push({ id: server.id, reason: "source.path is required for local benchmark scans" });
      continue;
    }
    if (!(await exists(targetPath))) {
      failures.push({ id: server.id, reason: `target path does not exist: ${targetPath}` });
      continue;
    }

    try {
      const report = await runScan(targetPath);
      report.target = relative(ROOT, targetPath);
      const reportPath = join(reportsDir, `${server.id}.json`);
      const artifactPath = join(registryDir, `${server.id}.registry.json`);
      const artifact = toRegistryArtifact(report, {
        id: server.id,
        name: server.name,
        source: server.source,
        tags: server.tags ?? [],
        generated_at: generatedAt
      });
      await writeJson(reportPath, report);
      await writeJson(artifactPath, artifact);
      scans.push({ server, report, reportPath, artifactPath });
    } catch (error) {
      failures.push({ id: server.id, reason: error.message });
    }
  }

  const summary = aggregate(manifest, manifestPath, scans, skipped, failures, generatedAt);
  await writeJson(join(outDir, "summary.json"), summary);
  await writeFile(join(outDir, "annotation-drift-report.md"), renderMarkdown(summary, manifest), "utf8");

  console.log([
    `HintLint benchmark: ${manifest.name}`,
    `servers scanned: ${summary.totals.servers_scanned}`,
    `tools scanned: ${summary.totals.tools_scanned}`,
    `source-backed findings: ${summary.totals.source_backed_findings}`,
    `report: ${relative(ROOT, join(outDir, "annotation-drift-report.md"))}`
  ].join("\n"));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
} else {
  scanBenchmark(args).catch((error) => {
    console.error(`hintlint benchmark: ${error.message}`);
    process.exitCode = 2;
  });
}
