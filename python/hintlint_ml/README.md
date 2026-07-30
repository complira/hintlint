# hintlint-ml

Python sidecar scaffold for HintLint advisory ML.

This package currently ships a dependency-free keyword baseline so the JS/Python bridge can be tested before real model dependencies are introduced.

Local development:

```bash
PYTHONPATH=python/hintlint_ml python3 -m hintlint_ml.classify --input features.jsonl --output ml-advice.jsonl
```

Future package:

```bash
pip install hintlint-ml
python -m hintlint_ml.classify --input features.jsonl --output ml-advice.jsonl
```

The sidecar must emit `likely`, `needs_review`, or `unknown`. It must never emit trusted `source-backed` findings.
