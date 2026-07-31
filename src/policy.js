export const SEVERITY_RANK = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const FAILING_EVIDENCE_TIERS = new Set(["L3", "L4"]);

function evidenceTier(finding) {
  if (finding.evidence_tier) {
    return finding.evidence_tier;
  }
  if (finding.confidence_tier && finding.confidence_tier !== "source-backed") {
    return finding.confidence_tier;
  }
  if (finding.confidence_tier === "source-backed") {
    return "L3";
  }
  if (finding.confidence === "source-backed") {
    return "L3";
  }
  return finding.evidence_tier ?? finding.confidence_tier ?? "L1";
}

export function shouldFail(report, failOn = "high") {
  const threshold = SEVERITY_RANK[failOn] ?? SEVERITY_RANK.high;
  return report.findings.some((finding) => {
    const rank = SEVERITY_RANK[finding.severity] ?? 0;
    return rank >= threshold && FAILING_EVIDENCE_TIERS.has(evidenceTier(finding));
  });
}
