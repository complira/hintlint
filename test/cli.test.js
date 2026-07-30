import assert from "node:assert/strict";
import { execFile } from "node:child_process";
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
  assert.equal(report.summary.tools_scanned, 4);
  assert.equal(report.findings.length, 2);
});

test("CLI emits terminal report", async () => {
  const { stdout } = await execFileAsync("node", ["src/cli.js", "fixtures/py-basic"]);
  assert.match(stdout, /HintLint Report/);
  assert.match(stdout, /run_az_command/);
  assert.match(stdout, /HINTLINT-FLOW-PROCESS-001/);
});
