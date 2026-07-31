import { relativeEvidencePath, resolvedToolForLocation } from "./tool-location.js";

const CATEGORY_BY_RULE = new Map([
  ["security/detect-child-process", "process_execution"],
  ["security/detect-eval-with-expression", "process_execution"],
  ["security/detect-non-literal-fs-filename", "filesystem_mutation"],
  ["security/detect-no-csrf-before-method-override", "http_mutation"],
  ["security/detect-non-literal-require", "process_execution"]
]);

const CWE_BY_RULE = new Map([
  ["security/detect-child-process", "CWE-78"],
  ["security/detect-eval-with-expression", "CWE-94"],
  ["security/detect-non-literal-fs-filename", "CWE-22"],
  ["security/detect-no-csrf-before-method-override", "CWE-352"],
  ["security/detect-non-literal-require", "CWE-94"]
]);

const SINK_KIND_BY_RULE = new Map([
  ["security/detect-child-process", "execute"],
  ["security/detect-eval-with-expression", "execute"],
  ["security/detect-non-literal-fs-filename", "write"],
  ["security/detect-no-csrf-before-method-override", "http"],
  ["security/detect-non-literal-require", "execute"]
]);

const FLOW_BY_RULE = new Map([
  ["security/detect-child-process", "process"],
  ["security/detect-non-literal-fs-filename", "filesystem"]
]);

/**
 * Normalize ESLint JSON output into HintLint evidence records.
 *
 * ESLint JSON format: [{ "filePath": "/abs/path.js", "messages": [{
 *   "ruleId": "security/detect-child-process", "line": 10, "message": "..." }] }]
 *
 * @param {object} project - Project object with root path
 * @param {Array} tools - Extracted tool definitions
 * @param {Array} eslintJson - Parsed ESLint JSON output (array of file results)
 * @returns {Array} Evidence records
 */
export function normalizeEslintJson(project, tools, eslintJson) {
  const fileResults = Array.isArray(eslintJson) ? eslintJson : [];
  const evidence = [];

  for (const fileResult of fileResults) {
    const filePath = fileResult.filePath ?? "";
    const messages = Array.isArray(fileResult.messages) ? fileResult.messages : [];

    for (const msg of messages) {
      const ruleId = msg.ruleId ?? "";
      const category = CATEGORY_BY_RULE.get(ruleId);
      if (!category) {
        continue;
      }

      const file = relativeEvidencePath(project, filePath);
      const line = msg.line ?? 1;
      const tool = resolvedToolForLocation(tools, file, line);
      const evidenceTier = tool ? "L3" : "L2";

      const record = {
        tool: tool?.name ?? null,
        scope: tool ? "tool" : "project",
        category,
        sink_kind: SINK_KIND_BY_RULE.get(ruleId) ?? "unknown",
        sink: msg.message ?? ruleId,
        file,
        line,
        source: "eslint-security",
        engine: "eslint-security",
        rule_id: ruleId,
        confidence: tool ? "source-backed" : "needs-review",
        evidence_tier: evidenceTier,
        sanitizer: {
          status: "unknown",
          expected: "unknown"
        }
      };

      const cweId = CWE_BY_RULE.get(ruleId);
      if (cweId) {
        record.cwe_id = cweId;
      }

      const flow = FLOW_BY_RULE.get(ruleId);
      if (flow) {
        record.flow = flow;
      }

      evidence.push(record);
    }
  }

  return evidence;
}
