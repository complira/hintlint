function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function evidenceForTool(report, toolName) {
  return (report.evidence ?? []).filter((item) => item.tool === toolName);
}

function findingsForTool(report, toolName) {
  return (report.findings ?? []).filter((finding) => finding.tool === toolName);
}

function textFor(tool, evidence, findings) {
  return [
    tool.name,
    tool.description,
    ...(tool.input_schema?.parameter_names ?? []),
    ...evidence.map((item) => item.category),
    ...evidence.map((item) => item.sink),
    ...findings.map((finding) => finding.type)
  ].filter(Boolean).join(" ");
}

export function toMlFeatureRecords(report) {
  return report.tools.map((tool) => {
    const evidence = evidenceForTool(report, tool.name);
    const findings = findingsForTool(report, tool.name);
    const unsafeFlows = unique(evidence.map((item) => item.flow));
    return {
      record_version: "hintlint.ml-feature.v1",
      tool: {
        name: tool.name,
        description: tool.description ?? "",
        language: tool.language,
        handler_confidence: tool.handler?.confidence ?? "unknown",
        parameters: tool.input_schema?.parameter_names ?? [],
        source: tool.source
      },
      declared_annotations: tool.declared_annotations,
      evidence: {
        categories: unique(evidence.map((item) => item.category)),
        sink_kinds: unique(evidence.map((item) => item.sink_kind)),
        unsafe_flows: unsafeFlows,
        source_backed: evidence.some((item) => item.confidence === "source-backed")
      },
      findings: findings.map((finding) => ({
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        confidence: finding.confidence
      })),
      text: textFor(tool, evidence, findings)
    };
  });
}

export function renderMlFeatures(report) {
  return `${toMlFeatureRecords(report).map((record) => JSON.stringify(record)).join("\n")}\n`;
}
