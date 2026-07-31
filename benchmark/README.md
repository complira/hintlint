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

The checked-in fixture manifest uses local fixtures. Replace or extend `benchmark/manifest.json` with pinned source-available MCP server checkouts before making public prevalence claims.

## Public MCP Pilot

The public scan pilot is separate:

```bash
npm run benchmark:public
```

It reads `benchmark/public-mcp-manifest.json`, clones enabled `git` sources into ignored `benchmark/external/`, records the exact scanned commits, runs the HintLint Semgrep rule pack when available, and writes ignored outputs under `benchmark/results-public/`.

Useful local run while Docker is unavailable:

```bash
node scripts/scan-public-mcp.js --semgrep local --semgrep-bin .venv-semgrep/bin/semgrep
```

Docker run when the daemon is available:

```bash
node scripts/scan-public-mcp.js --semgrep docker
```

Generated public-scan findings are unreviewed candidates. Publish only after manual review of each high-impact finding and after pinning exact commits in the manifest or generated summary.
