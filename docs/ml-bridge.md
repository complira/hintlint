# ML Bridge

HintLint's core scanner is JavaScript because the first distribution paths are npm, GitHub Actions, SARIF, and MCP server author workflows.

ML should be added as an optional Python track, not embedded into the core scanner.

## Boundary

The JS core owns:

- MCP tool extraction.
- Source evidence and Semgrep normalization.
- Annotation comparison.
- JSON, SARIF, registry artifacts, and CI behavior.

The Python ML package owns:

- Labeling workflows.
- Feature preparation for model training.
- Encoder and cross-encoder experiments.
- Calibration, abstention, and validation reports.
- Optional advisory inference.

## Data Contract

The bridge should use versioned JSONL files:

```text
hintlint report JSON -> features.jsonl -> hintlint-ml -> ml-advice.jsonl -> merged HintLint report
```

ML output must never create `source-backed` findings. It can only emit:

- `likely`
- `needs_review`
- `unknown`

CI failure must remain deterministic and source-backed by default.

## First Implementation Shape

Future M6 package:

```bash
node src/cli.js ./server --format json --output hintlint.json
python -m hintlint_ml.features --input hintlint.json --output features.jsonl
python -m hintlint_ml.classify --input features.jsonl --output ml-advice.jsonl
node src/cli.js ./server --ml-advice ml-advice.jsonl
```

Training and evaluation stay in Python. If inference distribution later becomes painful, export the calibrated model to ONNX or a service interface. That should be a later optimization after the model proves value.

## GitHub Actions Packaging

Release as two packages:

- npm: `hintlint`
- PyPI: `hintlint-ml`

The default GitHub Action should remain JS-only. When M6 adds ML, expose it as an explicit opt-in:

```yaml
- uses: hintlint/hintlint@v0
  with:
    target: .
    fail-on: high
    enable-ml: "true"
    python-version: "3.12"
    ml-package: "hintlint-ml==0.1.0"
```

The composite Action can then run:

```text
actions/setup-node -> npm HintLint CLI
actions/setup-python -> pip install hintlint-ml
node hintlint scan/export-features
python -m hintlint_ml.classify
node hintlint merge-ml
```

Keep the package boundary at files, not FFI:

- `hintlint.json`
- `features.jsonl`
- `ml-advice.jsonl`
- final merged report

If Python dependencies or model downloads make the composite Action too slow, add a separate Docker-based ML action later. Do not make the default JS Action pay that cost.
