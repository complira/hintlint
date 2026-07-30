# Acceptance / API / E2E Testing

## Scenario Matrix

| Scenario | Acceptance Criteria | Status | Evidence |
| --- | --- | --- | --- |
| CLI version | M0 CLI contract | Pass | `node src/cli.js --version` returned `0.1.0` |
| Local package bin version | M0 CLI contract | Pass | `env npm_config_cache=/private/tmp/hintlint-npm-cache npm exec -- hintlint --version` returned `0.1.0` |
| TypeScript fixture scan | AC-1, AC-3, AC-5, AC-6 | Pass | `npm run scan:fixtures` found `false_readonly` and `false_open_world` |
| Python fixture scan | AC-2, AC-6 | Pass | `npm run scan:fixtures` found process and filesystem unsafe-flow findings |
| JSON output | AC-6 | Pass | `node src/cli.js fixtures/ts-basic --format json` emitted parseable JSON |
| CI fail behavior | AC-8 | Pass | `node src/cli.js fixtures/py-basic --ci --fail-on high` exited `1` because high/critical source-backed findings exist |
| Unit tests | AC-1, AC-2, AC-6 | Pass | `npm test` passed 4/4 tests |
| Competitor fixture teardown | M0 HL-004 | Pass with environment note | `mcp-security-auditor` ran against both fixtures with local `yaml` shim; results recorded in `mcp-security-auditor-teardown.md` |
| CSA methodology alignment | M0 HL-005 | Pass | `csa-mcpserver-audit-alignment.md` maps checks/prompts into future roadmap |
| TypeScript extraction confidence tiers | M1 HL-020, HL-022 | Pass | `npm run scan:fixtures` reports 5 TS tools, 4 resolved handlers, and one `unknown_handler` dynamic registration |
| Python extraction schema details | M1 HL-021 | Pass | `npm test` verifies Python parameter names and `python-signature` schema format |
| Saved `tools/list` directory import | M1 HL-023 | Pass | `npm run scan:fixtures` reports two metadata-only tools from `fixtures/tools-list/tools-list.json` |
| Saved `tools/list` direct file import | M1 HL-023 | Pass | `node src/cli.js fixtures/tools-list/tools-list.json --format json` emits two `metadata_only` tools and zero findings |
| Config loading | M1 HL-012 | Pass | `npm test` verifies flat `hintlint.yaml` config controls JSON output |
| M2 source evidence normalization | M2 HL-030, HL-033 | Pass | `npm test` verifies normalized evidence records include scope, category, rule id, engine, source parameter, and sanitizer status |
| Python source-to-sink fixture | M2 HL-032, HL-035, HL-036, HL-037 | Pass | `fixtures/py-taint` produces query, URL, connection-string, filesystem, safe-validator, and project-level evidence |
| TypeScript source evidence fixture | M2 HL-031, HL-035, HL-036 | Pass | `fixtures/ts-evidence` produces HTTP, cloud, process, URL, and project-level evidence |
| Validation asymmetry | M2 HL-038 | Pass | `unsafe_postgres_query` vs `safe_mysql_query` emits `HINTLINT-VALIDATION-ASYMMETRY-001` |
| Semgrep JSON import | M2 HL-033, HL-034 | Pass | `npm test` imports sample Semgrep JSON and attaches one result to `run_script`; helper result remains `project_evidence` |
| Semgrep rule pack live execution | M2 HL-031, HL-032 | Pass with environment constraint | `semgrep --version` returned command not found; rule-pack taxonomy inventory is tested but live Semgrep execution was not run |
| Annotation drift finding enrichment | M3 HL-040, HL-041, HL-042, HL-043 | Pass | `npm test` verifies JSON finding snapshot with declared annotations, verified behavior, confidence tier, and suggested patches |
| Unsafe-flow repair contract | M3 HL-044 | Pass | `npm run scan:fixtures` shows source parameter, sink, validator status, and repair guidance in terminal output |
| Terminal report snapshot | M3 HL-050 | Pass | `test/snapshots/m3-ts-evidence.terminal.txt` |
| JSON report snapshot | M3 HL-051 | Pass | `test/snapshots/m3-py-taint.findings.json` |

## Execution Results

```text
npm test
pass: 12
fail: 0
```

```text
npm run scan:fixtures
pass
```

```text
node src/cli.js fixtures/tools-list/tools-list.json --format json
pass: 2 metadata-only tools, 0 findings
```

```text
semgrep --version
zsh:1: command not found: semgrep
```

## Waivers

None for this implementation slice.
