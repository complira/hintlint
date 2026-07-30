# Scientific Validation

- Gate Decision: Pass with constraints
- Problem Type: Hybrid classification, ranking, and abstaining verification support
- Production Objective: Improve triage and coverage for ambiguous MCP tool behavior without replacing deterministic source evidence.

## Data Inventory and Distribution

Required before training:

- Tool name, description, input schema, output schema, declared annotations.
- Handler snippets and linked source evidence.
- Semgrep sink categories and confidence.
- Human labels for behavior classes.
- Package/server metadata and language/framework.

Expected distribution:

- Heavy skew toward low-risk read/list/search tools.
- Sparse destructive, financial, identity, and irreversible side-effect labels.
- Language/framework imbalance across TypeScript, Python, Go, Java, and hosted servers.
- Label ambiguity around `openWorldHint`, idempotence, archive/disable/suspend operations, and additive vs destructive writes.

## Target / Labels / Proxy Ground Truth

Primary labels:

- `read_only`
- `writes_internal_state`
- `external_side_effect`
- `destructive`
- `irreversible`
- `idempotent`
- `open_world`
- `financial_action`
- `identity_or_access_action`
- `requires_human_approval`

Ground truth must be human-labeled from source evidence, not inferred only from names.

## Split, Backtest, or Holdout Strategy

- Split by server/package, not by tool row, to avoid near-duplicate leakage.
- Hold out popular servers for realistic launch evaluation.
- Maintain language-specific slices.
- Maintain a high-risk slice for destructive/external/financial/identity tools.

## Baselines

Required baselines:

- Keyword/name heuristic.
- Semgrep rule-only classifier.
- Declared annotation self-report.
- Simple linear or tree classifier on bag-of-words/schema features.

ML must beat baselines on ambiguous tools without increasing false-safe verdicts.

## Candidate Method Fit

Phase 1:

- No production ML. Use deterministic rules and mark ambiguous cases as `unknown`.

Phase 2:

- Multi-label encoder classifier using ModernBERT or DeBERTa-style model.
- Inputs: tool name, description, schema summary, handler snippet, sink facts.

Phase 3:

- Cross-encoder pair classifier.
- Input pair: `{tool definition + evidence}` and `{behavior label definition}`.
- Output: entail, contradict, unknown.

The cross-encoder is fit for semantic relation judgment, but too expensive and data-hungry for day-one enforcement.

## Metrics and Threshold Policy

Primary metric:

- False-safe rate for tools marked verified read-only.

Secondary metrics:

- Precision/recall/F1 by label.
- Precision of high-severity mismatch findings.
- Coverage: percentage of tools receiving source-backed verdicts.
- Abstain rate.
- Calibration error for confidence buckets.

Threshold policy:

- Only deterministic evidence can produce `verified`.
- ML can produce `likely` or `needs_review`.
- ML cannot downgrade high-confidence source evidence.
- ML cannot mark a tool safe when rules or source evidence indicate mutation/destruction/external side effects.

## Leakage Checks

No-go leakage risks:

- Splitting train/test by tool row while tools from same server appear in both.
- Including declared annotations as targets without checking source truth.
- Training on Semgrep findings and claiming independent validation against the same rules.
- Calibrating thresholds on public benchmark examples used in launch claims.

## Robustness and Sensitivity Checks

Required:

- Evaluate by language/framework.
- Evaluate by action category.
- Evaluate short vs detailed descriptions.
- Evaluate tools with misleading benign names.
- Evaluate tools with no descriptions.
- Evaluate source evidence present vs absent.
- Run threshold sensitivity around false-safe operating points.

## Failure Modes

- ML over-trusts names like `archive`, `sync`, `reconcile`, `approve`, `rotate`.
- Model fails on domain-specific SDK calls not seen in training.
- Model learns annotation conventions rather than behavior.
- Model increases false-safe rate to improve aggregate accuracy.
- Tool behavior is deployment-specific and cannot be resolved from source alone.

## No-Go Conditions

- Fewer than 500 high-quality labeled tools for any claimed model benchmark.
- No package-level holdout.
- No false-safe metric.
- No calibrated abstention policy.
- ML verdict presented as proof.
- Source-unavailable tools marked as verified.

## Decision Rationale

Proceed with ML research and dataset collection, but do not ship ML-backed enforcement in MVP. The first public version should be deterministic and evidence-first. ML becomes useful after the benchmark exists and only as an advisory/ranking layer.
