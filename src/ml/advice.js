import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ALLOWED_CONFIDENCE = new Set(["likely", "needs_review", "unknown"]);

function normalizeConfidence(confidence) {
  return ALLOWED_CONFIDENCE.has(confidence) ? confidence : "needs_review";
}

export function parseMlAdviceJsonl(text) {
  return text.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid ML advice JSONL on line ${index + 1}: ${error.message}`);
      }
    });
}

export async function readMlAdvice(filePath) {
  return parseMlAdviceJsonl(await readFile(resolve(filePath), "utf8"));
}

function sanitizeAdvice(record) {
  const confidence = normalizeConfidence(record.confidence);
  const downgraded = confidence !== record.confidence;
  return {
    record_version: "hintlint.ml-advice.v1",
    tool: String(record.tool ?? ""),
    confidence,
    labels: record.labels ?? {},
    reason: record.reason ?? "No reason supplied.",
    model: record.model ?? {
      name: "unknown",
      version: "unknown",
      kind: "advisory"
    },
    features: record.features ?? {},
    validation: {
      advisory_only: true,
      source_backed: false,
      downgraded
    }
  };
}

function countByConfidence(records) {
  return records.reduce((counts, record) => {
    counts[record.confidence] = (counts[record.confidence] ?? 0) + 1;
    return counts;
  }, {});
}

export function mergeMlAdvice(report, adviceRecords) {
  const records = adviceRecords.map(sanitizeAdvice).filter((record) => record.tool);
  const byTool = new Map();
  for (const record of records) {
    if (!byTool.has(record.tool)) {
      byTool.set(record.tool, []);
    }
    byTool.get(record.tool).push(record);
  }

  return {
    ...report,
    tools: report.tools.map((tool) => ({
      ...tool,
      ml_advice: byTool.get(tool.name) ?? []
    })),
    ml_advice: {
      artifact_version: "hintlint.ml-advice.v1",
      advisory_only: true,
      records: records.length,
      downgraded_records: records.filter((record) => record.validation.downgraded).length,
      counts_by_confidence: countByConfidence(records),
      records_detail: records
    }
  };
}
