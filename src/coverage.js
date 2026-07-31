import { readFile } from "node:fs/promises";

const SUPPORTED_SOURCE_LANGUAGES = new Set(["typescript", "javascript", "python"]);
const MCP_MARKER_PATTERN = /@modelcontextprotocol\/sdk|FastMCP|McpServer|ModelContextProtocol|ListToolsRequestSchema|tools\/list|\.tool\s*\(|\.registerTool\s*\(|defineTool\s*\(|definePageTool\s*\(/;

function ratio(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return Number((numerator / denominator).toFixed(4));
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

async function hasMcpMarkers(project) {
  for (const filePath of project.files) {
    if (!/\.(ts|tsx|js|mjs|cjs|py|json)$/.test(filePath)) {
      continue;
    }
    try {
      const text = await readFile(filePath, "utf8");
      if (MCP_MARKER_PATTERN.test(text)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function classifyExtraction({ project, tools, unsupported, mcpMarkers }) {
  if (tools.length > 0) {
    return {
      status: "supported",
      reason: "Tool extraction produced at least one MCP tool."
    };
  }

  if (project.unsupported_languages?.length > 0 && project.supported_languages?.length === 0) {
    return {
      status: "unsupported_language",
      reason: `Only unsupported source languages detected: ${project.unsupported_languages.join(", ")}.`
    };
  }

  if (unsupported.length > 0) {
    return {
      status: "unsupported_pattern",
      reason: "MCP-like code was found, but the current extractor could not resolve supported tool definitions."
    };
  }

  if (mcpMarkers) {
    return {
      status: "unsupported_pattern",
      reason: "MCP markers are present, but no supported static tool registration pattern was extracted."
    };
  }

  if (project.languages.length === 0) {
    return {
      status: "not_mcp_server",
      reason: "No supported source files or tools/list metadata files were discovered."
    };
  }

  return {
    status: "not_mcp_server",
    reason: "Source files were discovered, but no MCP markers or tools/list metadata were found."
  };
}

export async function buildCoverage(project, tools, unsupported, analysis) {
  const resolvedHandlers = tools.filter((tool) => tool.handler?.confidence === "resolved").length;
  const metadataOnlyTools = tools.filter((tool) => tool.handler?.confidence === "metadata_only").length;
  const annotationsPresent = tools.filter((tool) => Object.keys(tool.declared_annotations ?? {}).length > 0).length;
  const mcpMarkers = await hasMcpMarkers(project);
  const extraction = classifyExtraction({ project, tools, unsupported, mcpMarkers });
  const evidence = [...(analysis.evidence ?? []), ...(analysis.projectEvidence ?? [])];
  const findings = analysis.findings ?? [];

  return {
    extraction_status: extraction.status,
    extraction_reason: extraction.reason,
    mcp_markers_detected: mcpMarkers,
    tools_extracted: tools.length,
    metadata_only_tools: metadataOnlyTools,
    handlers_resolved: resolvedHandlers,
    handler_mapping_rate: ratio(resolvedHandlers, tools.length - metadataOnlyTools),
    annotation_coverage_rate: ratio(annotationsPresent, tools.length),
    unsupported_patterns: unsupported.length,
    unsupported_languages: project.unsupported_languages ?? [],
    supported_languages: project.supported_languages ?? [],
    file_language_counts: project.file_language_counts ?? {},
    evidence_records_by_tier: countBy(evidence, (item) => item.evidence_tier ?? "unknown"),
    findings_by_tier: countBy(findings, (finding) => finding.evidence_tier ?? finding.confidence_tier ?? "unknown")
  };
}
