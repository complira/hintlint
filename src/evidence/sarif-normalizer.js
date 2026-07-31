import { relativeEvidencePath, resolvedToolForLocation } from "./tool-location.js";

/**
 * Extract a flat trace array from SARIF codeFlows.
 * Each entry is "file:line" representing a step in the dataflow path.
 */
function extractTrace(result) {
  const codeFlows = result.codeFlows;
  if (!Array.isArray(codeFlows) || codeFlows.length === 0) {
    return undefined;
  }
  const threadFlows = codeFlows[0].threadFlows;
  if (!Array.isArray(threadFlows) || threadFlows.length === 0) {
    return undefined;
  }
  const locations = threadFlows[0].locations;
  if (!Array.isArray(locations) || locations.length === 0) {
    return undefined;
  }
  return locations.map((loc) => {
    const physical = loc.location?.physicalLocation;
    const uri = physical?.artifactLocation?.uri ?? "unknown";
    const line = physical?.region?.startLine ?? 0;
    return `${uri}:${line}`;
  });
}

/**
 * Normalize SARIF 2.1.0 JSON output into HintLint evidence records.
 *
 * @param {object} project - Project object with root path
 * @param {Array} tools - Extracted tool definitions
 * @param {object} sarifJson - Parsed SARIF JSON
 * @param {object} options
 * @param {string} options.engineName - Engine identifier (e.g. "codeql", "eslint-security")
 * @param {Map<string, string>} options.ruleCategoryMap - Maps SARIF ruleId -> HintLint category
 * @param {Map<string, string>} [options.ruleCweMap] - Maps SARIF ruleId -> CWE ID
 * @param {Map<string, string>} [options.ruleSinkKindMap] - Maps SARIF ruleId -> sink_kind
 * @param {Map<string, string>} [options.ruleFlowMap] - Maps SARIF ruleId -> flow type
 * @returns {Array} Evidence records
 */
export function normalizeSarif(project, tools, sarifJson, options) {
  const { engineName, ruleCategoryMap, ruleCweMap, ruleSinkKindMap, ruleFlowMap } = options;
  const runs = Array.isArray(sarifJson?.runs) ? sarifJson.runs : [];
  const evidence = [];

  for (const run of runs) {
    const results = Array.isArray(run.results) ? run.results : [];

    for (const result of results) {
      const ruleId = result.ruleId ?? "";
      const category = ruleCategoryMap.get(ruleId);
      if (!category) {
        continue;
      }

      const physical = result.locations?.[0]?.physicalLocation;
      const uri = physical?.artifactLocation?.uri ?? "";
      const line = physical?.region?.startLine ?? 1;
      const file = relativeEvidencePath(project, uri);
      const tool = resolvedToolForLocation(tools, file, line);
      const evidenceTier = tool ? "L3" : "L2";
      const message = result.message?.text ?? ruleId;

      const record = {
        tool: tool?.name ?? null,
        scope: tool ? "tool" : "project",
        category,
        sink_kind: ruleSinkKindMap?.get(ruleId) ?? "unknown",
        sink: message,
        file,
        line,
        source: engineName,
        engine: engineName,
        rule_id: ruleId,
        confidence: tool ? "source-backed" : "needs-review",
        evidence_tier: evidenceTier,
        sanitizer: {
          status: "unknown",
          expected: "unknown"
        }
      };

      const cweId = ruleCweMap?.get(ruleId);
      if (cweId) {
        record.cwe_id = cweId;
      }

      const flow = ruleFlowMap?.get(ruleId);
      if (flow) {
        record.flow = flow;
      }

      const trace = extractTrace(result);
      if (trace) {
        record.trace = trace;
      }

      evidence.push(record);
    }
  }

  return evidence;
}
