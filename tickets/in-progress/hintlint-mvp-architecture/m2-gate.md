# M2 Gate

## Decision

M2 complete with environment constraint.

The source evidence engine contract is implemented and fixture-tested. Semgrep JSON normalization is implemented, and a Semgrep-compatible rule pack exists, but live Semgrep execution was not validated because `semgrep` is not installed in this environment.

## Exit Criteria Check

| Exit Criterion | Status | Evidence |
| --- | --- | --- |
| Semgrep MCP rule pack detects initial sink taxonomy | Pass with constraint | `rules/semgrep/hintlint-mcp.yml`; `npm test` verifies rule IDs for filesystem, database, HTTP, subprocess, external-send, cloud, query, URL, and connection-string taxonomy. Live Semgrep execution not run. |
| Semgrep JSON is normalized into HintLint evidence records | Pass | `test/evidence.test.js` imports sample Semgrep JSON and emits normalized `engine = semgrep` records |
| Evidence attaches to a specific tool only when handler mapping confidence is sufficient | Pass | Semgrep sample line 65 attaches to `run_script`; helper line 70 remains `project_evidence` |
| MCP tool parameters are modeled as attacker-controlled sources | Pass | Evidence records include `source_parameter` for `query`, `account_name`, `database`, `destination_path`, and `command` |
| Initial taint rules cover query, URL/host, connection string, process, and filesystem sinks | Pass | `fixtures/py-taint`, `fixtures/ts-evidence`, `npm test` |
| Safe validators are recognized for strict allowlists, parameter binding, and path root containment | Pass | `safe_storage_account`, `safe_mysql_query`, `safe_download_artifact` evidence has `sanitizer.status = found` |
| Validation asymmetry fixture produces an actionable finding | Pass | `HINTLINT-VALIDATION-ASYMMETRY-001` on `unsafe_postgres_query` |
| Ambiguous project-level evidence is reported separately from tool-specific proof | Pass | `project_evidence[]` contains helper-level filesystem/process hits with `confidence = needs-review` |
| Fixture tests verify exact file, line, category, and sink | Pass | `test/evidence.test.js` checks exact lines and categories for Python/TypeScript fixtures |

## Verification Commands

```bash
npm test
npm run scan:fixtures
semgrep --version
```

## Verification Results

- `npm test`: pass, 10/10 tests.
- `npm run scan:fixtures`: pass.
- `semgrep --version`: command not found.

## Claims Allowed

- HintLint now emits normalized evidence records separate from findings.
- Source-backed evidence is only attached to resolved tool handlers.
- Metadata-only and helper-level evidence do not drive source-backed annotation findings.
- Semgrep JSON can be imported and normalized into the same evidence model.
- The rule pack defines the initial M2 taxonomy.

## Claims Not Allowed

- Semgrep rule pack has been live-validated in this environment.
- Whole-program dataflow or complete handler-to-sink reachability.
- Complete validator/sanitizer proof.
- Production-grade vulnerability coverage.

## Next Milestone

M3: Annotation Drift Verifier.

Priority:

1. Move comparator logic into a clearer behavior-inference layer.
2. Enrich findings with verified behavior labels and suggested annotation patches.
3. Snapshot terminal/JSON reports.
4. Tighten unsafe-flow repair guidance.
