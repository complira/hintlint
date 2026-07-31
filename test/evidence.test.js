import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  assert.equal(unsafeQuery.evidence_tier, "L3");
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
  assert.equal(report.project_evidence[0].evidence_tier, "L2");
  assert.equal(report.summary.evidence_records_by_tier.L2, 1);
  assert.equal(report.summary.evidence_records_by_tier.L3, 6);
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
  assert.equal(semgrepToolEvidence.evidence_tier, "L3");
  assert.equal(semgrepToolEvidence.source_parameter.name, "command");

  const semgrepProjectEvidence = report.project_evidence.find((item) =>
    item.engine === "semgrep" && item.rule_id === "hintlint.semgrep.helper.sample"
  );
  assert.ok(semgrepProjectEvidence);
  assert.equal(semgrepProjectEvidence.scope, "project");
  assert.equal(semgrepProjectEvidence.confidence, "needs-review");
  assert.equal(semgrepProjectEvidence.evidence_tier, "L2");
});

test("imported Semgrep tool evidence participates in finding generation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-semgrep-finding-"));
  await mkdir(join(dir, "src"));
  const serverPath = join(dir, "src", "server.ts");
  await writeFile(serverPath, [
    "const server = {};",
    "server.tool(\"semgrep_only_write\", \"Updates an account\", { userId: z.string(), readOnlyHint: true }, async ({ userId }) => {",
    "  return { content: [{ type: \"text\", text: userId }] };",
    "});",
    ""
  ].join("\n"), "utf8");

  const semgrepJsonPath = join(dir, "semgrep.json");
  await writeFile(semgrepJsonPath, JSON.stringify({
    results: [
      {
        check_id: "hintlint.semgrep.database.write",
        path: serverPath,
        start: { line: 3, col: 3 },
        extra: {
          message: "sample database write",
          metadata: {
            hintlint_category: "database_mutation",
            hintlint_sink_kind: "write",
            hintlint_sink: "prisma.account.update"
          }
        }
      }
    ]
  }), "utf8");

  const report = await runScan(dir, { semgrepJsonPath });
  assert.equal(report.summary.source_evidence, 1);
  assert.equal(report.findings.some((finding) =>
    finding.type === "false_readonly" && finding.tool === "semgrep_only_write"
  ), true);
});

test("TypeScript local helper sinks are promoted to handler-scoped L3 evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-ts-helper-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "server.ts"), [
    "const server = {};",
    "server.tool('delete_customer', 'Delete customer', { customerId: z.string() }, { annotations: { readOnlyHint: true, destructiveHint: false } }, async ({ customerId }) => {",
    "  return deleteCustomer(customerId);",
    "});",
    "",
    "function deleteCustomer(customerId: string) {",
    "  return db.customer.delete({ where: { id: customerId } });",
    "}",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.source_evidence, 1);
  assert.equal(report.summary.project_evidence, 0);
  const evidence = report.evidence.find((item) => item.tool === "delete_customer");
  assert.ok(evidence);
  assert.equal(evidence.evidence_tier, "L3");
  assert.deepEqual(evidence.reachability.path, ["delete_customer", "deleteCustomer"]);
  assert.equal(report.findings.some((finding) =>
    finding.tool === "delete_customer" && finding.type === "false_readonly"
  ), true);
});

test("Semgrep project evidence inside reachable TypeScript helpers is promoted to L3", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-semgrep-helper-"));
  await mkdir(join(dir, "src"));
  const serverPath = join(dir, "src", "server.ts");
  const lines = [
    "const server = {};",
    "server.tool('update_account', 'Update account', { userId: z.string() }, { annotations: { readOnlyHint: true } }, async ({ userId }) => {",
    "  return updateAccount(userId);",
    "});",
    "",
    "function updateAccount(userId: string) {",
    "  return dangerousWrite(userId);",
    "}",
    ""
  ];
  await writeFile(serverPath, lines.join("\n"), "utf8");

  const semgrepJsonPath = join(dir, "semgrep.json");
  await writeFile(semgrepJsonPath, JSON.stringify({
    results: [
      {
        check_id: "hintlint.semgrep.database.write",
        path: serverPath,
        start: { line: lines.findIndex((line) => line.includes("dangerousWrite")) + 1, col: 10 },
        extra: {
          message: "sample helper database write",
          metadata: {
            hintlint_category: "database_mutation",
            hintlint_sink_kind: "write",
            hintlint_sink: "dangerousWrite"
          }
        }
      }
    ]
  }), "utf8");

  const report = await runScan(dir, { semgrepJsonPath });
  assert.equal(report.summary.source_evidence, 1);
  assert.equal(report.summary.project_evidence, 0);
  const evidence = report.evidence.find((item) => item.engine === "semgrep" && item.tool === "update_account");
  assert.ok(evidence);
  assert.equal(evidence.evidence_tier, "L3");
  assert.deepEqual(evidence.reachability.path, ["update_account", "updateAccount"]);
  assert.equal(report.findings.some((finding) =>
    finding.tool === "update_account" && finding.type === "false_readonly"
  ), true);
});

test("UI drag-and-drop handlers are not classified as database destructive drops", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-ui-drop-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "tools.ts"), [
    "export const drag = definePageTool({",
    "  name: 'drag',",
    "  description: 'Drag an element onto another element',",
    "  annotations: { readOnlyHint: false },",
    "  schema: { from_uid: zod.string(), to_uid: zod.string() },",
    "  handler: async (request, response) => {",
    "    const fromHandle = await request.page.getElementByUid(request.params.from_uid);",
    "    const toHandle = await request.page.getElementByUid(request.params.to_uid);",
    "    await fromHandle.drag(toHandle);",
    "    await toHandle.drop(fromHandle);",
    "    response.appendResponseLine('dragged');",
    "  },",
    "});",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 1);
  assert.equal(report.findings.some((finding) => finding.type === "missing_or_false_destructive_hint"), false);
});

test("local collection insertions are not classified as database writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-local-insert-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "tools.ts"), [
    "export const getAttachments = defineTool({",
    "  name: 'get_attachments',",
    "  description: 'Read attachments and format response content',",
    "  annotations: { readOnlyHint: true },",
    "  schema: { issueKey: zod.string() },",
    "  handler: async () => {",
    "    const contents = [];",
    "    contents.insert(0, { type: 'text', text: 'summary' });",
    "    return contents;",
    "  },",
    "});",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 1);
  assert.equal(report.summary.findings, 0);
});

test("cloud destructive detection requires a call site, not prose operation names", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-cloud-call-"));
  await writeFile(join(dir, "server.py"), [
    "from mcp.server.fastmcp import FastMCP",
    "mcp = FastMCP('cloud-call')",
    "",
    "@mcp.tool(annotations={'readOnlyHint': True})",
    "def estimate_costs(operation: str) -> str:",
    "    '''Supported operations: GetItem|PutItem|DeleteItem.'''",
    "    return operation",
    "",
    "@mcp.tool(annotations={'readOnlyHint': False})",
    "def delete_user(user_name: str) -> str:",
    "    iam.delete_user(UserName=user_name)",
    "    return 'deleted'",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 2);
  assert.equal(report.findings.some((finding) => finding.tool === "estimate_costs"), false);
  assert.equal(report.findings.some((finding) =>
    finding.tool === "delete_user" && finding.type === "missing_or_false_destructive_hint"
  ), true);
});

test("lowercase delete tool names are not destructive evidence without a sink call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-delete-name-"));
  await writeFile(join(dir, "server.py"), [
    "from mcp.server.fastmcp import FastMCP",
    "mcp = FastMCP('delete-name')",
    "",
    "@mcp.tool()",
    "def delete_file(filename: str) -> str:",
    "    return f'planned delete for {filename}'",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 1);
  assert.equal(report.summary.source_evidence, 0);
  assert.equal(report.summary.findings, 0);
});

test("AWS operation names in prose are not destructive call evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-aws-prose-"));
  await writeFile(join(dir, "server.py"), [
    "from mcp.server.fastmcp import FastMCP",
    "mcp = FastMCP('aws-prose')",
    "",
    "@mcp.tool()",
    "def ecs_resource_management(operation: str) -> str:",
    "    '''Supported operations:",
    "    - DeleteAccountSetting (requires WRITE permission)",
    "    '''",
    "    return operation",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 1);
  assert.equal(report.summary.source_evidence, 0);
  assert.equal(report.summary.findings, 0);
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
