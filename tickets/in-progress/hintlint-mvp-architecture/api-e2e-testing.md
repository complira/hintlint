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

## Execution Results

```text
npm test
pass: 4
fail: 0
```

```text
npm run scan:fixtures
pass
```

## Waivers

None for this implementation slice.
