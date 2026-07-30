# M6 Gate: ML Advisory Research Preview

## Status

Pass with constraints.

## Completed Exit Criteria

- Labeling rubric exists: `ml/labeling-rubric.md`.
- Evaluation/no-go plan exists: `ml/evaluation-plan.md`.
- JS feature export exists through `--format features`.
- ML advice merge exists through `--ml-advice`.
- ML feature/advice schemas exist: `schemas/ml-feature.schema.json`, `schemas/ml-advice.schema.json`.
- Python sidecar scaffold exists under `python/hintlint_ml`.
- Dependency-free keyword baseline emits `likely`, `needs_review`, or `unknown`.
- Composite Action has opt-in ML inputs and a JS/Python file bridge path.
- Tests prove malformed `source-backed` ML advice is downgraded and cannot fail CI.

## Verification

- `npm test`: pass, 21/21.
- `node src/cli.js fixtures/tools-list --format features`: pass.
- `PYTHONPATH=python/hintlint_ml python3 -m hintlint_ml.classify --input <features> --output <advice>`: pass through tests.
- `node src/cli.js fixtures/tools-list --ml-advice <advice> --format json`: pass through tests.

## Constraints

- No 500-tool labeled dataset exists yet.
- No encoder or cross-encoder model is trained.
- No package-held-out ML benchmark is claimed.
- Python package is scaffolded locally but not published to PyPI.
- GitHub Action ML path is metadata/static tested but not live-run.
- ML advice is advisory-only and cannot create `source-backed` findings.

## Next Milestone

M7: Partner-Ready Evidence Engine.
