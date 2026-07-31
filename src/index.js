import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { buildCoverage } from "./coverage.js";
import { discoverProject } from "./project-discovery.js";
import { analyzeTools } from "./evidence/static-detector.js";
import { normalizeSemgrepJson } from "./evidence/semgrep-normalizer.js";
import { scanPython } from "./extractors/python.js";
import { scanToolsListJson } from "./extractors/tools-list-json.js";
import { scanTypeScript } from "./extractors/typescript.js";

export async function runScan(targetPath, options = {}) {
  const startedAt = new Date();
  const root = resolve(targetPath);
  const project = await discoverProject(root);
  const tsResult = await scanTypeScript(project);
  const pyResult = await scanPython(project);
  const toolsListResult = await scanToolsListJson(project);
  const extractedTools = [...tsResult.tools, ...pyResult.tools, ...toolsListResult.tools].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const semgrepEvidence = options.semgrepJsonPath
    ? normalizeSemgrepJson(project, extractedTools, JSON.parse(await readFile(resolve(options.semgrepJsonPath), "utf8")))
    : [];
  const analysis = await analyzeTools(project, extractedTools, { semgrepEvidence });
  const tools = analysis.tools;
  const unsupported = [...tsResult.unsupported, ...pyResult.unsupported, ...toolsListResult.unsupported];
  const coverage = await buildCoverage(project, tools, unsupported, analysis);
  const endedAt = new Date();

  return {
    hintlint_version: "0.1.0",
    scan_started_at: startedAt.toISOString(),
    scan_duration_ms: endedAt.getTime() - startedAt.getTime(),
    target: root,
    project: {
      languages: project.languages,
      files_scanned: project.files.length
    },
    summary: {
      tools_scanned: tools.length,
      handlers_resolved: tools.filter((tool) => tool.handler?.confidence === "resolved").length,
      annotations_present: tools.filter((tool) => Object.keys(tool.declared_annotations).length > 0).length,
      unsupported_patterns: unsupported.length,
      source_evidence: analysis.evidence.length,
      project_evidence: analysis.projectEvidence.length,
      findings: analysis.findings.length,
      coverage_status: coverage.extraction_status,
      handler_mapping_rate: coverage.handler_mapping_rate,
      evidence_records_by_tier: coverage.evidence_records_by_tier,
      findings_by_tier: coverage.findings_by_tier
    },
    coverage,
    tools,
    evidence: analysis.evidence,
    project_evidence: analysis.projectEvidence,
    findings: analysis.findings,
    unsupported,
    options
  };
}
