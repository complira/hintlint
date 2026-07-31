import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("extracts exported TypeScript tool definition factories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-define-tool-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "tools.ts"), [
    "const CLICK_TOOL_NAME = 'click';",
    "export const click = definePageTool({",
    "  name: CLICK_TOOL_NAME,",
    "  description: 'Clicks on the provided element',",
    "  annotations: { readOnlyHint: false },",
    "  schema: {",
    "    uid: zod.string(),",
    "    includeSnapshot: zod.boolean().optional(),",
    "  },",
    "  handler: async (request, response) => {",
    "    await request.page.getElementByUid(request.params.uid);",
    "    response.appendResponseLine('clicked');",
    "  },",
    "});",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 1);
  const click = report.tools[0];
  assert.equal(click.name, "click");
  assert.equal(click.handler.confidence, "resolved");
  assert.equal(click.handler.symbol, "click");
  assert.equal(click.declared_annotations.readOnlyHint, false);
  assert.deepEqual(click.input_schema.parameter_names, ["includeSnapshot", "uid"]);
  assert.equal(click.extraction.pattern, "definePageTool");
});

test("extracts TypeScript static registries and addTools inline definitions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-ts-registry-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "tools.ts"), [
    "export const tools = [",
    "  {",
    "    name: 'list_projects',",
    "    description: 'List projects',",
    "    annotations: { readOnlyHint: true },",
    "    schema: { org: z.string() },",
    "    execute: async ({ org }) => {",
    "      return { content: [{ type: 'text', text: org }] };",
    "    },",
    "  },",
    "  {",
    "    name: 'archive_project',",
    "    description: 'Archive project',",
    "    annotations: { readOnlyHint: false, destructiveHint: false },",
    "    inputSchema: { projectId: z.string() },",
    "    run: archiveProject,",
    "  },",
    "];",
    "",
    "server.addTools(tools);",
    "for (const tool of tools) {",
    "  server.tool(tool.name, tool.description, tool.schema, tool.execute);",
    "}",
    "server.addTools([",
    "  {",
    "    name: 'inline_notify',",
    "    description: 'Send notification',",
    "    annotations: { readOnlyHint: false, openWorldHint: true },",
    "    schema: { message: z.string() },",
    "    callback: async ({ message }) => message,",
    "  },",
    "]);",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 3);
  assert.equal(report.summary.unsupported_patterns, 0);
  assert.equal(report.coverage.handler_mapping_rate, 1);

  const listProjects = report.tools.find((tool) => tool.name === "list_projects");
  assert.ok(listProjects);
  assert.equal(listProjects.extraction.pattern, "staticRegistry");
  assert.equal(listProjects.handler.confidence, "resolved");
  assert.deepEqual(listProjects.input_schema.parameter_names, ["org"]);

  const archiveProject = report.tools.find((tool) => tool.name === "archive_project");
  assert.ok(archiveProject);
  assert.equal(archiveProject.handler.symbol, "archiveProject");
  assert.deepEqual(archiveProject.input_schema.parameter_names, ["projectId"]);

  const inlineNotify = report.tools.find((tool) => tool.name === "inline_notify");
  assert.ok(inlineNotify);
  assert.equal(inlineNotify.extraction.pattern, "addToolsInline");
  assert.deepEqual(inlineNotify.input_schema.parameter_names, ["message"]);
});

test("extracts common TypeScript wrapper factories and handler fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-ts-wrapper-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "tools.ts"), [
    "function createTool(def) { return def; }",
    "const SEARCH_NAME = 'search_docs';",
    "export const searchDocs = createTool({",
    "  name: SEARCH_NAME,",
    "  description: 'Search docs',",
    "  annotations: { readOnlyHint: true },",
    "  inputSchema: { query: z.string() },",
    "  execute: async ({ query }) => query,",
    "});",
    "",
    "export const refund = makeTool({",
    "  name: 'approve_refund',",
    "  description: 'Approve refund',",
    "  annotations: { readOnlyHint: false, destructiveHint: false },",
    "  schema: { refundId: z.string() },",
    "  run: approveRefund,",
    "});",
    "",
    "export const publish = tool({",
    "  name: 'publish_report',",
    "  description: 'Publish report',",
    "  annotations: { readOnlyHint: false, openWorldHint: true },",
    "  schema: { reportId: z.string() },",
    "  callback: async ({ reportId }) => reportId,",
    "});",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 3);
  assert.equal(report.summary.unsupported_patterns, 0);
  assert.deepEqual(report.tools.map((tool) => tool.name).sort(), ["approve_refund", "publish_report", "search_docs"]);

  const searchDocs = report.tools.find((tool) => tool.name === "search_docs");
  assert.ok(searchDocs);
  assert.equal(searchDocs.extraction.pattern, "createTool");
  assert.equal(searchDocs.handler.symbol, "searchDocs");

  const refund = report.tools.find((tool) => tool.name === "approve_refund");
  assert.ok(refund);
  assert.equal(refund.extraction.pattern, "makeTool");
  assert.equal(refund.handler.symbol, "refund");
  assert.deepEqual(refund.input_schema.parameter_names, ["refundId"]);

  const publish = report.tools.find((tool) => tool.name === "publish_report");
  assert.ok(publish);
  assert.equal(publish.extraction.pattern, "toolFactory");
  assert.equal(publish.handler.symbol, "publish");
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

test("extracts Python bare @mcp.tool decorator and ToolAnnotations kwargs", async () => {
  const report = await runScan("fixtures/py-bare-decorator");
  assert.equal(report.summary.tools_scanned, 3);
  assert.deepEqual(report.project.languages, ["python"]);

  const listFiles = report.tools.find((tool) => tool.name === "list_files");
  assert.ok(listFiles);
  assert.equal(listFiles.language, "python");
  assert.equal(listFiles.handler.confidence, "resolved");
  assert.equal(listFiles.handler.symbol, "list_files");
  assert.deepEqual(listFiles.input_schema.parameter_names, ["directory"]);

  const deleteFile = report.tools.find((tool) => tool.name === "delete_file");
  assert.ok(deleteFile);
  assert.equal(deleteFile.handler.confidence, "resolved");

  const annotated = report.tools.find((tool) => tool.name === "annotated_tool");
  assert.ok(annotated);
  assert.equal(annotated.declared_annotations.destructiveHint, true);
  assert.equal(annotated.declared_annotations.readOnlyHint, false);
  assert.equal(annotated.declared_annotations.openWorldHint, true);
  assert.equal(annotated.declared_annotations.idempotentHint, false);
});

test("extracts TypeScript tools from user-defined wrapper factory with positional args", async () => {
  const report = await runScan("fixtures/ts-user-wrapper");
  const named = report.tools.filter((t) => !t.extraction?.dynamic_name);
  assert.equal(named.length, 2);
  assert.equal(named.filter((t) => t.handler.confidence === "resolved").length, 2);

  const getDevices = report.tools.find((t) => t.name === "get_devices");
  assert.ok(getDevices);
  assert.equal(getDevices.handler.confidence, "resolved");
  assert.equal(getDevices.extraction.pattern, "toolFactory");

  const reboot = report.tools.find((t) => t.name === "reboot_device");
  assert.ok(reboot);
  assert.equal(reboot.handler.confidence, "resolved");
});

test("extracts tools from ListToolsRequestSchema inline array", async () => {
  const report = await runScan("fixtures/ts-list-tools-handler");
  assert.equal(report.summary.tools_scanned, 3);
  assert.ok(report.tools.find((t) => t.name === "get_config"));
  assert.ok(report.tools.find((t) => t.name === "execute_command"));
  assert.ok(report.tools.find((t) => t.name === "write_file"));
});

test("resolves registerTool with property access obj.name", async () => {
  const report = await runScan("fixtures/ts-property-access");
  assert.equal(report.summary.tools_scanned, 2);
  assert.equal(report.summary.handlers_resolved, 2);

  const figma = report.tools.find((t) => t.name === "get_figma_data");
  assert.ok(figma);
  assert.equal(figma.handler.confidence, "resolved");

  const download = report.tools.find((t) => t.name === "download_images");
  assert.ok(download);
  assert.equal(download.handler.confidence, "resolved");
});

test("extracts tools from function returning array", async () => {
  const report = await runScan("fixtures/ts-function-returns-array");
  assert.equal(report.summary.tools_scanned, 3);
  assert.ok(report.tools.find((t) => t.name === "start_session"));
  assert.ok(report.tools.find((t) => t.name === "navigate_to"));
  assert.ok(report.tools.find((t) => t.name === "take_screenshot"));
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

test("classifies unsupported-language projects instead of silent zero-tool success", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-go-server-"));
  await writeFile(join(dir, "main.go"), [
    "package main",
    "",
    "func main() {",
    "  // MCP server implementation hidden in unsupported Go source.",
    "}",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 0);
  assert.equal(report.coverage.extraction_status, "unsupported_language");
  assert.deepEqual(report.coverage.unsupported_languages, ["go"]);
});

test("classifies MCP-like unsupported patterns when no tool is extracted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-dynamic-mcp-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "server.ts"), [
    "import { Server } from '@modelcontextprotocol/sdk/server/index.js';",
    "const server = new Server({ name: 'dynamic', version: '1.0.0' });",
    "const runtimeTools = await loadToolsFromDatabase();",
    "for (const runtimeTool of runtimeTools) {",
    "  server.setRequestHandler(runtimeTool.schema, runtimeTool.handler);",
    "}",
    ""
  ].join("\n"), "utf8");

  const report = await runScan(dir);
  assert.equal(report.summary.tools_scanned, 0);
  assert.equal(report.coverage.extraction_status, "unsupported_pattern");
  assert.equal(report.coverage.mcp_markers_detected, true);
  assert.match(report.coverage.extraction_reason, /MCP markers/);
});
