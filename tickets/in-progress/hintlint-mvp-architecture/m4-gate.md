# M4 Gate: CI and Developer Distribution

## Status

Pass with constraints.

## Completed Exit Criteria

- SARIF reporter emits SARIF 2.1.0 with HintLint rules, result levels, evidence locations, related locations, fingerprints, and finding properties.
- CLI supports `--format sarif` and `--output`.
- CI fail policy is isolated in `src/policy.js` and fails only on source-backed findings at or above the threshold.
- Composite GitHub Action generates SARIF/text reports, can upload SARIF, can comment on pull requests, and applies the CI threshold after report generation.
- Repository CI workflow runs tests, fixture scans, and a SARIF smoke command.
- README documents local, CI, and GitHub Action usage.
- Semgrep rule-pack README documents independent Semgrep invocation.

## Verification

- `npm test`: pass, 15/15.
- `npm run scan:fixtures`: pass.
- `node src/cli.js fixtures/ts-basic --format sarif --output /private/tmp/hintlint-ts-basic.sarif`: pass.
- `node src/cli.js fixtures/tools-list --ci --fail-on high`: exits `0`.
- `node src/cli.js fixtures/py-basic --ci --fail-on high`: exits `1` as expected.
- `ruby -e 'require "yaml"; YAML.load_file("action.yml"); YAML.load_file(".github/workflows/ci.yml"); puts "yaml ok"'`: pass.
- `git diff --check`: pass.

## Constraints

- GitHub Action upload/comment paths are static-tested and YAML-parse-tested, but not executed in a live GitHub PR.
- Semgrep binary is still not installed locally; standalone rule-pack docs are present, but live Semgrep validation remains deferred.
- SARIF has no external schema-validator dependency yet.

## Next Milestone

M5: Public Evidence and Adoption Loop.
