import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("CLI emits JSON report", async () => {
  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/ts-basic",
    "--format",
    "json"
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.summary.tools_scanned, 5);
  assert.equal(report.findings.length, 2);
  assert.equal(report.coverage.extraction_status, "supported");
  assert.equal(report.summary.findings_by_tier.L3, 2);
});

test("CLI emits SARIF report", async () => {
  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/ts-basic",
    "--format",
    "sarif"
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.version, "2.1.0");
  assert.equal(report.runs.length, 1);
  assert.equal(report.runs[0].tool.driver.name, "HintLint");
  assert.ok(report.runs[0].tool.driver.rules.some((rule) => rule.id === "HINTLINT-READONLY-001"));
  assert.ok(report.runs[0].results.some((result) => result.ruleId === "HINTLINT-READONLY-001"));
});

test("CLI emits registry artifact", async () => {
  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/ts-basic",
    "--format",
    "registry"
  ]);
  const artifact = JSON.parse(stdout);
  assert.equal(artifact.artifact_version, "hintlint.registry-artifact.v1");
  assert.equal(artifact.summary.tools_scanned, 5);
  assert.equal(artifact.summary.source_backed_findings, 2);
  assert.equal(artifact.summary.coverage_status, "supported");
  assert.equal(artifact.summary.findings_by_tier.L3, 2);
  assert.ok(artifact.tools.some((tool) => tool.name === "delete_customer" && tool.finding_count === 1));
});

test("CLI emits ML feature JSONL", async () => {
  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/tools-list",
    "--format",
    "features"
  ]);
  const records = stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(records.length, 2);
  assert.equal(records[0].record_version, "hintlint.ml-feature.v1");
});

test("CLI emits terminal report", async () => {
  const { stdout } = await execFileAsync("node", ["src/cli.js", "fixtures/py-basic"]);
  assert.match(stdout, /HintLint Report/);
  assert.match(stdout, /run_az_command/);
  assert.match(stdout, /HINTLINT-FLOW-PROCESS-001/);
});

test("CLI reads flat hintlint YAML config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-cli-"));
  await writeFile(join(dir, "hintlint.yaml"), "format: json\nfailOn: medium\n", "utf8");
  await writeFile(join(dir, "tools-list.json"), JSON.stringify({
    tools: [
      {
        name: "metadata_only_tool",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" }
          }
        },
        annotations: {
          readOnlyHint: true
        }
      }
    ]
  }), "utf8");

  const { stdout } = await execFileAsync("node", ["src/cli.js", dir]);
  const report = JSON.parse(stdout);
  assert.equal(report.options.config.endsWith("hintlint.yaml"), true);
  assert.equal(report.summary.tools_scanned, 1);
  assert.equal(report.tools[0].handler.confidence, "metadata_only");
});
