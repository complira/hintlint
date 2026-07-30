import assert from "node:assert/strict";
import test from "node:test";
import { shouldFail } from "../src/policy.js";

function reportWith(findings) {
  return { findings };
}

test("CI policy fails only on source-backed findings at or above threshold", () => {
  assert.equal(shouldFail(reportWith([
    { severity: "high", confidence: "source-backed" }
  ]), "high"), true);

  assert.equal(shouldFail(reportWith([
    { severity: "critical", confidence: "likely" }
  ]), "high"), false);

  assert.equal(shouldFail(reportWith([
    { severity: "medium", confidence: "source-backed" }
  ]), "high"), false);

  assert.equal(shouldFail(reportWith([
    { severity: "medium", confidence: "source-backed" }
  ]), "medium"), true);
});
