import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeSarif } from "../src/evidence/sarif-normalizer.js";
import { normalizeBanditJson } from "../src/evidence/bandit-normalizer.js";
import { normalizeEslintJson } from "../src/evidence/eslint-normalizer.js";
import { normalizeCodeqlSarif } from "../src/evidence/codeql-normalizer.js";

const FIXTURES = "fixtures/cross-validation";

function mockProject(root = "/mock/project") {
  return { root, languages: ["python"], files_scanned: 1 };
}

function mockTool(name, file, startLine, endLine) {
  return {
    name,
    language: "python",
    source: { file, line: startLine },
    handler: { file, line: startLine, confidence: "resolved" },
    _analysis: { text: "", start_line: startLine, end_line: endLine }
  };
}

// ---------- SARIF normalizer ----------

test("SARIF normalizer produces evidence from matching rules", async () => {
  const sarifJson = JSON.parse(await readFile(`${FIXTURES}/sarif-sample.json`, "utf-8"));
  const project = mockProject();
  const tools = [mockTool("run_script", "src/server.ts", 55, 70)];

  const ruleCategoryMap = new Map([
    ["test/process-execution", "process_execution"],
    ["test/filesystem-write", "filesystem_mutation"]
  ]);
  const ruleCweMap = new Map([
    ["test/process-execution", "CWE-78"]
  ]);
  const ruleSinkKindMap = new Map([
    ["test/process-execution", "execute"],
    ["test/filesystem-write", "write"]
  ]);

  const evidence = normalizeSarif(project, tools, sarifJson, {
    engineName: "test-engine",
    ruleCategoryMap,
    ruleCweMap,
    ruleSinkKindMap
  });

  // Should produce 2 records (unknown-rule is skipped)
  assert.equal(evidence.length, 2);

  const processEvidence = evidence.find((e) => e.category === "process_execution");
  assert.ok(processEvidence);
  assert.equal(processEvidence.source, "test-engine");
  assert.equal(processEvidence.engine, "test-engine");
  assert.equal(processEvidence.rule_id, "test/process-execution");
  assert.equal(processEvidence.tool, "run_script");
  assert.equal(processEvidence.scope, "tool");
  assert.equal(processEvidence.evidence_tier, "L3");
  assert.equal(processEvidence.confidence, "source-backed");
  assert.equal(processEvidence.cwe_id, "CWE-78");
  assert.equal(processEvidence.sink_kind, "execute");
  assert.equal(processEvidence.line, 65);

  // Should have trace from codeFlows
  assert.ok(Array.isArray(processEvidence.trace));
  assert.equal(processEvidence.trace.length, 3);
  assert.equal(processEvidence.trace[0], "src/server.ts:60");
  assert.equal(processEvidence.trace[2], "src/server.ts:65");

  const fsEvidence = evidence.find((e) => e.category === "filesystem_mutation");
  assert.ok(fsEvidence);
  assert.equal(fsEvidence.tool, null); // line 80 is outside tool range 55-70
  assert.equal(fsEvidence.scope, "project");
  assert.equal(fsEvidence.evidence_tier, "L2");
  assert.equal(fsEvidence.confidence, "needs-review");
  assert.equal(fsEvidence.trace, undefined); // no codeFlows
});

test("SARIF normalizer skips rules not in category map", async () => {
  const sarifJson = JSON.parse(await readFile(`${FIXTURES}/sarif-sample.json`, "utf-8"));
  const project = mockProject();
  const evidence = normalizeSarif(project, [], sarifJson, {
    engineName: "test",
    ruleCategoryMap: new Map() // empty map
  });
  assert.equal(evidence.length, 0);
});

test("SARIF normalizer handles empty/malformed input", () => {
  const project = mockProject();
  assert.equal(normalizeSarif(project, [], null, { engineName: "x", ruleCategoryMap: new Map() }).length, 0);
  assert.equal(normalizeSarif(project, [], {}, { engineName: "x", ruleCategoryMap: new Map() }).length, 0);
  assert.equal(normalizeSarif(project, [], { runs: [] }, { engineName: "x", ruleCategoryMap: new Map() }).length, 0);
});

// ---------- Bandit normalizer ----------

test("Bandit normalizer produces evidence from matching test IDs", async () => {
  const banditJson = JSON.parse(await readFile(`${FIXTURES}/bandit-sample.json`, "utf-8"));
  const project = mockProject();
  const tools = [mockTool("run_az_command", "server.py", 15, 25)];

  const evidence = normalizeBanditJson(project, tools, banditJson);

  // B602, B608, B306, B310 match; B303 does not
  assert.equal(evidence.length, 4);

  const processEvidence = evidence.find((e) => e.rule_id === "B602");
  assert.ok(processEvidence);
  assert.equal(processEvidence.source, "bandit");
  assert.equal(processEvidence.engine, "bandit");
  assert.equal(processEvidence.category, "process_execution");
  assert.equal(processEvidence.tool, "run_az_command"); // line 21 is inside tool range 15-25
  assert.equal(processEvidence.scope, "tool");
  assert.equal(processEvidence.evidence_tier, "L3");
  assert.equal(processEvidence.confidence, "source-backed");
  assert.equal(processEvidence.cwe_id, "CWE-78");
  assert.equal(processEvidence.sink_kind, "execute");
  assert.equal(processEvidence.flow, "process");

  const queryEvidence = evidence.find((e) => e.rule_id === "B608");
  assert.ok(queryEvidence);
  assert.equal(queryEvidence.category, "query_execution");
  assert.equal(queryEvidence.tool, null); // line 45 is outside tool range
  assert.equal(queryEvidence.scope, "project");
  assert.equal(queryEvidence.evidence_tier, "L2");
  assert.equal(queryEvidence.cwe_id, "CWE-89");

  const fsEvidence = evidence.find((e) => e.rule_id === "B306");
  assert.ok(fsEvidence);
  assert.equal(fsEvidence.category, "filesystem_mutation");
  assert.equal(fsEvidence.cwe_id, "CWE-22");

  const urlEvidence = evidence.find((e) => e.rule_id === "B310");
  assert.ok(urlEvidence);
  assert.equal(urlEvidence.category, "url_construction");
  assert.equal(urlEvidence.cwe_id, "CWE-601");
});

test("Bandit normalizer skips unrecognized test IDs", async () => {
  const banditJson = {
    results: [
      { test_id: "B303", filename: "auth.py", line_number: 5, issue_text: "md5" },
      { test_id: "B999", filename: "foo.py", line_number: 1, issue_text: "unknown" }
    ]
  };
  const evidence = normalizeBanditJson(mockProject(), [], banditJson);
  assert.equal(evidence.length, 0);
});

test("Bandit normalizer handles empty/malformed input", () => {
  const project = mockProject();
  assert.equal(normalizeBanditJson(project, [], null).length, 0);
  assert.equal(normalizeBanditJson(project, [], {}).length, 0);
  assert.equal(normalizeBanditJson(project, [], { results: [] }).length, 0);
});

// ---------- ESLint normalizer ----------

test("ESLint normalizer produces evidence from security rules", async () => {
  const eslintJson = JSON.parse(await readFile(`${FIXTURES}/eslint-sample.json`, "utf-8"));
  const project = mockProject();
  const tools = [mockTool("run_script", "src/server.ts", 55, 70)];

  const evidence = normalizeEslintJson(project, tools, eslintJson);

  // 3 security rules match, 1 non-security (no-unused-vars) skipped, 1 outside tool range
  assert.equal(evidence.length, 4);

  const processEvidence = evidence.find((e) => e.rule_id === "security/detect-child-process");
  assert.ok(processEvidence);
  assert.equal(processEvidence.source, "eslint-security");
  assert.equal(processEvidence.engine, "eslint-security");
  assert.equal(processEvidence.category, "process_execution");
  assert.equal(processEvidence.tool, "run_script"); // line 65 is inside tool range 55-70
  assert.equal(processEvidence.scope, "tool");
  assert.equal(processEvidence.evidence_tier, "L3");
  assert.equal(processEvidence.confidence, "source-backed");
  assert.equal(processEvidence.cwe_id, "CWE-78");
  assert.equal(processEvidence.flow, "process");

  const fsEvidence = evidence.find((e) => e.rule_id === "security/detect-non-literal-fs-filename");
  assert.ok(fsEvidence);
  assert.equal(fsEvidence.category, "filesystem_mutation");
  assert.equal(fsEvidence.tool, null); // line 80 outside range
  assert.equal(fsEvidence.evidence_tier, "L2");
  assert.equal(fsEvidence.cwe_id, "CWE-22");
  assert.equal(fsEvidence.flow, "filesystem");

  const evalEvidence = evidence.find((e) => e.rule_id === "security/detect-eval-with-expression");
  assert.ok(evalEvidence);
  assert.equal(evalEvidence.category, "process_execution");
  assert.equal(evalEvidence.cwe_id, "CWE-94");

  const requireEvidence = evidence.find((e) => e.rule_id === "security/detect-non-literal-require");
  assert.ok(requireEvidence);
  assert.equal(requireEvidence.category, "process_execution");
  assert.equal(requireEvidence.file, "src/utils.ts");
});

test("ESLint normalizer skips non-security rules", () => {
  const eslintJson = [
    {
      filePath: "src/foo.ts",
      messages: [
        { ruleId: "no-unused-vars", line: 1, message: "unused" },
        { ruleId: "semi", line: 2, message: "missing semicolon" }
      ]
    }
  ];
  const evidence = normalizeEslintJson(mockProject(), [], eslintJson);
  assert.equal(evidence.length, 0);
});

test("ESLint normalizer handles empty/malformed input", () => {
  const project = mockProject();
  assert.equal(normalizeEslintJson(project, [], null).length, 0);
  assert.equal(normalizeEslintJson(project, [], []).length, 0);
  assert.equal(normalizeEslintJson(project, [], [{ filePath: "x.ts", messages: [] }]).length, 0);
});

// ---------- CodeQL normalizer ----------

test("CodeQL normalizer produces evidence from custom and standard queries", async () => {
  const sarifJson = JSON.parse(await readFile(`${FIXTURES}/codeql-sarif-sample.json`, "utf-8"));
  const project = mockProject();
  const tools = [mockTool("run_script", "src/server.ts", 55, 70)];

  const evidence = normalizeCodeqlSarif(project, tools, sarifJson);

  assert.equal(evidence.length, 2);

  const customEvidence = evidence.find((e) => e.rule_id === "hintlint/process-execution");
  assert.ok(customEvidence);
  assert.equal(customEvidence.source, "codeql");
  assert.equal(customEvidence.engine, "codeql");
  assert.equal(customEvidence.category, "process_execution");
  assert.equal(customEvidence.tool, "run_script");
  assert.equal(customEvidence.scope, "tool");
  assert.equal(customEvidence.evidence_tier, "L3");
  assert.equal(customEvidence.confidence, "source-backed");
  assert.equal(customEvidence.cwe_id, "CWE-78");
  assert.equal(customEvidence.sink_kind, "execute");
  assert.equal(customEvidence.flow, "process");
  // Should have trace from codeFlows
  assert.ok(Array.isArray(customEvidence.trace));
  assert.equal(customEvidence.trace.length, 3);

  const standardEvidence = evidence.find((e) => e.rule_id === "js/command-line-injection");
  assert.ok(standardEvidence);
  assert.equal(standardEvidence.source, "codeql");
  assert.equal(standardEvidence.category, "process_execution");
  assert.equal(standardEvidence.cwe_id, "CWE-78");
  assert.equal(standardEvidence.tool, "run_script");
  assert.equal(standardEvidence.trace, undefined); // no codeFlows on this result
});

test("CodeQL normalizer handles empty SARIF", () => {
  const project = mockProject();
  assert.equal(normalizeCodeqlSarif(project, [], null).length, 0);
  assert.equal(normalizeCodeqlSarif(project, [], { runs: [] }).length, 0);
});
