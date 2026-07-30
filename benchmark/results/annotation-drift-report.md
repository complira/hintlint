# HintLint Annotation Drift Report

Generated: 2026-07-30T06:35:50.808Z

## Scope

Local source-available fixtures. This is a reproducibility harness, not an ecosystem prevalence claim.

Claim level: fixture

This report counts only source-backed HintLint findings as evidence. Metadata-only scans and skipped entries are not treated as proof.

## Aggregate Stats

- Servers scanned: 4
- Tools scanned: 17
- Source evidence records: 16
- Findings: 14
- Source-backed findings: 14
- Annotation drift findings: 6
- Unsafe-flow findings: 7
- Validation-asymmetry findings: 1

## Finding Counts

| Finding | Count |
| --- | --- |
| HINTLINT-DESTRUCTIVE-001 | 1 |
| HINTLINT-FLOW-CONNECTION-001 | 1 |
| HINTLINT-FLOW-FILESYSTEM-001 | 1 |
| HINTLINT-FLOW-PROCESS-001 | 2 |
| HINTLINT-FLOW-QUERY-001 | 1 |
| HINTLINT-FLOW-URL-001 | 2 |
| HINTLINT-OPEN-WORLD-001 | 3 |
| HINTLINT-READONLY-001 | 2 |
| HINTLINT-VALIDATION-ASYMMETRY-001 | 1 |

## Server Results

| Server | Tools | Evidence | Findings | Source-backed |
| --- | --- | --- | --- | --- |
| ts-basic | 5 | 4 | 2 | 2 |
| py-basic | 3 | 2 | 2 | 2 |
| py-taint | 6 | 6 | 6 | 6 |
| ts-evidence | 3 | 4 | 4 | 4 |

## Top Source-Backed Findings

| Server | Tool | Severity | Finding | Evidence |
| --- | --- | --- | --- | --- |
| py-basic | run_az_command | critical | HINTLINT-FLOW-PROCESS-001 | server.py:21 |
| py-taint | unsafe_postgres_query | critical | HINTLINT-FLOW-QUERY-001 | server.py:21 |
| ts-evidence | run_script | critical | HINTLINT-FLOW-PROCESS-001 | src/server.ts:65 |
| py-basic | download_artifact | high | HINTLINT-FLOW-FILESYSTEM-001 | server.py:29 |
| py-taint | unsafe_connection_string | high | HINTLINT-FLOW-CONNECTION-001 | server.py:63 |
| py-taint | unsafe_postgres_query | high | HINTLINT-READONLY-001 | server.py:21 |
| py-taint | unsafe_storage_account | high | HINTLINT-FLOW-URL-001 | server.py:40 |
| ts-basic | delete_customer | high | HINTLINT-READONLY-001 | src/server.ts:36 |
| ts-evidence | delete_branch | high | HINTLINT-DESTRUCTIVE-001 | src/server.ts:46 |
| ts-evidence | update_issue | high | HINTLINT-FLOW-URL-001 | src/server.ts:24 |
| py-taint | unsafe_postgres_query | medium | HINTLINT-VALIDATION-ASYMMETRY-001 | server.py:21 |
| py-taint | unsafe_storage_account | medium | HINTLINT-OPEN-WORLD-001 | server.py:40 |

## Methodology

- Run `node scripts/scan-benchmark.js` from the repository root.
- The script scans enabled entries from `benchmark/manifest.json`.
- Raw HintLint reports are written to `benchmark/results/reports/`.
- Registry artifacts are written to `benchmark/results/registry/`.
- Aggregate stats are written to `benchmark/results/summary.json`.

## Constraints

- This checked-in run uses local fixtures, not a public ecosystem sample.
- Public prevalence claims require a curated external manifest and reproducible commit pins.
- Semgrep live execution remains deferred unless Semgrep JSON is supplied separately.
- Upstream maintainer PRs are not opened by this script.
