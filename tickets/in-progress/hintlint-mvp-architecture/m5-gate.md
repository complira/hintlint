# M5 Gate: Public Evidence and Adoption Loop

## Status

Pass with constraints.

## Completed Exit Criteria

- Public benchmark manifest schema exists: `schemas/benchmark-manifest.schema.json`.
- Registry artifact schema exists: `schemas/registry-artifact.schema.json`.
- Reproducible benchmark script exists: `scripts/scan-benchmark.js`.
- Default benchmark manifest scans four source-available local fixtures.
- Generated Annotation Drift Report includes aggregate stats and methodology: `benchmark/results/annotation-drift-report.md`.
- Registry artifact format is documented in `docs/registry-artifact.md`.
- CLI supports `--format registry`.
- Benchmark run writes compact registry artifacts for each scanned server.
- JS/Python ML boundary is documented in `docs/ml-bridge.md`.

## Verification

- `npm test`: pass, 17/17.
- `npm run scan:fixtures`: pass.
- `npm run benchmark`: pass.
- Benchmark summary:
  - servers scanned: 4
  - tools scanned: 17
  - source-backed findings: 14
  - annotation drift findings: 6
  - unsafe-flow findings: 7
  - validation findings: 1

## Constraints

- The checked-in report is fixture-backed and must not be presented as public ecosystem prevalence data.
- No external MCP repositories are pinned in the benchmark manifest yet.
- No upstream maintainer PRs were opened from this environment.
- No partner conversations or partner-specific artifacts were generated.
- Semgrep live execution is still deferred.

## Next Milestone

M6: ML Advisory Research Preview.
