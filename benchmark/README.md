# Benchmark

The M5 benchmark harness produces reproducible evidence artifacts before any public ecosystem claim.

Default run:

```bash
npm run benchmark
```

Outputs:

- `benchmark/results/reports/*.json`: raw HintLint reports with repo-relative targets.
- `benchmark/results/registry/*.registry.json`: compact registry ingestion artifacts.
- `benchmark/results/summary.json`: aggregate machine-readable statistics.
- `benchmark/results/annotation-drift-report.md`: Markdown report for review or publication.

The checked-in manifest uses local fixtures. Replace or extend `benchmark/manifest.json` with pinned source-available MCP server checkouts before making public prevalence claims.

For external repositories, clone them separately and add entries with `source.kind = "git"`, `source.url`, `source.commit`, and a local `source.path` pointing at the checkout. The harness intentionally does not clone from the network by default.
