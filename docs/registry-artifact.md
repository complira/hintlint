# Registry Artifact

HintLint registry artifacts are compact, evidence-bearing JSON documents for registries, gateways, and governance platforms.

They are not a trust score. They preserve the source-backed facts needed to make a policy decision elsewhere.

## Generate

```bash
node src/cli.js ./server --format registry --output hintlint.registry.json
```

For benchmark runs:

```bash
npm run benchmark
```

Registry artifacts are written to `benchmark/results/registry/`.

## Contract

Schema: `schemas/registry-artifact.schema.json`

Top-level fields:

- `artifact_version`: format version.
- `generated_at`: artifact timestamp.
- `hintlint_version`: scanner version.
- `server`: server identity and source metadata.
- `summary`: counts and highest severity.
- `tools`: tool inventory, handler confidence, declared annotations, and finding counts.
- `findings`: source-backed annotation drift and unsafe-flow evidence.

## Ingestion Guidance

Registries should treat `source-backed` findings as review evidence, not automatic enforcement.

Recommended handling:

- Display false-safe annotation findings near the affected tool.
- Use `suggested_annotations` to help maintainers patch metadata.
- Keep `dangerous_sink`, `source_parameter`, and `validator_status` visible for security review.
- Do not treat metadata-only scans as proof.
- Keep the raw HintLint report for audit traceability when possible.
