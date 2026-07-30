import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("benchmark script writes aggregate report and registry artifacts", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "hintlint-benchmark-"));
  const { stdout } = await execFileAsync("node", [
    "scripts/scan-benchmark.js",
    "--out",
    outDir
  ]);

  assert.match(stdout, /HintLint benchmark: hintlint-m5-fixture-benchmark/);

  const summary = JSON.parse(await readFile(join(outDir, "summary.json"), "utf8"));
  assert.equal(summary.artifact_version, "hintlint.benchmark-summary.v1");
  assert.equal(summary.totals.servers_scanned, 4);
  assert.equal(summary.totals.tools_scanned, 17);
  assert.equal(summary.totals.source_backed_findings, 14);
  assert.equal(summary.totals.annotation_drift_findings, 6);
  assert.ok(summary.top_findings.some((finding) => finding.id === "HINTLINT-FLOW-PROCESS-001"));

  const artifact = JSON.parse(await readFile(join(outDir, "registry", "ts-basic.registry.json"), "utf8"));
  assert.equal(artifact.artifact_version, "hintlint.registry-artifact.v1");
  assert.equal(artifact.server.id, "ts-basic");
  assert.equal(artifact.summary.source_backed_findings, 2);

  await stat(join(outDir, "annotation-drift-report.md"));
});
