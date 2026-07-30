const READONLY_FINDING = "HINTLINT-READONLY-001";
const DESTRUCTIVE_FINDING = "HINTLINT-DESTRUCTIVE-001";
const OPEN_WORLD_FINDING = "HINTLINT-OPEN-WORLD-001";
const PROCESS_FLOW_FINDING = "HINTLINT-FLOW-PROCESS-001";
const FILE_FLOW_FINDING = "HINTLINT-FLOW-FILESYSTEM-001";

function evidence(tool, category, sink, lineOffset = 0) {
  return {
    tool: tool.name,
    category,
    sink,
    file: tool.handler.file,
    line: (tool._analysis?.start_line ?? tool.handler.line) + lineOffset,
    source: "builtin-static-mvp",
    confidence: "source-backed"
  };
}

function lineOffsetFor(text, pattern) {
  const index = text.search(pattern);
  if (index === -1) {
    return 0;
  }
  return text.slice(0, index).split("\n").length - 1;
}

function detectSinkEvidence(tool) {
  const text = tool._analysis?.text ?? "";
  const detected = [];

  const destructivePatterns = [
    /\bdelete(?:One|Many)?\s*\(/,
    /\.(?:delete|remove|destroy|drop|truncate)\s*\(/,
    /\bDELETE\s+FROM\b/i,
    /\bDROP\s+TABLE\b/i
  ];
  for (const pattern of destructivePatterns) {
    if (pattern.test(text)) {
      detected.push(evidence(tool, "destructive_write", pattern.source, lineOffsetFor(text, pattern)));
      break;
    }
  }

  const writePatterns = [
    /\.(?:create|update|upsert|insert|save)\s*\(/,
    /\b(?:INSERT|UPDATE)\s+/i,
    /\bopen\s*\([^)]*["'](?:w|a|wb|ab)["']/,
    /\bcreateWriteStream\s*\(/,
    /\bwriteFile(?:Sync)?\s*\(/
  ];
  for (const pattern of writePatterns) {
    if (pattern.test(text)) {
      detected.push(evidence(tool, "write", pattern.source, lineOffsetFor(text, pattern)));
      break;
    }
  }

  const externalPatterns = [
    /\bsendgrid\.send\s*\(/,
    /\bstripe\.[\w.]+\.create\s*\(/,
    /\bfetch\s*\(/,
    /\brequests\.(?:get|post|put|patch|delete)\s*\(/,
    /\bhttpx\.(?:get|post|put|patch|delete)\s*\(/
  ];
  for (const pattern of externalPatterns) {
    if (pattern.test(text)) {
      detected.push(evidence(tool, "external_side_effect", pattern.source, lineOffsetFor(text, pattern)));
      break;
    }
  }

  const processPatterns = [
    /\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\(/,
    /\bchild_process\.(?:exec|spawn|execFile)\s*\(/,
    /\bexecSync\s*\(/,
    /\bspawnSync\s*\(/
  ];
  for (const pattern of processPatterns) {
    if (pattern.test(text)) {
      detected.push(evidence(tool, "process_execution", pattern.source, lineOffsetFor(text, pattern)));
      break;
    }
  }

  const pathWritePatterns = [
    /\bopen\s*\([^)]*(?:destination|path|file)[^)]*["'](?:w|a|wb|ab)["']/i,
    /\bcreateWriteStream\s*\([^)]*(?:destination|path|file)/i,
    /\bmkdir(?:Sync)?\s*\(/,
    /\bos\.path\.abspath\s*\(/
  ];
  for (const pattern of pathWritePatterns) {
    if (pattern.test(text)) {
      detected.push(evidence(tool, "path_controlled_filesystem", pattern.source, lineOffsetFor(text, pattern)));
      break;
    }
  }

  return detected;
}

function verifiedBehavior(sinkEvidence) {
  const categories = new Set(sinkEvidence.map((item) => item.category));
  return {
    readOnlyHint: !(categories.has("write") || categories.has("destructive_write") || categories.has("external_side_effect") || categories.has("process_execution")),
    destructiveHint: categories.has("destructive_write") || categories.has("process_execution"),
    openWorldHint: categories.has("external_side_effect") || categories.has("process_execution"),
    writes: categories.has("write") || categories.has("destructive_write"),
    processExecution: categories.has("process_execution"),
    pathControlledFilesystem: categories.has("path_controlled_filesystem")
  };
}

function finding({ id, severity, type, tool, message, evidence: findingEvidence, suggestedAnnotations = undefined }) {
  const result = {
    id,
    severity,
    type,
    tool: tool.name,
    confidence: "source-backed",
    message,
    evidence: findingEvidence
  };
  if (suggestedAnnotations) {
    result.suggested_annotations = suggestedAnnotations;
  }
  return result;
}

function compareAnnotations(tool, sinkEvidence) {
  const findings = [];
  const behavior = verifiedBehavior(sinkEvidence);
  const declared = tool.declared_annotations;

  if (declared.readOnlyHint === true && behavior.readOnlyHint === false) {
    const suggestedAnnotations = {
      ...declared,
      readOnlyHint: false
    };
    if (behavior.destructiveHint) {
      suggestedAnnotations.destructiveHint = true;
    }
    if (behavior.openWorldHint) {
      suggestedAnnotations.openWorldHint = true;
    }
    findings.push(finding({
      id: READONLY_FINDING,
      severity: "high",
      type: "false_readonly",
      tool,
      message: `Tool '${tool.name}' declares readOnlyHint=true but source evidence shows state mutation, external side effect, or process execution.`,
      evidence: sinkEvidence,
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
      evidence: sinkEvidence.filter((item) => item.category === "destructive_write" || item.category === "process_execution"),
      suggestedAnnotations: {
        ...declared,
        readOnlyHint: false,
        destructiveHint: true
      }
    }));
  }

  if (behavior.openWorldHint === true && declared.openWorldHint === false) {
    findings.push(finding({
      id: OPEN_WORLD_FINDING,
      severity: "medium",
      type: "false_open_world",
      tool,
      message: `Tool '${tool.name}' declares openWorldHint=false but source evidence reaches an external side effect or process execution.`,
      evidence: sinkEvidence.filter((item) => item.category === "external_side_effect" || item.category === "process_execution"),
      suggestedAnnotations: {
        ...declared,
        openWorldHint: true
      }
    }));
  }

  return findings;
}

function detectUnsafeFlows(tool, sinkEvidence) {
  const findings = [];
  const params = tool.input_schema.parameter_names;
  const processEvidence = sinkEvidence.filter((item) => item.category === "process_execution");
  if (processEvidence.length > 0 && params.some((param) => /command|cmd|script|args?/i.test(param))) {
    findings.push(finding({
      id: PROCESS_FLOW_FINDING,
      severity: "critical",
      type: "tool_input_to_process_execution",
      tool,
      message: `Tool '${tool.name}' has command-like MCP parameters and reaches process execution. Enforce a server-side allowlist; tool descriptions or LLM confirmation are not security controls.`,
      evidence: processEvidence
    }));
  }

  const pathEvidence = sinkEvidence.filter((item) => item.category === "path_controlled_filesystem");
  if (pathEvidence.length > 0 && params.some((param) => /path|file|dest|directory/i.test(param))) {
    findings.push(finding({
      id: FILE_FLOW_FINDING,
      severity: "high",
      type: "tool_input_to_filesystem_write",
      tool,
      message: `Tool '${tool.name}' has path-like MCP parameters and reaches filesystem write/path operations. Validate containment under an allowed root before writing.`,
      evidence: pathEvidence
    }));
  }

  return findings;
}

function publicTool(tool) {
  const { _analysis, ...rest } = tool;
  return rest;
}

export function analyzeTools(tools) {
  const findings = [];
  const publicTools = [];

  for (const tool of tools) {
    if (tool.handler?.confidence !== "resolved") {
      publicTools.push(publicTool(tool));
      continue;
    }
    const sinkEvidence = detectSinkEvidence(tool);
    findings.push(...compareAnnotations(tool, sinkEvidence));
    findings.push(...detectUnsafeFlows(tool, sinkEvidence));
    publicTools.push(publicTool(tool));
  }

  return {
    tools: publicTools,
    findings
  };
}
