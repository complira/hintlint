import { SEVERITY_RANK } from "../policy.js";

const ARTIFACT_VERSION = "hintlint.registry-artifact.v1";

function highestSeverity(findings) {
  let highest = "none";
  for (const finding of findings) {
    if ((SEVERITY_RANK[finding.severity] ?? -1) > (SEVERITY_RANK[highest] ?? -1)) {
      highest = finding.severity;
    }
  }
  return highest;
}

function compactEvidence(evidence) {
  return {
    category: evidence.category,
    sink_kind: evidence.sink_kind,
    sink: evidence.sink,
    file: evidence.file,
    line: evidence.line,
    rule_id: evidence.rule_id,
    confidence: evidence.confidence,
    evidence_tier: evidence.evidence_tier,
    source_parameter: evidence.source_parameter?.name ?? undefined,
    sanitizer_status: evidence.sanitizer?.status ?? undefined
  };
}

function compactFinding(finding) {
  return {
    id: finding.id,
    severity: finding.severity,
    type: finding.type,
    tool: finding.tool,
    confidence: finding.confidence,
    evidence_tier: finding.evidence_tier,
    message: finding.message,
    declared_annotations: finding.declared_annotations,
    verified_behavior: finding.verified_behavior,
    evidence: (finding.evidence ?? []).map(compactEvidence),
    source_parameter: finding.source_parameter,
    dangerous_sink: finding.dangerous_sink,
    validator_status: finding.validator_status,
    suggested_annotations: finding.suggested_annotations,
    repair: finding.repair,
    cwe_id: finding.cwe_id
  };
}

function behaviorForTool(findings, toolName) {
  return findings.find((finding) => finding.tool === toolName)?.verified_behavior ?? null;
}

function toolArtifact(tool, findings) {
  const toolFindings = findings.filter((finding) => finding.tool === tool.name);
  const result = {
    name: tool.name,
    language: tool.language,
    handler_confidence: tool.handler?.confidence ?? "unknown",
    declared_annotations: tool.declared_annotations,
    finding_count: toolFindings.length,
    verified_behavior: behaviorForTool(toolFindings, tool.name)
  };
  if (tool.source) {
    result.source = {
      file: tool.source.file,
      line: tool.source.line
    };
  }
  return result;
}

export function toRegistryArtifact(report, metadata = {}) {
  const server = {
    id: metadata.id ?? metadata.server_id ?? "local-scan",
    name: metadata.name ?? metadata.server_name ?? "Local scan",
    source: metadata.source ?? {
      kind: "local",
      path: report.target
    },
    tags: metadata.tags ?? []
  };

  return {
    artifact_version: ARTIFACT_VERSION,
    generated_at: metadata.generated_at ?? new Date().toISOString(),
    hintlint_version: report.hintlint_version,
    server,
    summary: {
      tools_scanned: report.summary.tools_scanned,
      source_evidence: report.summary.source_evidence,
      project_evidence: report.summary.project_evidence,
      findings: report.summary.findings,
      coverage_status: report.coverage?.extraction_status ?? report.summary.coverage_status,
      handler_mapping_rate: report.coverage?.handler_mapping_rate ?? report.summary.handler_mapping_rate,
      evidence_records_by_tier: report.summary.evidence_records_by_tier,
      findings_by_tier: report.summary.findings_by_tier,
      source_backed_findings: report.findings.filter((finding) => finding.confidence === "source-backed").length,
      highest_severity: highestSeverity(report.findings)
    },
    coverage: report.coverage,
    tools: report.tools.map((tool) => toolArtifact(tool, report.findings)),
    findings: report.findings.map(compactFinding)
  };
}

export function renderRegistryArtifact(report, metadata = {}) {
  return `${JSON.stringify(toRegistryArtifact(report, metadata), null, 2)}\n`;
}
