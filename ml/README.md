# ML Advisory Track

M6 provides an advisory bridge, not a production ML classifier.

Current pieces:

- `ml/labeling-rubric.md`: human behavior-label guide.
- `ml/evaluation-plan.md`: validation and no-go criteria.
- `python/hintlint_ml/`: dependency-free Python sidecar scaffold.
- `node src/cli.js --format features`: JS feature export.
- `node src/cli.js --ml-advice ml-advice.jsonl`: advisory merge.

Local example:

```bash
node src/cli.js fixtures/tools-list --format features --output features.jsonl
PYTHONPATH=python/hintlint_ml python3 -m hintlint_ml.classify --input features.jsonl --output ml-advice.jsonl
node src/cli.js fixtures/tools-list --ml-advice ml-advice.jsonl --format json
```

Rules:

- ML advice is advisory-only.
- ML advice cannot create `source-backed` findings.
- ML advice cannot fail CI by default.
- Invalid `source-backed` ML confidence is downgraded to `needs_review`.
