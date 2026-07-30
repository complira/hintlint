# HintLint ML Evaluation Plan

## Gate

Current gate: `Pass with constraints`.

The M6 implementation is an advisory bridge and keyword baseline. It is not a validated production classifier.

## Required Baselines

- Declared annotation self-report.
- Keyword/name heuristic.
- Rule-only deterministic HintLint evidence.
- Future simple bag-of-words/schema classifier.

## Primary Metric

False-safe rate: cases where ML advice would mark a mutating, destructive, external, or approval-required tool as safe.

Target for any future default-on advisory model:

- zero observed false-safe examples on high-risk holdout slices,
- package-held-out validation,
- calibrated abstention,
- no CI failure from ML-only advice.

## Holdout Strategy

- Split by MCP server/package.
- Preserve language slices.
- Preserve high-risk slices for destructive, financial, identity/access, external side-effect, and process execution behavior.

## No-Go Conditions

- Fewer than 500 manually reviewed tools.
- No package-level holdout.
- No false-safe metric.
- Model output represented as proof.
- ML output allowed to create `source-backed` findings.
