import { pathToFileURL } from "node:url";

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const SARIF_VERSION = "2.1.0";

function sarifLevel(severity) {
  if (severity === "critical" || severity === "high") {
    return "error";
  }
  if (severity === "medium") {
    return "warning";
  }
  return "note";
}

function securitySeverity(severity) {
  return {
    critical: "9.0",
    high: "8.0",
    medium: "5.0",
    low: "2.0",
    info: "0.0"
  }[severity] ?? "0.0";
}

function uniqueRules(findings) {
  const rules = new Map();
  for (const finding of findings) {
    if (rules.has(finding.id)) {
      continue;
    }
    rules.set(finding.id, {
      id: finding.id,
      name: finding.type,
      shortDescription: {
        text: finding.type.replaceAll("_", " ")
      },
      fullDescription: {
        text: finding.message
      },
      defaultConfiguration: {
        level: sarifLevel(finding.severity)
      },
      properties: {
        precision: finding.confidence === "source-backed" ? "high" : "medium",
        severity: finding.severity,
        confidence: finding.confidence,
        tags: ["security", "mcp", "hintlint", finding.type, finding.cwe_id].filter(Boolean)
      }
    });
  }
  return [...rules.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function primaryEvidence(finding) {
  return finding.evidence?.[0] ?? finding.dangerous_sink ?? finding.source_parameter ?? null;
}

function locationFor(evidence) {
  if (!evidence?.file) {
    return undefined;
  }
  return {
    physicalLocation: {
      artifactLocation: {
        uri: evidence.file
      },
      region: {
        startLine: evidence.line ?? 1
      }
    }
  };
}

function relatedLocations(finding, primary) {
  return (finding.evidence ?? [])
    .filter((evidence) => evidence.file && evidence.line)
    .filter((evidence) => evidence !== primary)
    .map((evidence, index) => ({
      id: index + 1,
      message: {
        text: `${evidence.category}: ${evidence.sink}`
      },
      physicalLocation: {
        artifactLocation: {
          uri: evidence.file
        },
        region: {
          startLine: evidence.line
        }
      }
    }));
}

function resultFor(finding) {
  const primary = primaryEvidence(finding);
  const location = locationFor(primary);
  const result = {
    ruleId: finding.id,
    level: sarifLevel(finding.severity),
    message: {
      text: finding.message
    },
    properties: {
      tool: finding.tool,
      type: finding.type,
      severity: finding.severity,
      confidence: finding.confidence,
      confidence_tier: finding.confidence_tier,
      declared_annotations: finding.declared_annotations,
      verified_behavior: finding.verified_behavior,
      suggested_annotations: finding.suggested_annotations,
      repair: finding.repair,
      cwe_id: finding.cwe_id,
      "security-severity": securitySeverity(finding.severity)
    },
    partialFingerprints: {
      hintlint: [
        finding.id,
        finding.tool,
        finding.type,
        primary?.file ?? "unknown",
        primary?.line ?? 0
      ].join(":")
    }
  };
  if (location) {
    result.locations = [location];
  }
  const related = relatedLocations(finding, primary);
  if (related.length > 0) {
    result.relatedLocations = related;
  }
  return result;
}

export function renderSarif(report) {
  const targetUri = pathToFileURL(`${report.target.replace(/\/$/, "")}/`).href;
  const sarif = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: "HintLint",
            informationUri: "https://github.com/hintlint/hintlint",
            semanticVersion: report.hintlint_version,
            rules: uniqueRules(report.findings)
          }
        },
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: report.scan_started_at,
            endTimeUtc: new Date(Date.parse(report.scan_started_at) + report.scan_duration_ms).toISOString(),
            workingDirectory: {
              uri: targetUri
            }
          }
        ],
        results: report.findings.map(resultFor),
        properties: {
          summary: report.summary,
          target: report.target,
          options: report.options
        }
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}
