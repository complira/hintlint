import assert from "node:assert/strict";
import test from "node:test";
import { runScan } from "../src/index.js";

test("extracts TypeScript MCP tools and annotations", async () => {
  const report = await runScan("fixtures/ts-basic");
  assert.equal(report.summary.tools_scanned, 5);
  assert.equal(report.summary.findings, 2);
  assert.equal(report.summary.unsupported_patterns, 1);
  assert.deepEqual(report.project.languages, ["typescript"]);

  const deleteCustomer = report.tools.find((tool) => tool.name === "delete_customer");
  assert.ok(deleteCustomer);
  assert.equal(deleteCustomer.language, "typescript");
  assert.equal(deleteCustomer.handler.confidence, "resolved");
  assert.equal(deleteCustomer.declared_annotations.readOnlyHint, true);
  assert.equal(deleteCustomer.declared_annotations.destructiveHint, false);
  assert.deepEqual(deleteCustomer.input_schema.parameter_names, ["customerId"]);
  assert.equal(deleteCustomer.input_schema.schema_format, "typescript-expression");
  assert.match(deleteCustomer.input_schema.schema_source, /customerId/);

  const createCustomer = report.tools.find((tool) => tool.name === "create_customer");
  assert.ok(createCustomer);
  assert.equal(createCustomer.declared_annotations.readOnlyHint, false);
  assert.equal(createCustomer.declared_annotations.destructiveHint, false);

  const dynamicTool = report.tools.find((tool) => tool.name.startsWith("<dynamic:"));
  assert.ok(dynamicTool);
  assert.equal(dynamicTool.handler.confidence, "unknown_handler");
  assert.equal(dynamicTool.extraction.dynamic_name, true);
});

test("extracts Python MCP tools and annotations", async () => {
  const report = await runScan("fixtures/py-basic");
  assert.equal(report.summary.tools_scanned, 3);
  assert.equal(report.summary.findings, 2);
  assert.deepEqual(report.project.languages, ["python"]);

  const runAz = report.tools.find((tool) => tool.name === "run_az_command");
  assert.ok(runAz);
  assert.equal(runAz.language, "python");
  assert.equal(runAz.handler.symbol, "run_az_command");
  assert.equal(runAz.declared_annotations.destructiveHint, true);
  assert.deepEqual(runAz.input_schema.parameter_names, ["command"]);
  assert.equal(runAz.input_schema.schema_format, "python-signature");
});

test("imports saved tools/list JSON as metadata-only tools", async () => {
  const report = await runScan("fixtures/tools-list");
  assert.equal(report.summary.tools_scanned, 2);
  assert.equal(report.summary.handlers_resolved, 0);
  assert.equal(report.summary.findings, 0);
  assert.deepEqual(report.project.languages, []);

  const deleteBranch = report.tools.find((tool) => tool.name === "delete_branch");
  assert.ok(deleteBranch);
  assert.equal(deleteBranch.language, "metadata");
  assert.equal(deleteBranch.handler.confidence, "metadata_only");
  assert.deepEqual(deleteBranch.input_schema.parameter_names, ["branch", "owner", "repo"]);
  assert.equal(deleteBranch.declared_annotations.destructiveHint, true);
});
