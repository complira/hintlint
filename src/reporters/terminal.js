function formatAnnotations(annotations) {
  const entries = Object.entries(annotations);
  if (entries.length === 0) {
    return "none";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

export function renderTerminal(report) {
  const lines = [
    "HintLint Report",
    "===============",
    "",
    `Target: ${report.target}`,
    `Languages: ${report.project.languages.join(", ") || "unknown"}`,
    `Files scanned: ${report.project.files_scanned}`,
    `Tools scanned: ${report.summary.tools_scanned}`,
    `Handlers resolved: ${report.summary.handlers_resolved}`,
    `Annotations present: ${report.summary.annotations_present}`,
    `Findings: ${report.summary.findings}`,
    ""
  ];

  if (report.tools.length > 0) {
    lines.push("Tools:");
    for (const tool of report.tools) {
      lines.push(
        `  - ${tool.name} (${tool.language}) ${tool.source.file}:${tool.source.line}`,
        `    handler: ${tool.handler.confidence}${tool.handler.symbol ? ` ${tool.handler.symbol}` : ""}`,
        `    params: ${tool.input_schema.parameter_names.join(", ") || "none"}`,
        `    annotations: ${formatAnnotations(tool.declared_annotations)}`
      );
    }
    lines.push("");
  }

  if (report.unsupported.length > 0) {
    lines.push("Unsupported:");
    for (const item of report.unsupported) {
      lines.push(`  - ${item.file}:${item.line} ${item.reason}`);
    }
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("Findings:");
    for (const finding of report.findings) {
      const firstEvidence = finding.evidence[0];
      const location = firstEvidence ? `${firstEvidence.file}:${firstEvidence.line}` : "no location";
      lines.push(
        `  - ${finding.id} [${finding.severity}] ${finding.tool}`,
        `    ${finding.message}`,
        `    evidence: ${location}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
