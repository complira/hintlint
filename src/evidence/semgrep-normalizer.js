import { relativeEvidencePath, resolvedToolForLocation } from "./tool-location.js";

const CATEGORY_BY_RULE = new Map([
  // Pattern-only rules
  ["hintlint.database.destructive", "database_mutation"],
  ["hintlint.database.write", "database_mutation"],
  ["hintlint.filesystem.mutation", "filesystem_mutation"],
  ["hintlint.http.mutation", "http_mutation"],
  ["hintlint.external.send", "external_send"],
  ["hintlint.cloud.mutation", "cloud_mutation"],
  ["hintlint.process.execution", "process_execution"],
  ["hintlint.query.execution", "query_execution"],
  ["hintlint.url.user-controlled", "url_construction"],
  ["hintlint.connection-string.user-controlled", "connection_string"],
  // Taint-mode rules (TypeScript/JavaScript)
  ["hintlint.taint.process-execution-ts", "process_execution"],
  ["hintlint.taint.filesystem-write-ts", "filesystem_mutation"],
  ["hintlint.taint.query-injection-ts", "query_execution"],
  ["hintlint.taint.url-ssrf-ts", "url_construction"],
  ["hintlint.taint.connection-string-ts", "connection_string"],
  // Taint-mode rules (Python)
  ["hintlint.taint.process-execution-py", "process_execution"],
  ["hintlint.taint.filesystem-write-py", "filesystem_mutation"],
  ["hintlint.taint.query-injection-py", "query_execution"],
  ["hintlint.taint.url-ssrf-py", "url_construction"],
  ["hintlint.taint.connection-string-py", "connection_string"]
]);

function extractDataflowTrace(result) {
  const trace = result.extra?.dataflow_trace;
  if (!trace || !Array.isArray(trace.intermediate_vars)) {
    return undefined;
  }
  return trace.intermediate_vars
    .filter((v) => v.location?.path && v.location?.start?.line)
    .map((v) => `${v.location.path}:${v.location.start.line}`);
}

function metadata(result) {
  return result.extra?.metadata ?? {};
}

function resultLine(result) {
  return result.start?.line ?? 1;
}

function sourceParameter(tool, meta) {
  const name = meta.hintlint_source_parameter;
  if (!tool || typeof name !== "string") {
    return undefined;
  }
  return {
    name,
    schema_path: `$.tools[?(@.name=="${tool.name}")].input_schema.parameter_names[?(@=="${name}")]`,
    file: tool.source.file,
    line: tool.source.line
  };
}

export function normalizeSemgrepJson(project, tools, semgrepJson) {
  const results = Array.isArray(semgrepJson?.results) ? semgrepJson.results : [];

  return results.map((result) => {
    const meta = metadata(result);
    const file = relativeEvidencePath(project, result.path ?? "");
    const line = resultLine(result);
    const tool = resolvedToolForLocation(tools, file, line);
    const category = meta.hintlint_category ?? CATEGORY_BY_RULE.get(result.check_id) ?? "unknown";
    const evidenceTier = tool ? "L3" : "L2";
    const record = {
      tool: tool?.name ?? null,
      scope: tool ? "tool" : "project",
      category,
      sink_kind: meta.hintlint_sink_kind ?? "unknown",
      sink: meta.hintlint_sink ?? result.extra?.message ?? result.check_id,
      file,
      line,
      source: "semgrep",
      engine: "semgrep",
      rule_id: result.check_id,
      confidence: tool ? "source-backed" : "needs-review",
      evidence_tier: evidenceTier,
      sanitizer: {
        status: meta.hintlint_sanitizer_status ?? "unknown",
        expected: meta.hintlint_sanitizer_expected ?? "unknown"
      }
    };

    const sourceParam = sourceParameter(tool, meta);
    if (sourceParam) {
      record.source_parameter = sourceParam;
    }
    if (meta.hintlint_flow) {
      record.flow = meta.hintlint_flow;
    }
    if (meta.cwe) {
      record.cwe_id = meta.cwe;
    }
    const trace = extractDataflowTrace(result);
    if (trace && trace.length > 0) {
      record.trace = trace;
    }
    return record;
  });
}
