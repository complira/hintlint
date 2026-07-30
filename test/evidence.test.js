import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { runScan } from "../src/index.js";

test("M2 py-taint fixture emits source evidence, sanitizer status, and unsafe-flow findings", async () => {
  const report = await runScan("fixtures/py-taint");
  assert.equal(report.summary.tools_scanned, 6);
  assert.equal(report.summary.source_evidence, 6);
  assert.equal(report.summary.project_evidence, 1);

  const unsafeQuery = report.evidence.find((item) => item.tool === "unsafe_postgres_query");
  assert.ok(unsafeQuery);
  assert.equal(unsafeQuery.category, "query_execution");
  assert.equal(unsafeQuery.line, 21);
  assert.equal(unsafeQuery.source_parameter.name, "query");
  assert.equal(unsafeQuery.sanitizer.status, "not_found");

  const safeQuery = report.evidence.find((item) => item.tool === "safe_mysql_query");
  assert.ok(safeQuery);
  assert.equal(safeQuery.category, "query_execution");
  assert.equal(safeQuery.sanitizer.status, "found");

  const safePath = report.evidence.find((item) => item.tool === "safe_download_artifact");
  assert.ok(safePath);
  assert.equal(safePath.category, "filesystem_mutation");
  assert.equal(safePath.sanitizer.status, "found");

  const findingTypes = new Set(report.findings.map((finding) => finding.type));
  assert.equal(findingTypes.has("tool_input_to_query_execution"), true);
  assert.equal(findingTypes.has("tool_input_to_url_construction"), true);
  assert.equal(findingTypes.has("tool_input_to_connection_string"), true);
  assert.equal(findingTypes.has("validation_asymmetry"), true);

  assert.equal(report.project_evidence[0].scope, "project");
  assert.equal(report.project_evidence[0].tool, null);
  assert.equal(report.project_evidence[0].confidence, "needs-review");
});

test("M2 TypeScript fixture covers HTTP, cloud, process, and project evidence", async () => {
  const report = await runScan("fixtures/ts-evidence");
  assert.equal(report.summary.tools_scanned, 3);
  assert.equal(report.summary.source_evidence, 4);
  assert.equal(report.summary.project_evidence, 1);

  const categories = new Set(report.evidence.map((item) => item.category));
  assert.equal(categories.has("http_mutation"), true);
  assert.equal(categories.has("cloud_mutation"), true);
  assert.equal(categories.has("process_execution"), true);
  assert.equal(categories.has("url_construction"), true);
  assert.equal(categories.has("database_mutation"), false);

  const processEvidence = report.evidence.find((item) => item.tool === "run_script");
  assert.ok(processEvidence);
  assert.equal(processEvidence.source_parameter.name, "command");
  assert.equal(processEvidence.sanitizer.status, "not_found");
});

test("normalizes imported Semgrep JSON into tool and project evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-semgrep-"));
  const semgrepJsonPath = join(dir, "semgrep.json");
  await writeFile(semgrepJsonPath, JSON.stringify({
    results: [
      {
        check_id: "hintlint.semgrep.process.sample",
        path: "fixtures/ts-evidence/src/server.ts",
        start: { line: 65, col: 12 },
        extra: {
          message: "sample process execution",
          metadata: {
            hintlint_category: "process_execution",
            hintlint_sink_kind: "execute",
            hintlint_sink: "child_process.exec",
            hintlint_flow: "process",
            hintlint_source_parameter: "command",
            hintlint_sanitizer_status: "not_found",
            hintlint_sanitizer_expected: "server-side command allowlist",
            cwe: "CWE-78"
          }
        }
      },
      {
        check_id: "hintlint.semgrep.helper.sample",
        path: "fixtures/ts-evidence/src/server.ts",
        start: { line: 70, col: 10 },
        extra: {
          message: "sample helper process execution",
          metadata: {
            hintlint_category: "process_execution",
            hintlint_sink_kind: "execute",
            hintlint_sink: "execSync",
            hintlint_flow: "process"
          }
        }
      }
    ]
  }), "utf8");

  const report = await runScan("fixtures/ts-evidence", { semgrepJsonPath });
  const semgrepToolEvidence = report.evidence.find((item) =>
    item.engine === "semgrep" && item.tool === "run_script"
  );
  assert.ok(semgrepToolEvidence);
  assert.equal(semgrepToolEvidence.scope, "tool");
  assert.equal(semgrepToolEvidence.confidence, "source-backed");
  assert.equal(semgrepToolEvidence.source_parameter.name, "command");

  const semgrepProjectEvidence = report.project_evidence.find((item) =>
    item.engine === "semgrep" && item.rule_id === "hintlint.semgrep.helper.sample"
  );
  assert.ok(semgrepProjectEvidence);
  assert.equal(semgrepProjectEvidence.scope, "project");
  assert.equal(semgrepProjectEvidence.confidence, "needs-review");
});

test("Semgrep rule pack declares the M2 sink taxonomy", async () => {
  const rulePack = await readFile("rules/semgrep/hintlint-mcp.yml", "utf8");
  for (const ruleId of [
    "hintlint.filesystem.mutation",
    "hintlint.database.destructive",
    "hintlint.database.write",
    "hintlint.http.mutation",
    "hintlint.process.execution",
    "hintlint.external.send",
    "hintlint.cloud.mutation",
    "hintlint.query.execution",
    "hintlint.url.user-controlled",
    "hintlint.connection-string.user-controlled"
  ]) {
    assert.match(rulePack, new RegExp(`id: ${ruleId.replaceAll(".", "\\.")}`));
  }
});
