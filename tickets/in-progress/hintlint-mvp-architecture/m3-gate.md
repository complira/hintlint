# M3 Gate

## Decision

M3 complete with constraints.

The annotation drift verifier now emits actionable finding payloads and stable report snapshots. It remains fixture-backed and evidence-engine-bound; it does not claim whole-program reachability or live Semgrep execution.

## Exit Criteria Check

| Exit Criterion | Status | Evidence |
| --- | --- | --- |
| Flags false `readOnlyHint: true` | Pass | `delete_customer`, `unsafe_postgres_query`; `npm run scan:fixtures` |
| Flags destructive behavior with missing/false `destructiveHint` | Pass | `delete_branch`; `HINTLINT-DESTRUCTIVE-001` |
| Flags external/open-world behavior with false `openWorldHint` | Pass | `send_invoice_email`, `unsafe_storage_account`, `update_issue` |
| Flags shell/process execution as high-risk capability evidence | Pass | `run_az_command`, `run_script`; `HINTLINT-FLOW-PROCESS-001` |
| Findings include tool name | Pass | `finding.tool` |
| Findings include declared annotations | Pass | `finding.declared_annotations` |
| Findings include verified behavior | Pass | `finding.verified_behavior` |
| Findings include source evidence | Pass | `finding.evidence[]` |
| Findings include confidence tier | Pass | `finding.confidence_tier` |
| Findings include severity | Pass | `finding.severity` |
| Findings include suggested annotation patch | Pass | `finding.suggested_annotations` and `finding.repair.suggested_annotations` for annotation findings |
| Unsafe-flow findings include source MCP parameter | Pass | `finding.source_parameter` |
| Unsafe-flow findings include dangerous sink | Pass | `finding.dangerous_sink` |
| Unsafe-flow findings include validator/sanitizer status | Pass | `finding.validator_status` |
| Unsafe-flow findings include repair guidance | Pass | `finding.repair` |
| Terminal and JSON reports are stable and snapshot-tested | Pass | `test/report-snapshots.test.js`, `test/snapshots/*` |
| High-confidence fixture findings are precise enough to become maintainer PRs | Pass with constraint | Fixture findings include file/line/rule/source/repair; real-repo PR readiness still depends on Semgrep/live-reachability validation |

## Verification Commands

```bash
npm test
npm run scan:fixtures
git diff --check
```

## Verification Results

- `npm test`: pass, 12/12 tests.
- `npm run scan:fixtures`: pass.

## Claims Allowed

- HintLint emits source-backed annotation drift findings for supported fixtures.
- Finding payloads include declared annotations, verified behavior, evidence, confidence tier, severity, repair guidance, and suggested annotation patches where applicable.
- Unsafe-flow findings include source parameter, dangerous sink, validator status, and repair guidance.
- Terminal and JSON report contracts are snapshot-tested.

## Claims Not Allowed

- Production-grade source reachability.
- Live Semgrep execution in this environment.
- Public benchmark superiority.
- Complete coverage for arbitrary MCP SDK patterns.

## Next Milestone

M4: CI and Developer Distribution.

Priority:

1. Add SARIF reporter.
2. Keep `--ci --fail-on high` source-backed-only behavior.
3. Add GitHub Action wrapper.
4. Document local and CI quickstart.
