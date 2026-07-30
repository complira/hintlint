import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub Action exposes SARIF, PR comment, and CI threshold paths", async () => {
  const action = await readFile("action.yml", "utf8");
  assert.match(action, /using: composite/);
  assert.match(action, /actions\/setup-node@v4/);
  assert.match(action, /--format sarif/);
  assert.match(action, /github\/codeql-action\/upload-sarif@v3/);
  assert.match(action, /actions\/github-script@v7/);
  assert.match(action, /--ci --fail-on/);
});
