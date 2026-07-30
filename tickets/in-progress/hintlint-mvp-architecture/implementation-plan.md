# Implementation Plan

## Preconditions

- Initialize git repository before implementation work.
- Choose implementation stack.
- Decide Semgrep packaging mode.
- Create source fixtures for TypeScript and Python MCP servers.
- Keep ML disabled until scientific validation is upgraded from `Pass with constraints` to `Pass`.

## Epic Backlog

### Epic 0: Project Foundation

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-001 | Initialize repo, package manager, lint/test tooling, CI skeleton | Establish maintainable project foundation | `hintlint --version` runs in dev; tests run in CI |
| HL-002 | Define output schemas for tool records, evidence records, and findings | Stabilize integrations early | JSON schema validates sample reports |
| HL-003 | Add fixture MCP servers for TypeScript and Python | Enable reliable scanner tests | Fixtures contain read-only, additive, destructive, external, shell, and unknown tools |
| HL-004 | Run `mcp-security-auditor` teardown against the same fixtures | Validate differentiation against closest direct overlap | Source inspected, fixture comparison recorded, differentiation bar updated |
| HL-005 | Align against CSA `mcpserver-audit` methodology | Capture standards/checklist value without becoming promptware | Checks/prompts inventoried, AIVSS/CWE/reporting implications recorded, relevant checks added to fixture/rules roadmap |

### Epic 1: CLI and Project Discovery

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-010 | Implement CLI command shape | Developer adoption starts with simple CLI | `hintlint ./fixtures/ts-basic` prints scan summary |
| HL-011 | Implement project discovery | Route to correct extractors/rules | Detects TS/Python package and MCP SDK hints |
| HL-012 | Add config loader | Allow CI policy and rule tuning | `hintlint.yaml` controls fail threshold and output |

### Epic 2: MCP Tool Extraction

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-020 | TypeScript MCP SDK extractor | First language support | Extracts tool name, description, schema, annotations, handler location |
| HL-021 | Python MCP SDK extractor | Second language support | Extracts same fields from Python fixtures |
| HL-022 | Handler mapping confidence tiers | Avoid false proof claims | Dynamic/unresolved handlers become `unknown`, not verified |
| HL-023 | `tools/list` metadata import | Supports runtime or saved manifest mode | Reads tool metadata JSON and marks source evidence unavailable |

### Epic 3: Semgrep Rule Pack and Evidence Engine

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-030 | Create sink taxonomy | Consistent behavior inference | Categories include fs mutation, DB mutation, HTTP mutation, shell, email/payment, cloud destructive |
| HL-031 | TypeScript Semgrep rules | Source-backed findings for TS | Fixtures produce expected sink records |
| HL-032 | Python Semgrep rules | Source-backed findings for Python | Fixtures produce expected sink records |
| HL-033 | Normalize Semgrep JSON | Decouple engine from reporter | Evidence records include file, line, rule id, category, sink |
| HL-034 | Handler-to-sink attachment | Make findings tool-specific | Evidence attaches only when mapper confidence is sufficient |
| HL-035 | MCP tool parameter source model | Treat tool inputs as attacker-controlled data | Extracted schema parameters become named taint sources |
| HL-036 | Query/URL/path/process taint rules | Catch MCP-specific vulnerability flows | Fixtures detect SQL/KQL-style query, SSRF URL, connection string, path traversal, and process execution flows |
| HL-037 | Sanitizer and validator model | Reduce false positives and reward safe patterns | Parameter binding, strict regex, host allowlist, and path root containment are recognized |
| HL-038 | Validation asymmetry detector | Find sibling services missing known guards | Fixture with safe MySQL-like validator and unsafe Postgres-like sibling produces asymmetry finding |

### Epic 4: Behavior Inference and Annotation Comparator

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-040 | Implement behavior inference rules | Convert sink facts into verified labels | Expected labels generated for every fixture tool |
| HL-041 | Implement declared-vs-verified comparator | Core product value | Flags false read-only and missing destructive/open-world hints |
| HL-042 | Severity and confidence model | CI needs predictable behavior | Source-backed false read-only is high; unknown is warning/info |
| HL-043 | Suggested annotation patches | Developer repair loop | Findings include suggested MCP annotation block |
| HL-044 | MCP security comparator | Turn input-to-sink evidence into vulnerability findings | Reports unsafe flow, source parameter, sink, missing validator, and repair guidance |

### Epic 5: Reporting and CI

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-050 | Terminal reporter | Useful local dev experience | Human-readable summary and finding detail |
| HL-051 | JSON reporter | Integrations and tests | Snapshot-stable JSON report |
| HL-052 | SARIF reporter | GitHub code scanning integration | SARIF validates and maps locations correctly |
| HL-053 | CI fail policy | Prevent noisy adoption | `--fail-on high` fails only on source-backed high findings |
| HL-054 | GitHub Action | Distribution from day one | Action comments on PR and uploads SARIF |

### Epic 6: Distribution and Benchmark

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-060 | Publish standalone Semgrep rule pack | Lets security teams adopt without full CLI | Rules can be run with Semgrep directly |
| HL-061 | Build public benchmark schema | Makes ML/research credible | Dataset schema captures tool, annotation, evidence, human labels |
| HL-062 | Scan top source-available MCP servers | Launch evidence | Produce aggregate drift stats with reproducible scripts |
| HL-063 | Maintainer PR workflow | Credibility and distribution | 10 high-confidence upstream PRs opened with source evidence |
| HL-064 | Registry integration artifact | Partner path | JSON artifact documented for registry/gateway ingestion |

### Epic 7: ML Research Track

| Ticket | Change | Reason | Acceptance |
| --- | --- | --- | --- |
| HL-070 | Labeling rubric | Prevent ambiguous labels | Human label guide defines all behavior classes and examples |
| HL-071 | Active-learning review queue | Efficient labeling | Queue prioritizes rule/model disagreement and ambiguous names |
| HL-072 | Baseline classifiers | Establish value over heuristics | Keyword, rule-only, and simple ML baselines reported |
| HL-073 | Encoder multi-label classifier | Improve ambiguous behavior triage | Beats baseline on package-held-out validation without false-safe regression |
| HL-074 | Cross-encoder label entailment prototype | Test semantic verification claim | Reports entail/contradict/unknown for label definitions |
| HL-075 | Calibration and abstention policy | Avoid unsafe ML claims | ML outputs never produce `verified-safe`; thresholds documented |

## Suggested Build Order

Milestones are defined in `milestones.md`. The ticket execution order should follow those gates:

1. HL-001 to HL-003
2. HL-004 to HL-005
3. HL-010 to HL-012
4. HL-020, HL-021, HL-030
5. HL-031 to HL-038
6. HL-040 to HL-044
7. HL-050 to HL-054
8. HL-060 to HL-064
9. HL-070 to HL-075

## Verification Plan

- Unit tests for extraction, evidence normalization, behavior inference, comparator, and reporters.
- Fixture integration tests for TypeScript and Python.
- Snapshot tests for terminal, JSON, and SARIF output.
- CLI tests for exit codes and CI fail policy.
- GitHub Action dry-run workflow.
- Benchmark reproducibility script before public report.

## Rollback Plan

- Ship rule pack and CLI versioned independently.
- Make CI failure opt-in.
- Keep ML disabled by default.
- If handler mapping is noisy, downgrade uncertain findings to warnings and continue collecting labels.
