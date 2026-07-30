# Code Review

## Findings

| Severity | File | Finding | Recommendation |
| --- | --- | --- | --- |
| Medium | `src/extractors/typescript.js` | TypeScript extraction is regex/text based and will miss or misparse dynamic or heavily nested registrations. | Replace or augment with AST parsing after fixture contract stabilizes. |
| Medium | `src/extractors/typescript.js` | TypeScript overload handling is still conservative; unsupported dynamic names become `unknown_handler`, and non-fixture SDK variants may need more tests. | Add AST-backed extraction or broaden supported overload fixtures before public claims. |
| Medium | `src/evidence/static-detector.js` | Built-in static detector is shallow and pattern-based. It is useful for fixtures but not sufficient for public security claims. | Keep evidence labeled `builtin-static-m2`; add Semgrep/dataflow engine next. |
| Medium | `src/evidence/static-detector.js` | M2 evidence still uses built-in snippet/line matching for fixture execution; Semgrep JSON import is normalized, but Semgrep is not run as a subprocess yet. | Add real Semgrep execution and compare built-in vs Semgrep outputs before public scans. |
| Medium | `rules/semgrep/hintlint-mcp.yml` | Semgrep binary is not installed locally, so the rule pack was not live-validated with Semgrep. | Validate the rule pack in an environment with Semgrep before publishing it as independently runnable. |
| Medium | `action.yml` | The composite GitHub Action is static- and YAML-parse-tested locally, but not exercised in a real pull request, so upload/comment permissions are not yet runtime-verified. | Run the action in GitHub Actions with `upload-sarif` and `pr-comment` enabled before claiming production CI readiness. |
| Medium | `src/evidence/static-detector.js` | Finding generation and evidence detection still live in the same module even though behavior inference has been split out. | Move annotation and unsafe-flow comparators into separate modules before M5 public scan work expands reporting and benchmark artifacts. |
| Low | `src/evidence/static-detector.js` | Validator recognition is intentionally heuristic and local to handler snippets. | Keep sanitizer status as evidence metadata, not proof of complete safety. |
| Low | `src/reporters/sarif.js` | SARIF output is intentionally minimal and maps each finding to the first evidence location plus related locations. | Add schema validation or GitHub upload validation once CI credentials are available. |
| Low | `src/config.js` | YAML support intentionally handles only flat key/value config. | Document this as MVP config behavior and avoid accepting nested policy config until a parser or typed config model exists. |
| Low | `.codex/skills/*/SKILL.md` | Copied skills retain TrainLens/InferLens-specific wording. | Review and adapt them before using as official HintLint skills. |
| Low | `schemas/*.schema.json` | Schemas are present and parseable, but not yet validated with a JSON Schema engine in tests. | Add schema validation dependency or lightweight validator in M1/M2. |

## Decision

Pass with constraints.

No blocking issues for the first implementation slice. The current code is acceptable as a scaffold and fixture-backed contract, not as a production security scanner.

M0 follow-up review: still pass with constraints. The milestone now has evidence schema coverage, additive/dynamic fixtures, direct competitor teardown, and CSA methodology alignment.

M1 follow-up review: still pass with constraints. Extraction now records schema details, dynamic TypeScript registrations are no longer treated as source-backed proof, saved `tools/list` JSON imports are metadata-only, and config loading is covered by tests.

M2 follow-up review: pass with constraints. Normalized evidence records, project-level evidence, source-parameter flow metadata, sanitizer status, validation asymmetry, Semgrep JSON import, and a Semgrep-compatible rule pack are implemented and fixture-tested. The main constraint is that Semgrep itself was not installed locally, so live rule execution remains pending.

M3 follow-up review: pass with constraints. Findings now include declared annotations, verified behavior, confidence tier, structured unsafe-flow details, repair guidance, suggested annotation patches, and stable JSON/terminal snapshots. The remaining constraint is architecture cleanup before SARIF/GitHub Action output adds another reporter.

M4 follow-up review: pass with constraints. SARIF output, conservative CI threshold handling, Action metadata, PR-comment/upload paths, CI workflow, and quickstart docs are implemented and locally tested. The remaining constraints are live GitHub Action execution and live Semgrep execution.

## Follow-Up

- Add live Semgrep subprocess execution and rule-pack validation.
- Split comparator modules before expanding output formats.
- Run the composite GitHub Action in an actual pull request with SARIF upload and PR comments enabled.
- Add JSON Schema validation for report artifacts.
