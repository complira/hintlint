import assert from "node:assert/strict";
import test from "node:test";
import { shouldFail } from "../src/policy.js";

function reportWith(findings) {
  return { findings };
}

test("CI policy fails only on L3/L4 findings at or above threshold", () => {
  assert.equal(shouldFail(reportWith([
    { severity: "high", confidence: "source-backed", evidence_tier: "L3" }
  ]), "high"), true);

  assert.equal(shouldFail(reportWith([
    { severity: "critical", confidence: "source-backed", evidence_tier: "L2" }
  ]), "high"), false);

  assert.equal(shouldFail(reportWith([
    { severity: "critical", confidence: "likely" }
  ]), "high"), false);

  assert.equal(shouldFail(reportWith([
    { severity: "medium", confidence: "source-backed", evidence_tier: "L3" }
  ]), "high"), false);

  assert.equal(shouldFail(reportWith([
    { severity: "medium", confidence: "source-backed", evidence_tier: "L4" }
  ]), "medium"), true);
});
