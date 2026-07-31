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
| SARIF output | M4 HL-052 | Pass | `node src/cli.js fixtures/ts-basic --format sarif --output /private/tmp/hintlint-ts-basic.sarif` emitted parseable SARIF 2.1.0; `npm test` checks rules/results |
| Conservative CI threshold | M4 HL-053 | Pass | `test/policy.test.js`; `fixtures/tools-list --ci --fail-on high` exits `0`, `fixtures/py-basic --ci --fail-on high` exits `1` |
| GitHub Action metadata | M4 HL-054 | Pass with environment note | `test/action.test.js` checks setup-node, SARIF, upload, PR comment, and CI gate paths; YAML parse succeeded |
| Standalone Semgrep rule-pack docs | M4 HL-060 | Pass with environment constraint | `rules/semgrep/README.md` documents direct Semgrep invocation; live Semgrep execution remains deferred |
| Benchmark manifest schema | M5 HL-061 | Pass | `schemas/benchmark-manifest.schema.json`, `benchmark/manifest.json`, `test/benchmark.test.js` |
| Reproducible benchmark scan script | M5 HL-062 | Pass | `npm run benchmark` scans 4 enabled source-available fixture entries |
| Annotation Drift Report generation | M5 HL-062 | Pass with scope constraint | `benchmark/results/annotation-drift-report.md` includes aggregate stats and methodology for fixture-backed run |
| Registry artifact format | M5 HL-064 | Pass | `schemas/registry-artifact.schema.json`, `docs/registry-artifact.md`, `--format registry`, benchmark registry artifacts |
| Maintainer PR workflow | M5 HL-063 | Not executed | Public upstream targets and GitHub remote workflow are not configured in this environment |
| Partner evidence artifacts | M5 HL-064 | Partial | Fixture-backed registry artifacts exist; external partner artifacts require public source scan manifest |
| Python ML bridge boundary | M6 prep | Pass | `docs/ml-bridge.md` defines optional Python sidecar boundary and advisory-only confidence tiers |
| ML feature export | M6 HL-070, HL-071 | Pass | `node src/cli.js fixtures/tools-list --format features` emits `hintlint.ml-feature.v1` JSONL |
| Python advisory sidecar | M6 HL-072 | Pass with constraints | `test/ml-bridge.test.js` runs `PYTHONPATH=python/hintlint_ml python3 -m hintlint_ml.classify`; output is keyword baseline advice, not trained ML |
| ML advice merge | M6 HL-075 | Pass | `--ml-advice` attaches advisory records to tools and report metadata |
| ML cannot create source-backed or CI-failing findings | M6 HL-075 | Pass | Test downgrades malformed `source-backed` ML confidence to `needs_review`; metadata-only target with ML advice exits `0` under `--ci --fail-on info` |
| Action opt-in ML path | M6 packaging | Pass with environment note | `action.yml` exposes `enable-ml`, setup-python, pip install, feature export, sidecar classify, and merge path; not run in live GitHub Actions |
| Encoder/cross-encoder validation | M6 HL-073, HL-074 | Not executed | No labeled dataset or model dependencies are present; gate remains pass with constraints |
| Coverage taxonomy | M7 HL-080, HL-085 | Pass | `npm test` verifies unsupported-language and MCP-like unsupported-pattern projects are classified instead of silent zero-tool success |
| Evidence tiers | M7 HL-088 | Pass | `npm test` verifies built-in and Semgrep evidence records use `L2` for project evidence and `L3` for handler-scoped evidence |
| Tier-based CI gate | M7 HL-088 | Pass | `test/policy.test.js` verifies CI fails only for configured severities at `L3`/`L4`; explicit `L2` findings do not fail |
| Public scan coverage aggregation | M7 HL-085 | Pass | `node scripts/scan-public-mcp.js --skip-fetch --semgrep docker --limit 2` ran outside sandbox and generated coverage/tier counts for 2 repositories |
| TypeScript static registry extraction | M7 HL-081 | Pass | `test/extractors.test.js` covers `export const tools = [...]`, named handler fields, `server.addTools(tools)`, and simple `server.tool(tool.name, ...)` loop duplicate suppression |
| TypeScript wrapper factory extraction | M7 HL-082 | Pass | `test/extractors.test.js` covers `createTool`, `makeTool`, plain `tool`, const-string names, and `execute`/`run`/`callback` handlers |
| TypeScript local helper reachability | M7 HL-086 | Pass | `test/evidence.test.js` verifies handler `delete_customer -> deleteCustomer -> db.customer.delete` promotes helper evidence from project-level to `L3` tool evidence |
| Semgrep helper evidence promotion | M7 HL-086 | Pass | `test/evidence.test.js` verifies Semgrep project evidence inside a reachable TypeScript helper is promoted to `L3` and participates in annotation drift findings |
| Full public MCP scan | M7 HL-089 prep | Pass with review constraint | `node scripts/scan-public-mcp.js --skip-fetch --semgrep docker` scanned 20 repos, 1,010 tools, 815 handlers, 25 `L3` candidate findings, 0 failures |

## Execution Results

```text
npm test
pass: 35
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

```text
ruby -e 'require "yaml"; YAML.load_file("action.yml"); YAML.load_file(".github/workflows/ci.yml"); puts "yaml ok"'
pass
```

```text
npm run benchmark
pass: 4 servers, 17 tools, 14 source-backed findings
```

```text
node scripts/scan-public-mcp.js --skip-fetch --semgrep docker --limit 2
pass after coverage slice: 2 servers, 61 tools, 58 handlers, 326 L2 project evidence records, 0 failures
pass after TS/JS extractor breadth: 2 servers, 66 tools, 58 handlers, 326 L2 project evidence records, 0 failures
pass after TS/JS reachability: 2 servers, 66 tools, 58 handlers, 326 L2 project evidence records, 0 findings, 0 failures
```

```text
node scripts/scan-public-mcp.js --skip-fetch --semgrep docker
pass: 20 servers, 1,010 tools, 815 handlers, 43 L3 source evidence records, 4,568 L2 project evidence records, 25 L3 candidate findings, 0 failures
constraint: findings are unreviewed scanner candidates
```

## Waivers

None for this implementation slice.
