import { normalizeSarif } from "./sarif-normalizer.js";

const RULE_CATEGORY_MAP = new Map([
  ["hintlint/process-execution", "process_execution"],
  ["hintlint/filesystem-write", "filesystem_mutation"],
  ["hintlint/database-mutation", "database_mutation"],
  ["hintlint/query-injection", "query_execution"],
  ["hintlint/url-ssrf", "url_construction"],
  ["hintlint/connection-string", "connection_string"],
  // Standard CodeQL JS security queries (corroboration)
  ["js/command-line-injection", "process_execution"],
  ["js/sql-injection", "query_execution"],
  ["js/path-injection", "filesystem_mutation"],
  ["js/server-side-request-forgery", "url_construction"],
  ["js/code-injection", "process_execution"],
  // Standard CodeQL Python security queries (corroboration)
  ["py/command-line-injection", "process_execution"],
  ["py/sql-injection", "query_execution"],
  ["py/path-injection", "filesystem_mutation"],
  ["py/server-side-request-forgery", "url_construction"],
  ["py/code-injection", "process_execution"]
]);

const RULE_CWE_MAP = new Map([
  ["hintlint/process-execution", "CWE-78"],
  ["hintlint/filesystem-write", "CWE-22"],
  ["hintlint/database-mutation", "CWE-89"],
  ["hintlint/query-injection", "CWE-89"],
  ["hintlint/url-ssrf", "CWE-918"],
  ["hintlint/connection-string", "CWE-88"],
  ["js/command-line-injection", "CWE-78"],
  ["js/sql-injection", "CWE-89"],
  ["js/path-injection", "CWE-22"],
  ["js/server-side-request-forgery", "CWE-918"],
  ["js/code-injection", "CWE-94"],
  ["py/command-line-injection", "CWE-78"],
  ["py/sql-injection", "CWE-89"],
  ["py/path-injection", "CWE-22"],
  ["py/server-side-request-forgery", "CWE-918"],
  ["py/code-injection", "CWE-94"]
]);

const RULE_SINK_KIND_MAP = new Map([
  ["hintlint/process-execution", "execute"],
  ["hintlint/filesystem-write", "write"],
  ["hintlint/database-mutation", "destructive"],
  ["hintlint/query-injection", "query"],
  ["hintlint/url-ssrf", "external_boundary"],
  ["hintlint/connection-string", "credential_boundary"],
  ["js/command-line-injection", "execute"],
  ["js/sql-injection", "query"],
  ["js/path-injection", "write"],
  ["js/server-side-request-forgery", "external_boundary"],
  ["js/code-injection", "execute"],
  ["py/command-line-injection", "execute"],
  ["py/sql-injection", "query"],
  ["py/path-injection", "write"],
  ["py/server-side-request-forgery", "external_boundary"],
  ["py/code-injection", "execute"]
]);

const RULE_FLOW_MAP = new Map([
  ["hintlint/process-execution", "process"],
  ["hintlint/filesystem-write", "filesystem"],
  ["hintlint/query-injection", "query"],
  ["hintlint/url-ssrf", "url"],
  ["hintlint/connection-string", "connection_string"],
  ["js/command-line-injection", "process"],
  ["js/sql-injection", "query"],
  ["js/path-injection", "filesystem"],
  ["js/server-side-request-forgery", "url"],
  ["py/command-line-injection", "process"],
  ["py/sql-injection", "query"],
  ["py/path-injection", "filesystem"],
  ["py/server-side-request-forgery", "url"]
]);

/**
 * Normalize CodeQL SARIF output into HintLint evidence records.
 *
 * Delegates to the generic SARIF normalizer with CodeQL-specific rule maps.
 * Recognizes both custom HintLint queries (hintlint/*) and standard CodeQL
 * security queries (js/*, py/*) for corroboration.
 *
 * @param {object} project - Project object with root path
 * @param {Array} tools - Extracted tool definitions
 * @param {object} sarifJson - Parsed CodeQL SARIF output
 * @returns {Array} Evidence records
 */
export function normalizeCodeqlSarif(project, tools, sarifJson) {
  return normalizeSarif(project, tools, sarifJson, {
    engineName: "codeql",
    ruleCategoryMap: RULE_CATEGORY_MAP,
    ruleCweMap: RULE_CWE_MAP,
    ruleSinkKindMap: RULE_SINK_KIND_MAP,
    ruleFlowMap: RULE_FLOW_MAP
  });
}
