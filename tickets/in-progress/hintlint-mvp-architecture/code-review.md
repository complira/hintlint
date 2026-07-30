# Code Review

## Findings

| Severity | File | Finding | Recommendation |
| --- | --- | --- | --- |
| Medium | `src/extractors/typescript.js` | TypeScript extraction is regex/text based and will miss or misparse dynamic or heavily nested registrations. | Replace or augment with AST parsing after fixture contract stabilizes. |
| Medium | `src/evidence/static-detector.js` | Built-in static detector is shallow and pattern-based. It is useful for fixtures but not sufficient for public security claims. | Keep findings labeled `builtin-static-mvp`; add Semgrep/dataflow engine next. |
| Low | `.codex/skills/*/SKILL.md` | Copied skills retain TrainLens/InferLens-specific wording. | Review and adapt them before using as official HintLint skills. |
| Low | `schemas/*.schema.json` | Schemas are present and parseable, but not yet validated with a JSON Schema engine in tests. | Add schema validation dependency or lightweight validator in M1/M2. |

## Decision

Pass with constraints.

No blocking issues for the first implementation slice. The current code is acceptable as a scaffold and fixture-backed contract, not as a production security scanner.

M0 follow-up review: still pass with constraints. The milestone now has evidence schema coverage, additive/dynamic fixtures, direct competitor teardown, and CSA methodology alignment.

## Follow-Up

- Add Semgrep-backed rules and evidence normalization.
- Add SARIF reporter.
- Add GitHub Action wrapper.
- Add competitor fixture comparison for `mcp-security-auditor`.
