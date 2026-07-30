import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseJsonl(text) {
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("CLI exports ML feature JSONL", async () => {
  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/ts-basic",
    "--format",
    "features"
  ]);
  const records = parseJsonl(stdout);
  assert.equal(records.length, 5);
  assert.equal(records[0].record_version, "hintlint.ml-feature.v1");
  assert.ok(records.some((record) => record.tool.name === "delete_customer"));
  assert.ok(records.find((record) => record.tool.name === "delete_customer").evidence.source_backed);
});

test("Python ML sidecar emits advisory advice and JS merges it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-ml-"));
  const featuresPath = join(dir, "features.jsonl");
  const advicePath = join(dir, "ml-advice.jsonl");

  await execFileAsync("node", [
    "src/cli.js",
    "fixtures/tools-list",
    "--format",
    "features",
    "--output",
    featuresPath
  ]);

  await execFileAsync("python3", [
    "-m",
    "hintlint_ml.classify",
    "--input",
    featuresPath,
    "--output",
    advicePath
  ], {
    env: {
      ...process.env,
      PYTHONPATH: "python/hintlint_ml"
    }
  });

  const advice = parseJsonl(await readFile(advicePath, "utf8"));
  assert.equal(advice.length, 2);
  assert.ok(advice.every((record) => record.confidence !== "source-backed"));

  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/tools-list",
    "--ml-advice",
    advicePath,
    "--format",
    "json"
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.ml_advice.records, 2);
  assert.equal(report.ml_advice.advisory_only, true);
  assert.equal(report.findings.length, 0);
  assert.ok(report.tools.some((tool) => tool.ml_advice.length > 0));
});

test("ML advice is downgraded if it claims source-backed confidence and cannot fail CI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hintlint-ml-downgrade-"));
  const advicePath = join(dir, "bad-advice.jsonl");
  await writeFile(advicePath, `${JSON.stringify({
    record_version: "hintlint.ml-advice.v1",
    tool: "list_issues",
    confidence: "source-backed",
    labels: {
      read_only: false,
      external_side_effect: true,
      requires_human_approval: true
    },
    reason: "malformed test advice",
    model: {
      name: "test",
      version: "0",
      kind: "test"
    }
  })}\n`, "utf8");

  const { stdout } = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/tools-list",
    "--ml-advice",
    advicePath,
    "--format",
    "json"
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.ml_advice.downgraded_records, 1);
  assert.equal(report.tools.find((tool) => tool.name === "list_issues").ml_advice[0].confidence, "needs_review");

  const ci = await execFileAsync("node", [
    "src/cli.js",
    "fixtures/tools-list",
    "--ml-advice",
    advicePath,
    "--ci",
    "--fail-on",
    "info",
    "--format",
    "json"
  ]);
  assert.equal(JSON.parse(ci.stdout).findings.length, 0);
});
