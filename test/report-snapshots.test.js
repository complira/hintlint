import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runScan } from "../src/index.js";
import { renderJson } from "../src/reporters/json.js";
import { renderTerminal } from "../src/reporters/terminal.js";

function compactFinding(finding) {
  return {
    id: finding.id,
    severity: finding.severity,
    type: finding.type,
    tool: finding.tool,
    confidence_tier: finding.confidence_tier,
    declared_annotations: finding.declared_annotations,
    verified_behavior: {
      readOnlyHint: finding.verified_behavior.readOnlyHint,
      destructiveHint: finding.verified_behavior.destructiveHint,
      openWorldHint: finding.verified_behavior.openWorldHint,
      unsafe_flows: finding.verified_behavior.unsafe_flows,
      evidence_categories: finding.verified_behavior.evidence_categories
    },
    source_parameter: finding.source_parameter?.name ?? null,
    dangerous_sink: finding.dangerous_sink
      ? {
          category: finding.dangerous_sink.category,
          sink_kind: finding.dangerous_sink.sink_kind,
          file: finding.dangerous_sink.file,
          line: finding.dangerous_sink.line,
          rule_id: finding.dangerous_sink.rule_id
        }
      : null,
    validator_status: finding.validator_status?.status ?? null,
    repair: {
      type: finding.repair?.type,
      summary: finding.repair?.summary
    },
    suggested_annotations: finding.suggested_annotations ?? null
  };
}

function jsonFindingSnapshot(report) {
  return {
    summary: report.summary,
    findings: report.findings.map(compactFinding)
  };
}

test("JSON finding report contract stays stable", async () => {
  const report = await runScan("fixtures/py-taint");
  const actual = renderJson(jsonFindingSnapshot(report));
  const expected = await readFile("test/snapshots/m3-py-taint.findings.json", "utf8");
  assert.equal(actual, expected);
});

test("terminal report contract stays stable", async () => {
  const report = await runScan("fixtures/ts-evidence");
  report.target = "<target>";
  const actual = renderTerminal(report);
  const expected = await readFile("test/snapshots/m3-ts-evidence.terminal.txt", "utf8");
  assert.equal(actual, expected);
});
