import { readSourceFile } from "../extractors/common.js";
import { inferVerifiedBehavior, suggestedAnnotationsFor } from "./behavior.js";
import { normalizeFilePath, resolvedToolForLocation } from "./tool-location.js";

const READONLY_FINDING = "HINTLINT-READONLY-001";
const DESTRUCTIVE_FINDING = "HINTLINT-DESTRUCTIVE-001";
const OPEN_WORLD_FINDING = "HINTLINT-OPEN-WORLD-001";
const PROCESS_FLOW_FINDING = "HINTLINT-FLOW-PROCESS-001";
const FILE_FLOW_FINDING = "HINTLINT-FLOW-FILESYSTEM-001";
const QUERY_FLOW_FINDING = "HINTLINT-FLOW-QUERY-001";
const URL_FLOW_FINDING = "HINTLINT-FLOW-URL-001";
const CONNECTION_FLOW_FINDING = "HINTLINT-FLOW-CONNECTION-001";
const VALIDATION_ASYMMETRY_FINDING = "HINTLINT-VALIDATION-ASYMMETRY-001";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|py)$/;
const BUILTIN_ENGINE = "builtin-static-m2";

const SINK_RULES = [
  {
    rule_id: "hintlint.database.destructive",
    languages: ["typescript", "javascript", "python"],
    category: "database_mutation",
    sink_kind: "destructive",
    pattern: /\b(?:db\.)?[\w.]+(?:delete|remove|destroy|drop|truncate)(?:One|Many)?\s*\(|\bDELETE\s+FROM\b|\bDROP\s+TABLE\b/i,
    sink: "database destructive operation"
  },
  {
    rule_id: "hintlint.database.write",
    languages: ["typescript", "javascript", "python"],
    category: "database_mutation",
    sink_kind: "write",
    pattern: /\b(?:db\.)?[\w.]+(?:create|update|upsert|insert|save)\s*\(|\bINSERT\s+INTO\b|\bUPDATE\s+[\w.]+\s+SET\b/i,
    sink: "database write operation"
  },
  {
    rule_id: "hintlint.filesystem.mutation",
    languages: ["typescript", "javascript", "python"],
    category: "filesystem_mutation",
    sink_kind: "write",
    flow: "filesystem",
    source_param_pattern: /path|file|dest|directory|artifact/i,
    pattern: /\bopen\s*\([^)]*(?:destination|path|file|artifact)[^)]*["'](?:w|a|wb|ab)["']|\bcreateWriteStream\s*\(|\bwriteFile(?:Sync)?\s*\(|\bmkdir(?:Sync)?\s*\(|\bos\.path\.abspath\s*\(|\bshutil\.rmtree\s*\(/i,
    sink: "filesystem mutation",
    cwe_id: "CWE-22",
    sanitizer_expected: "path root containment with an allowed base directory"
  },
  {
    rule_id: "hintlint.http.mutation",
    languages: ["typescript", "javascript", "python"],
    category: "http_mutation",
    sink_kind: "external_mutation",
    pattern: /\bfetch\s*\([^)]*method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']|\brequests\.(?:post|put|patch|delete)\s*\(|\bhttpx\.(?:post|put|patch|delete)\s*\(/i,
    sink: "HTTP mutation request"
  },
  {
    rule_id: "hintlint.external.send",
    languages: ["typescript", "javascript", "python"],
    category: "external_send",
    sink_kind: "external_mutation",
    pattern: /\bsendgrid\.send\s*\(|\bstripe\.[\w.]+\.create\s*\(|\bmail\.[\w.]*send\s*\(|\bemail_client\.send\s*\(/i,
    sink: "external send/payment operation"
  },
  {
    rule_id: "hintlint.cloud.mutation",
    languages: ["typescript", "javascript", "python"],
    category: "cloud_mutation",
    sink_kind: "destructive",
    pattern: /\b(?:deleteRef|delete[A-Z]\w*|terminate[A-Z]\w*|az\s+[\w-]+\s+delete)\b/i,
    sink: "cloud destructive/update operation"
  },
  {
    rule_id: "hintlint.process.execution",
    languages: ["typescript", "javascript", "python"],
    category: "process_execution",
    sink_kind: "execute",
    flow: "process",
    source_param_pattern: /command|cmd|script|args?/i,
    pattern: /\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\(|\bchild_process\.(?:exec|spawn|execFile)\s*\(|\bexecSync\s*\(|\bspawnSync\s*\(/i,
    sink: "process execution",
    cwe_id: "CWE-78",
    sanitizer_expected: "server-side command allowlist"
  },
  {
    rule_id: "hintlint.query.execution",
    languages: ["typescript", "javascript", "python"],
    category: "query_execution",
    sink_kind: "query",
    flow: "query",
    source_param_pattern: /query|sql|kql|statement|table/i,
    pattern: /\b(?:cursor|conn|connection|client|kustoClient)\.(?:execute|ExecuteReaderAsync|ExecuteQueryCommandAsync)\s*\([^)]*(?:query|sql|kql|statement|table)|\bNpgsqlCommand\s*\([^)]*(?:query|sql|table)/i,
    sink: "query execution",
    cwe_id: "CWE-89",
    sanitizer_expected: "parameter binding or strict query allowlist"
  },
  {
    rule_id: "hintlint.url.user-controlled",
    languages: ["typescript", "javascript", "python"],
    category: "url_construction",
    sink_kind: "external_boundary",
    flow: "url",
    source_param_pattern: /url|uri|host|endpoint|account|vault|server|service|cluster|owner|repo/i,
    pattern: /https?:\/\/[^"']*(?:\$\{|%s|format\(|\{(?:account|vault|server|service|cluster|endpoint|host|url|uri)[\w_]*\})|\brequests\.get\s*\(\s*(?:url|endpoint|uri|host)|\bfetch\s*\(\s*(?:url|endpoint|uri|host)/i,
    sink: "user-controlled URL construction",
    cwe_id: "CWE-918",
    sanitizer_expected: "strict host or resource-name allowlist"
  },
  {
    rule_id: "hintlint.connection-string.user-controlled",
    languages: ["typescript", "javascript", "python"],
    category: "connection_string",
    sink_kind: "credential_boundary",
    flow: "connection_string",
    source_param_pattern: /database|connection|host|server|user/i,
    pattern: /(?:Host|Server|Database|Username|Password)=.*\{(?:database|host|server|user|connection)[\w_]*\}|connectionString\s*=|connection_string\s*=/i,
    sink: "connection string construction",
    cwe_id: "CWE-88",
    sanitizer_expected: "connection string builder or delimiter rejection"
  }
];

function languageForFile(filePath) {
  if (/\.(ts|tsx)$/.test(filePath)) {
    return "typescript";
  }
  if (/\.(js|mjs|cjs)$/.test(filePath)) {
    return "javascript";
  }
  if (filePath.endsWith(".py")) {
    return "python";
  }
  return "unknown";
}

function lineOffsetFor(text, pattern) {
  const index = text.search(pattern);
  if (index === -1) {
    return 0;
  }
  return text.slice(0, index).split("\n").length - 1;
}

function matchedSink(text, pattern, fallback) {
  const match = text.match(pattern);
  return match ? match[0].replace(/\s+/g, " ").trim().slice(0, 160) : fallback;
}

function sourceParameter(tool, rule, lineText = "") {
  if (!rule.source_param_pattern) {
    return undefined;
  }
  const params = tool?.input_schema?.parameter_names ?? [];
  const name = params.find((param) => rule.source_param_pattern.test(param) && new RegExp(`\\b${param}\\b`).test(lineText))
    ?? params.find((param) => rule.source_param_pattern.test(param));
  if (!name || !tool) {
    return undefined;
  }
  return {
    name,
    schema_path: `$.tools[?(@.name=="${tool.name}")].input_schema.parameter_names[?(@=="${name}")]`,
    file: tool.source.file,
    line: tool.source.line
  };
}

function hasStrictAllowlist(text, paramName) {
  if (!paramName) {
    return false;
  }
  const escaped = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:fullmatch|match|test)\\s*\\([^\\n]*(?:\\^\\[a-z0-9\\]|\\^\\[A-Za-z0-9_|validate_${escaped}|${escaped}[^\\n]*(?:allowed|allowlist))`, "i").test(text)
    || new RegExp(`validate_(?:resource_|account_|host_|url_)?name\\s*\\(\\s*${escaped}\\s*\\)`, "i").test(text);
}

function hasQuerySanitizer(text, paramName) {
  if (!paramName) {
    return false;
  }
  const escaped = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`validate_(?:query|sql|kql|table|query_safety)\\s*\\(\\s*${escaped}\\s*\\)`, "i").test(text)
    || new RegExp(`(?:cursor|conn|connection|client)\\.execute\\s*\\(\\s*["'\`][\\s\\S]*?["'\`]\\s*,\\s*(?:\\(|\\[|\\{)`, "i").test(text);
}

function hasPathContainment(text) {
  return /\bcommonpath\s*\(|\.starts?With\s*\(\s*ALLOWED_ROOT|\.startswith\s*\(\s*ALLOWED_ROOT|\brelative_to\s*\(|\bpath\.resolve\s*\(\s*ALLOWED_ROOT/i.test(text);
}

function hasProcessAllowlist(text, paramName) {
  if (!paramName) {
    return false;
  }
  const escaped = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`ALLOWED_(?:COMMANDS|TOOLS)|allowed_(?:commands|tools)|if\\s+${escaped}\\s+not\\s+in\\s+`, "i").test(text);
}

function hasConnectionStringSanitizer(text, paramName) {
  if (!paramName) {
    return false;
  }
  const escaped = paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /ConnectionStringBuilder|connection_string_builder/i.test(text)
    || new RegExp(`(?:reject|validate).*${escaped}.*[;=]|${escaped}.*(?:reject|validate).*[;=]`, "i").test(text);
}

function sanitizerFor(rule, tool, text, sourceParam) {
  if (!rule.flow) {
    return {
      status: "not_applicable",
      expected: "not applicable"
    };
  }

  const paramName = sourceParam?.name;
  const found = (
    (rule.flow === "query" && hasQuerySanitizer(text, paramName)) ||
    (rule.flow === "url" && hasStrictAllowlist(text, paramName)) ||
    (rule.flow === "filesystem" && hasPathContainment(text)) ||
    (rule.flow === "process" && hasProcessAllowlist(text, paramName)) ||
    (rule.flow === "connection_string" && hasConnectionStringSanitizer(text, paramName))
  );

  return {
    status: found ? "found" : "not_found",
    expected: rule.sanitizer_expected
  };
}

function evidenceRecord({ tool, rule, file, line, lineText, sourceText, scope, confidence }) {
  const sourceParam = scope === "tool" ? sourceParameter(tool, rule, lineText) : undefined;
  const record = {
    tool: tool?.name ?? null,
    scope,
    category: rule.category,
    sink_kind: rule.sink_kind,
    sink: matchedSink(lineText, rule.pattern, rule.sink),
    file,
    line,
    source: BUILTIN_ENGINE,
    engine: "builtin",
    rule_id: rule.rule_id,
    confidence,
    sanitizer: sanitizerFor(rule, tool, sourceText, sourceParam)
  };
  if (rule.flow) {
    record.flow = rule.flow;
  }
  if (sourceParam) {
    record.source_parameter = sourceParam;
  }
  if (rule.cwe_id) {
    record.cwe_id = rule.cwe_id;
  }
  return record;
}

function detectEvidenceInText({ tool, file, language, text, startLine, scope, confidence }) {
  const detected = [];
  const lines = text.split("\n");

  for (const rule of SINK_RULES) {
    if (!rule.languages.includes(language)) {
      continue;
    }
    const lineIndex = lineOffsetFor(text, rule.pattern);
    if (lineIndex === 0 && !rule.pattern.test(text)) {
      continue;
    }
    const lineText = lines[lineIndex] ?? "";
    detected.push(evidenceRecord({
      tool,
      rule,
      file,
      line: startLine + lineIndex,
      lineText,
      sourceText: text,
      scope,
      confidence
    }));
  }

  return detected;
}

function publicTool(tool) {
  const { _analysis, ...rest } = tool;
  return rest;
}

function firstEvidence(findingEvidence) {
  return findingEvidence[0] ?? null;
}

function dangerousSink(findingEvidence) {
  const evidence = firstEvidence(findingEvidence);
  if (!evidence) {
    return undefined;
  }
  return {
    category: evidence.category,
    sink_kind: evidence.sink_kind,
    sink: evidence.sink,
    file: evidence.file,
    line: evidence.line,
    rule_id: evidence.rule_id
  };
}

function firstSourceParameter(findingEvidence) {
  return findingEvidence.find((item) => item.source_parameter)?.source_parameter;
}

function validatorStatus(findingEvidence) {
  const evidence = firstEvidence(findingEvidence);
  return evidence?.sanitizer
    ? {
        status: evidence.sanitizer.status,
        expected: evidence.sanitizer.expected
      }
    : undefined;
}

function annotationRepair(summary, suggestedAnnotations) {
  return {
    type: "annotation_patch",
    summary,
    suggested_annotations: suggestedAnnotations
  };
}

function validationRepair(summary, guidance) {
  return {
    type: "server_side_validation",
    summary,
    guidance
  };
}

function finding({
  id,
  severity,
  type,
  tool,
  message,
  evidence: findingEvidence,
  behavior,
  repair,
  suggestedAnnotations = undefined,
  cweId = undefined,
  includeFlowDetails = false
}) {
  const result = {
    id,
    severity,
    type,
    tool: tool.name,
    confidence: "source-backed",
    confidence_tier: "source-backed",
    message,
    declared_annotations: tool.declared_annotations,
    verified_behavior: behavior ?? inferVerifiedBehavior(findingEvidence),
    evidence: findingEvidence
  };
  if (cweId) {
    result.cwe_id = cweId;
  }
  if (includeFlowDetails) {
    result.source_parameter = firstSourceParameter(findingEvidence);
    result.dangerous_sink = dangerousSink(findingEvidence);
    result.validator_status = validatorStatus(findingEvidence);
  }
  if (repair) {
    result.repair = repair;
  }
  if (suggestedAnnotations) {
    result.suggested_annotations = suggestedAnnotations;
  }
  return result;
}

function compareAnnotations(tool, sinkEvidence) {
  const findings = [];
  const behavior = inferVerifiedBehavior(sinkEvidence);
  const declared = tool.declared_annotations;

  if (declared.readOnlyHint === true && behavior.readOnlyHint === false) {
    const suggestedAnnotations = suggestedAnnotationsFor(declared, behavior);
    findings.push(finding({
      id: READONLY_FINDING,
      severity: "high",
      type: "false_readonly",
      tool,
      message: `Tool '${tool.name}' declares readOnlyHint=true but source evidence shows state mutation, external side effect, or process execution.`,
      evidence: sinkEvidence,
      behavior,
      repair: annotationRepair("Set readOnlyHint=false and align destructive/open-world hints with the verified behavior.", suggestedAnnotations),
      suggestedAnnotations
    }));
  }

  if (behavior.destructiveHint === true && declared.readOnlyHint !== true && declared.destructiveHint !== true) {
    findings.push(finding({
      id: DESTRUCTIVE_FINDING,
      severity: "high",
      type: "missing_or_false_destructive_hint",
      tool,
      message: `Tool '${tool.name}' reaches destructive or process-execution evidence but does not declare destructiveHint=true.`,
      evidence: sinkEvidence.filter((item) => item.sink_kind === "destructive" || item.category === "process_execution"),
      behavior,
      repair: annotationRepair("Set destructiveHint=true and require approval before automatic invocation.", suggestedAnnotationsFor(declared, behavior)),
      suggestedAnnotations: suggestedAnnotationsFor(declared, behavior)
    }));
  }

  if (behavior.openWorldHint === true && declared.openWorldHint === false) {
    findings.push(finding({
      id: OPEN_WORLD_FINDING,
      severity: "medium",
      type: "false_open_world",
      tool,
      message: `Tool '${tool.name}' declares openWorldHint=false but source evidence reaches an external side effect, network boundary, or process execution.`,
      evidence: sinkEvidence.filter((item) => ["external_send", "http_mutation", "cloud_mutation", "process_execution", "url_construction"].includes(item.category)),
      behavior,
      repair: annotationRepair("Set openWorldHint=true because the handler crosses a network or external boundary.", suggestedAnnotationsFor(declared, behavior)),
      suggestedAnnotations: suggestedAnnotationsFor(declared, behavior)
    }));
  }

  return findings;
}

function unsafeFlowEvidence(sinkEvidence, flow) {
  return sinkEvidence.filter((item) => item.flow === flow && item.sanitizer?.status !== "found");
}

function detectUnsafeFlows(tool, sinkEvidence) {
  const findings = [];
  const behavior = inferVerifiedBehavior(sinkEvidence);

  const processEvidence = unsafeFlowEvidence(sinkEvidence, "process");
  if (processEvidence.length > 0) {
    findings.push(finding({
      id: PROCESS_FLOW_FINDING,
      severity: "critical",
      type: "tool_input_to_process_execution",
      tool,
      message: `Tool '${tool.name}' has command-like MCP parameters and reaches process execution. Enforce a server-side allowlist; tool descriptions or LLM confirmation are not security controls.`,
      evidence: processEvidence,
      behavior,
      cweId: "CWE-78",
      includeFlowDetails: true,
      repair: validationRepair(
        "Add a server-side command allowlist before invoking process execution.",
        "Accept a fixed command enum or map caller intent to approved subcommands; never pass raw tool input to exec/spawn."
      )
    }));
  }

  const pathEvidence = unsafeFlowEvidence(sinkEvidence, "filesystem");
  if (pathEvidence.length > 0) {
    findings.push(finding({
      id: FILE_FLOW_FINDING,
      severity: "high",
      type: "tool_input_to_filesystem_write",
      tool,
      message: `Tool '${tool.name}' has path-like MCP parameters and reaches filesystem write/path operations. Validate containment under an allowed root before writing.`,
      evidence: pathEvidence,
      behavior,
      cweId: "CWE-22",
      includeFlowDetails: true,
      repair: validationRepair(
        "Resolve destination paths under an allowed root and reject traversal before writing.",
        "Join caller paths to a configured base directory, normalize, then verify containment before mkdir/open/write."
      )
    }));
  }

  const queryEvidence = unsafeFlowEvidence(sinkEvidence, "query");
  if (queryEvidence.length > 0) {
    findings.push(finding({
      id: QUERY_FLOW_FINDING,
      severity: "critical",
      type: "tool_input_to_query_execution",
      tool,
      message: `Tool '${tool.name}' has query-like MCP parameters and reaches query execution without recognized binding or allowlist validation.`,
      evidence: queryEvidence,
      behavior,
      cweId: "CWE-89",
      includeFlowDetails: true,
      repair: validationRepair(
        "Use parameter binding or a strict query allowlist before execution.",
        "Do not execute caller-provided SQL/KQL directly. Bind values or map requests to reviewed query templates."
      )
    }));
  }

  const urlEvidence = unsafeFlowEvidence(sinkEvidence, "url");
  if (urlEvidence.length > 0) {
    findings.push(finding({
      id: URL_FLOW_FINDING,
      severity: "high",
      type: "tool_input_to_url_construction",
      tool,
      message: `Tool '${tool.name}' has host or URL-like MCP parameters and constructs an external URL without recognized allowlist validation.`,
      evidence: urlEvidence,
      behavior,
      cweId: "CWE-918",
      includeFlowDetails: true,
      repair: validationRepair(
        "Validate host/resource names with a strict allowlist before constructing outbound URLs.",
        "For cloud resource names, enforce provider-specific regexes and reject full URLs unless the endpoint is pre-approved."
      )
    }));
  }

  const connectionEvidence = unsafeFlowEvidence(sinkEvidence, "connection_string");
  if (connectionEvidence.length > 0) {
    findings.push(finding({
      id: CONNECTION_FLOW_FINDING,
      severity: "high",
      type: "tool_input_to_connection_string",
      tool,
      message: `Tool '${tool.name}' has connection-string-relevant MCP parameters and builds a structured connection string without recognized delimiter protection.`,
      evidence: connectionEvidence,
      behavior,
      cweId: "CWE-88",
      includeFlowDetails: true,
      repair: validationRepair(
        "Use a connection-string builder or reject delimiter characters in caller-controlled fields.",
        "Reject semicolons and equals signs in structured connection-string fields so later parameters cannot override earlier values."
      )
    }));
  }

  return findings;
}

function detectValidationAsymmetry(tools, evidenceByTool) {
  const findings = [];
  const queryTools = tools
    .filter((tool) => tool.handler?.confidence === "resolved")
    .map((tool) => ({
      tool,
      evidence: evidenceByTool.get(tool.name) ?? [],
      queryEvidence: (evidenceByTool.get(tool.name) ?? []).filter((item) => item.flow === "query")
    }))
    .filter((entry) => entry.queryEvidence.length > 0);

  const validated = queryTools.filter((entry) =>
    entry.queryEvidence.some((item) => item.sanitizer?.status === "found")
  );
  const unvalidated = queryTools.filter((entry) =>
    entry.queryEvidence.some((item) => item.sanitizer?.status !== "found")
  );

  for (const unsafe of unvalidated) {
    const sibling = validated.find((safe) =>
      safe.tool.name !== unsafe.tool.name &&
      safe.tool.input_schema.parameter_names.some((param) => unsafe.tool.input_schema.parameter_names.includes(param))
    );
    if (!sibling) {
      continue;
    }
    findings.push(finding({
      id: VALIDATION_ASYMMETRY_FINDING,
      severity: "medium",
      type: "validation_asymmetry",
      tool: unsafe.tool,
      message: `Tool '${unsafe.tool.name}' reaches query execution without recognized validation, while sibling tool '${sibling.tool.name}' validates the same query-shaped input.`,
      evidence: unsafe.queryEvidence.filter((item) => item.sanitizer?.status !== "found"),
      behavior: inferVerifiedBehavior(unsafe.evidence),
      cweId: "CWE-89",
      includeFlowDetails: true,
      repair: validationRepair(
        `Port the validation pattern from sibling tool '${sibling.tool.name}' or document why it is not applicable.`,
        "When parallel MCP tools accept the same query-shaped input, validators should be consistently applied across sibling implementations."
      )
    }));
  }

  return findings;
}

async function detectProjectEvidence(project, tools) {
  const projectEvidence = [];

  for (const filePath of project.files.filter((file) => SOURCE_EXTENSIONS.test(file))) {
    const sourceFile = await readSourceFile(filePath);
    const relativeFile = project.relativePath(filePath);
    const language = languageForFile(relativeFile);
    for (const rule of SINK_RULES) {
      if (!rule.languages.includes(language)) {
        continue;
      }
      const lines = sourceFile.text.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = index + 1;
        if (!rule.pattern.test(lines[index])) {
          continue;
        }
        if (resolvedToolForLocation(tools, relativeFile, line)) {
          continue;
        }
        projectEvidence.push(evidenceRecord({
          tool: null,
          rule,
          file: relativeFile,
          line,
          lineText: lines[index],
          sourceText: lines[index],
          scope: "project",
          confidence: "needs-review"
        }));
      }
    }
  }

  return projectEvidence;
}

function mergeEvidence(primary, additional) {
  const seen = new Set();
  const merged = [];
  for (const item of [...primary, ...additional]) {
    const key = `${item.scope}:${item.tool ?? ""}:${normalizeFilePath(item.file)}:${item.line}:${item.rule_id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export async function analyzeTools(project, tools, options = {}) {
  const findings = [];
  const publicTools = [];
  const toolEvidence = [];
  const evidenceByTool = new Map();

  for (const tool of tools) {
    if (tool.handler?.confidence !== "resolved") {
      publicTools.push(publicTool(tool));
      continue;
    }

    const evidence = detectEvidenceInText({
      tool,
      file: tool.handler.file,
      language: tool.language,
      text: tool._analysis?.text ?? "",
      startLine: tool._analysis?.start_line ?? tool.handler.line,
      scope: "tool",
      confidence: "source-backed"
    });
    evidenceByTool.set(tool.name, evidence);
    toolEvidence.push(...evidence);
    findings.push(...compareAnnotations(tool, evidence));
    findings.push(...detectUnsafeFlows(tool, evidence));
    publicTools.push(publicTool(tool));
  }

  findings.push(...detectValidationAsymmetry(tools, evidenceByTool));

  const semgrepEvidence = options.semgrepEvidence ?? [];
  const semgrepToolEvidence = semgrepEvidence.filter((item) => item.scope === "tool");
  const semgrepProjectEvidence = semgrepEvidence.filter((item) => item.scope === "project");
  const projectEvidence = mergeEvidence(await detectProjectEvidence(project, tools), semgrepProjectEvidence);

  return {
    tools: publicTools,
    evidence: mergeEvidence(toolEvidence, semgrepToolEvidence),
    projectEvidence,
    findings
  };
}
