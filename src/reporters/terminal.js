function formatAnnotations(annotations) {
  const entries = Object.entries(annotations);
  if (entries.length === 0) {
    return "none";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function formatBehavior(behavior) {
  if (!behavior) {
    return "unknown";
  }
  return [
    `readOnlyHint=${behavior.readOnlyHint}`,
    `destructiveHint=${behavior.destructiveHint}`,
    `openWorldHint=${behavior.openWorldHint}`
  ].join(", ");
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
    `Source evidence: ${report.summary.source_evidence ?? 0}`,
    `Project evidence: ${report.summary.project_evidence ?? 0}`,
    `Coverage: ${report.coverage?.extraction_status ?? report.summary.coverage_status ?? "unknown"}`,
    `Handler mapping: ${report.coverage?.handler_mapping_rate ?? "n/a"}`,
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

  if (report.project_evidence?.length > 0) {
    lines.push("Project Evidence:");
    for (const item of report.project_evidence) {
      lines.push(`  - ${item.category} ${item.file}:${item.line}`);
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
        `    tier: ${finding.evidence_tier ?? finding.confidence_tier ?? finding.confidence}`,
        `    declared: ${formatAnnotations(finding.declared_annotations ?? {})}`,
        `    verified: ${formatBehavior(finding.verified_behavior)}`,
        `    evidence: ${location}`
      );
      if (finding.source_parameter) {
        lines.push(`    source: ${finding.source_parameter.name}`);
      }
      if (finding.dangerous_sink) {
        lines.push(`    sink: ${finding.dangerous_sink.sink} (${finding.dangerous_sink.rule_id})`);
      }
      if (finding.validator_status) {
        lines.push(`    validator: ${finding.validator_status.status}`);
      }
      if (finding.repair?.summary) {
        lines.push(`    repair: ${finding.repair.summary}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
