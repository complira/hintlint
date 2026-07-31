import { relativeEvidencePath, resolvedToolForLocation } from "./tool-location.js";

const CATEGORY_BY_TEST_ID = new Map([
  ["B301", "process_execution"],
  ["B302", "process_execution"],
  ["B602", "process_execution"],
  ["B603", "process_execution"],
  ["B604", "process_execution"],
  ["B605", "process_execution"],
  ["B606", "process_execution"],
  ["B607", "process_execution"],
  ["B608", "query_execution"],
  ["B501", "connection_string"],
  ["B306", "filesystem_mutation"],
  ["B310", "url_construction"]
]);

const CWE_BY_TEST_ID = new Map([
  ["B301", "CWE-78"],
  ["B302", "CWE-78"],
  ["B602", "CWE-78"],
  ["B603", "CWE-78"],
  ["B604", "CWE-78"],
  ["B605", "CWE-78"],
  ["B606", "CWE-78"],
  ["B607", "CWE-78"],
  ["B608", "CWE-89"],
  ["B501", "CWE-295"],
  ["B306", "CWE-22"],
  ["B310", "CWE-601"]
]);

const SINK_KIND_BY_TEST_ID = new Map([
  ["B301", "execute"],
  ["B302", "execute"],
  ["B602", "execute"],
  ["B603", "execute"],
  ["B604", "execute"],
  ["B605", "execute"],
  ["B606", "execute"],
  ["B607", "execute"],
  ["B608", "query"],
  ["B501", "connection"],
  ["B306", "write"],
  ["B310", "url"]
]);

const FLOW_BY_TEST_ID = new Map([
  ["B602", "process"],
  ["B603", "process"],
  ["B604", "process"],
  ["B605", "process"],
  ["B606", "process"],
  ["B607", "process"],
  ["B608", "query"],
  ["B306", "filesystem"],
  ["B310", "url"]
]);

/**
 * Normalize Bandit JSON output into HintLint evidence records.
 *
 * Bandit JSON format: { "results": [{ "test_id": "B602", "filename": "...",
 *   "line_number": 42, "issue_text": "...", "issue_severity": "HIGH", ... }] }
 *
 * @param {object} project - Project object with root path
 * @param {Array} tools - Extracted tool definitions
 * @param {object} banditJson - Parsed Bandit JSON output
 * @returns {Array} Evidence records
 */
export function normalizeBanditJson(project, tools, banditJson) {
  const results = Array.isArray(banditJson?.results) ? banditJson.results : [];

  return results
    .filter((result) => CATEGORY_BY_TEST_ID.has(result.test_id))
    .map((result) => {
      const testId = result.test_id;
      const file = relativeEvidencePath(project, result.filename ?? "");
      const line = result.line_number ?? 1;
      const tool = resolvedToolForLocation(tools, file, line);
      const evidenceTier = tool ? "L3" : "L2";
      const category = CATEGORY_BY_TEST_ID.get(testId);

      const record = {
        tool: tool?.name ?? null,
        scope: tool ? "tool" : "project",
        category,
        sink_kind: SINK_KIND_BY_TEST_ID.get(testId) ?? "unknown",
        sink: result.issue_text ?? testId,
        file,
        line,
        source: "bandit",
        engine: "bandit",
        rule_id: testId,
        confidence: tool ? "source-backed" : "needs-review",
        evidence_tier: evidenceTier,
        sanitizer: {
          status: "unknown",
          expected: "unknown"
        }
      };

      const cweId = CWE_BY_TEST_ID.get(testId);
      if (cweId) {
        record.cwe_id = cweId;
      }

      const flow = FLOW_BY_TEST_ID.get(testId);
      if (flow) {
        record.flow = flow;
      }

      return record;
    });
}
