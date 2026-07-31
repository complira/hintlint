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
| Medium | `benchmark/manifest.json`, `benchmark/results/*` | The M5 benchmark is fixture-backed. It validates the evidence pipeline, but it is not public ecosystem evidence. | Add pinned external MCP repositories before publishing prevalence stats or opening maintainer PRs. |
| Medium | `src/evidence/static-detector.js` | Finding generation and evidence detection still live in the same module even though behavior inference has been split out. | Move annotation and unsafe-flow comparators into separate modules before external public scans expand reporting and benchmark artifacts. |
| Medium | `scripts/scan-benchmark.js` | The benchmark harness scans local checkouts only and does not clone/pin remote repositories itself. | Keep this default for safety, but add a documented fetch/pin workflow when public scans start. |
| Medium | `python/hintlint_ml/hintlint_ml/classify.py` | The Python sidecar is a keyword baseline scaffold, not a trained encoder or cross-encoder model. | Use it only to test bridge/package behavior until a labeled dataset and validation report exist. |
| Medium | `action.yml` | The ML path installs `hintlint-ml` from PyPI when enabled, but the package is not published from this workspace. | Publish `hintlint-ml` or switch the Action to an internal package path before enabling ML in external workflows. |
| Medium | `src/coverage.js` | M7 coverage taxonomy detects unsupported languages and MCP markers, but it does not yet prove real `tools/list` runtime availability or framework-specific dynamic registration. | Use it as a triage/status classifier; add no-secrets runtime introspection before claiming complete extraction coverage. |
| Medium | `src/evidence/tool-location.js` | `L3` currently means evidence falls inside the resolved handler range, not full interprocedural handler-to-sink reachability through helper modules. | Implement the TypeScript/JavaScript local call graph before using `L3` as deep reachability in public claims. |
| Medium | `scripts/scan-public-mcp.js` | Full 20-repository Docker/Semgrep rerun now validates runner stability and aggregate coverage, but the candidate findings remain unreviewed. | Manually review source evidence before maintainer PRs, public vulnerability claims, or prevalence stats. |
| Medium | `src/extractors/typescript.js` | Static registry support is still text-based and intentionally conservative; it requires tool-named arrays or registration through `addTools` / simple `server.tool(tool.name, ...)` loops. | Keep this boundary to avoid generic array false positives; use public-scan misses to decide whether an AST parser is warranted. |
| Medium | `src/evidence/typescript-reachability.js` | TS/JS reachability is a bounded local call graph over function declarations, const helpers, named imports, and namespace imports. It does not model object instances, dependency-injected services, class methods, aliasing, or argument/dataflow equivalence. | Treat promoted `L3` as handler-to-helper source reachability, not full semantic dataflow proof. Use public misses to prioritize object/class support. |
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

M5 follow-up review: pass with constraints. Benchmark schema, local source-available manifest, reproducible scan script, generated aggregate report, registry artifact schema/reporter, CLI `--format registry`, registry docs, and ML bridge docs are implemented and tested. The remaining constraints are external public scans, upstream maintainer PRs, and partner-specific artifacts.

M6 follow-up review: pass with constraints. JS feature export, advisory merge, ML schemas, Python sidecar scaffold, Action opt-in ML path, labeling rubric, and evaluation plan are implemented and tested. The remaining constraints are labeled data, real encoder/cross-encoder training, package-held-out validation, PyPI publishing, and live Action execution with ML enabled.

M7 coverage/tier slice review: pass with constraints. Coverage taxonomy, unsupported-language detection, MCP marker-based unsupported-pattern classification, explicit `L2`/`L3` evidence tiers, tier-based CI gating, registry/SARIF/terminal/public-scan coverage fields, and focused tests are implemented. The remaining constraints are TypeScript/JavaScript extractor breadth, no-secrets runtime introspection, and real local call graph reachability.

M7 TS/JS extractor breadth review: pass with constraints. Static registry extraction, `addTools` inline extraction, simple loop duplicate suppression, `createTool`/`makeTool`/plain `tool` wrappers, JS language tagging, const-string names, and `handler`/`execute`/`run`/`callback` handler fields are implemented and tested. The remaining constraint is that this is still a text parser, not an AST/call-graph engine.

M7 TS/JS local helper reachability review: pass with constraints. Same-file helper calls, named local imports, namespace local imports, bounded traversal, built-in helper sink promotion, and Semgrep helper evidence promotion are implemented and tested. The remaining constraint is that object/class/service-instance resolution and true argument dataflow are not implemented.

## Follow-Up

- Add live Semgrep subprocess execution and rule-pack validation.
- Split comparator modules before expanding output formats.
- Implement TypeScript/JavaScript registry/factory extraction breadth for HL-081/HL-082.
- Extend TypeScript/JavaScript local call graph reachability to object/class/service-instance patterns before public `L3` precision claims.
- Keep Python support Semgrep/decorator-only until a separate parser design gate is approved.
- Run the composite GitHub Action in an actual pull request with SARIF upload and PR comments enabled.
- Add pinned public MCP server checkouts to `benchmark/manifest.json` before publishing external stats.
- Open maintainer PRs only after manually reviewing each source-backed finding.
- Collect at least 500 manually reviewed labels before any ML benchmark claim.
- Keep ML output advisory-only unless a future explicit policy gate is added.
- Add JSON Schema validation for report artifacts.
