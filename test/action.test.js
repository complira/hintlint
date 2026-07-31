import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub Action exposes SARIF, PR comment, and CI threshold paths", async () => {
  const action = await readFile("action.yml", "utf8");
  assert.match(action, /using: composite/);
  assert.match(action, /actions\/setup-node@/);
  assert.match(action, /actions\/setup-python@/);
  assert.match(action, /enable-ml/);
  assert.match(action, /python -m hintlint_ml\.classify/);
  assert.match(action, /--format sarif/);
  assert.match(action, /github\/codeql-action\/upload-sarif@/);
  assert.match(action, /actions\/github-script@/);
  assert.match(action, /--ci --fail-on/);
});
