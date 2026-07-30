export const SEVERITY_RANK = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function shouldFail(report, failOn = "high") {
  const threshold = SEVERITY_RANK[failOn] ?? SEVERITY_RANK.high;
  return report.findings.some((finding) => {
    const rank = SEVERITY_RANK[finding.severity] ?? 0;
    return rank >= threshold && finding.confidence === "source-backed";
  });
}
