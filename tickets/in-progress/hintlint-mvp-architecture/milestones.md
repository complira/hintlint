# Milestones

## Milestone Strategy

HintLint should ship in credibility-building slices:

1. prove the scanner works on local fixtures,
2. prove it catches real annotation drift with source evidence,
3. make it easy to adopt in CI,
4. publish enough public evidence to earn distribution,
5. only then introduce ML as an advisory layer.
6. harden coverage and handler-to-sink reachability before partner packaging.

The product should avoid a hosted dashboard or broad registry until the evidence engine has adoption.

## M0: Project Skeleton and Scanner Contract

- Target window: Week 1
- Goal: Establish the repo, CLI shape, schemas, fixtures, and test harness.
- Primary users: internal builders.
- Included tickets: HL-001, HL-002, HL-003, HL-004, HL-005, HL-010.

### Exit Criteria

- `hintlint --version` works.
- `hintlint ./fixtures/ts-basic` and `hintlint ./fixtures/py-basic` can run, even if findings are stubbed.
- Tool, evidence, finding, and report JSON schemas exist.
- TypeScript and Python fixture MCP servers contain at least:
  - read-only tool
  - additive write tool
  - destructive delete tool
  - external side-effect tool
  - shell/process tool
  - dynamic/unknown tool
- `mcp-security-auditor` teardown is complete enough to define the differentiation bar.
- CSA `mcpserver-audit` methodology is classified and useful checks are mapped into HintLint fixture/rules requirements.

### Non-Goals

- No real Semgrep integration yet.
- No GitHub Action yet.
- No ML.

## M1: Tool Extraction MVP

- Target window: Weeks 2-3
- Goal: Extract MCP tool definitions and declared annotations from source.
- Primary users: MCP server authors.
- Included tickets: HL-011, HL-012, HL-020, HL-021, HL-022, HL-023.

### Exit Criteria

- TypeScript extractor resolves tool name, description, input schema, declared annotations, and handler location for supported MCP SDK patterns.
- Python extractor resolves the same fields for supported MCP SDK patterns.
- Unsupported dynamic registration produces `unknown_handler`, not a false proof.
- `tools/list` JSON import works as metadata-only mode.
- Scan summary reports:
  - tools discovered
  - handlers resolved
  - annotations present/missing
  - unsupported patterns

### Non-Goals

- No source-backed sink proof yet.
- No CI failure.

## M2: Source Evidence Engine

- Target window: Weeks 4-5
- Goal: Produce normalized source evidence for behavior-relevant sinks and MCP tool input flows.
- Primary users: security engineers and maintainers.
- Included tickets: HL-030, HL-031, HL-032, HL-033, HL-034, HL-035, HL-036, HL-037, HL-038.

### Exit Criteria

- Semgrep MCP rule pack detects initial sink taxonomy:
  - filesystem mutation
  - database mutation
  - HTTP POST/PUT/PATCH/DELETE
  - subprocess/shell execution
  - email/payment/external send
  - cloud delete/update operations
- Semgrep JSON is normalized into HintLint evidence records.
- Evidence attaches to a specific tool only when handler mapping confidence is sufficient.
- MCP tool parameters are modeled as attacker-controlled sources.
- Initial taint rules cover query, URL/host, connection string, process, and filesystem sinks.
- Safe validators are recognized for strict allowlists, parameter binding, and path root containment.
- Validation asymmetry fixture produces an actionable finding.
- Ambiguous project-level evidence is reported separately from tool-specific proof.
- Fixture tests verify exact file, line, category, and sink.

### Non-Goals

- No claim of complete whole-program proof.
- No cross-language full call graph.
- No ML.

## M3: Annotation Drift Verifier

- Target window: Weeks 6-7
- Goal: Turn source evidence into actionable annotation mismatch and MCP-specific unsafe-flow findings.
- Primary users: MCP maintainers and AI platform teams.
- Included tickets: HL-040, HL-041, HL-042, HL-043, HL-044, HL-050, HL-051.

### Exit Criteria

- HintLint flags:
  - false `readOnlyHint: true`
  - destructive behavior with missing/false `destructiveHint`
  - external/open-world behavior with false `openWorldHint`
  - shell/process execution as high-risk capability evidence
- Findings include:
  - tool name
  - declared annotations
  - verified behavior
  - source evidence
  - confidence tier
  - severity
  - suggested annotation patch
- Unsafe-flow findings include:
  - source MCP parameter
  - dangerous sink
  - validator/sanitizer status
  - repair guidance
- Terminal and JSON reports are stable and snapshot-tested.
- High-confidence fixture findings are precise enough to become maintainer PRs.

### Non-Goals

- No public benchmark claim yet.
- No GitHub Action PR comments yet.

## M4: CI and Developer Distribution

- Target window: Weeks 8-9
- Goal: Make HintLint easy to adopt in pull requests.
- Primary users: MCP server authors, registry maintainers, platform teams.
- Included tickets: HL-052, HL-053, HL-054, HL-060.

### Exit Criteria

- SARIF reporter validates against GitHub code scanning expectations.
- `--ci --fail-on high` fails only on high-confidence source-backed findings.
- GitHub Action can:
  - install/run HintLint,
  - upload SARIF,
  - comment on PRs with top findings,
  - respect fail threshold config.
- Semgrep rule pack can be run independently without the full CLI.
- README quickstart exists for local and CI usage.

### Non-Goals

- No hosted service.
- No enterprise admin UI.
- No ML enforcement.

## M5: Public Evidence and Adoption Loop

- Target window: Weeks 10-12
- Goal: Use real-world evidence to prove the wedge and generate distribution.
- Primary users: MCP maintainers, registry/gateway vendors, security community.
- Included tickets: HL-061, HL-062, HL-063, HL-064.

### Exit Criteria

- Public benchmark schema exists.
- Reproducible scan script runs against a curated set of source-available MCP servers.
- Public Annotation Drift Report includes aggregate stats and methodology.
- 10-20 high-confidence upstream PRs are opened with exact source evidence and suggested fixes.
- Registry integration artifact format is documented.
- At least 3 partner conversations are supported by concrete scan artifacts.

### Non-Goals

- No shaming list as first launch artifact.
- No inflated claim that HintLint detects all malicious MCP tools.

## M6: ML Advisory Research Preview

- Target window: Weeks 13-16
- Goal: Validate whether ML improves ambiguous behavior triage without increasing false-safe risk.
- Primary users: HintLint maintainers and advanced security reviewers.
- Included tickets: HL-070, HL-071, HL-072, HL-073, HL-074, HL-075.

### Exit Criteria

- Labeling rubric covers all behavior labels and ambiguity examples.
- At least 500 manually reviewed tools exist before any benchmark claim.
- Dataset split is package-held-out.
- Baselines are reported:
  - keyword heuristic
  - rule-only classifier
  - simple bag-of-words/schema model
- Encoder classifier improves ambiguous-case triage without worse false-safe rate.
- Cross-encoder prototype reports `entail`, `contradict`, or `unknown` for label definitions.
- ML output is clearly marked `likely` or `needs_review`, never `verified`.

### Non-Goals

- No default-on ML.
- No ML-based CI failure.
- No closed-source proof claims.

## M7: 80/20 Coverage and Reachability

- Target window: Weeks 17-22
- Goal: Cover the dominant TypeScript/JavaScript MCP patterns, use Semgrep for cross-language sink evidence, and turn project-level evidence into handler-reachable proof where it matters.
- Primary users: MCP maintainers, registry reviewers, security engineers.
- Included tickets: HL-080, HL-081, HL-082, HL-083, HL-084, HL-085, HL-086, HL-087, HL-088, HL-089.

### Exit Criteria

- Public scan results explain zero-tool repositories as `unsupported_language`, `unsupported_pattern`, `not_mcp_server`, `requires_build`, `runtime_only`, or `requires_credentials`.
- TypeScript extractor covers static arrays, exported registries, simple loops, SDK calls, and common wrapper factories.
- Existing Python decorator extraction continues to work, but no new Python parser is added in M7.
- Semgrep findings inside resolved handlers are `L3`; Semgrep findings outside resolved handlers are `L2`.
- Optional runtime introspection calls only `initialize` and `tools/list`; it never executes business tools or requires production API keys.
- Reports include extraction coverage, handler mapping coverage, evidence tiers, and unsupported-pattern details.
- TypeScript/JavaScript local call graph passes produce handler-to-sink paths for common helper/service layers.
- Evidence tiers are enforced:
  - `L1`: metadata-only classification,
  - `L2`: project-level source evidence,
  - `L3`: handler-reachable source evidence,
  - `L4`: handler-reachable source evidence plus safe runtime introspection.
- CI fails only on configured `L3` or `L4` findings.
- A rerun over at least 50 source-available TypeScript/JavaScript/Python MCP repositories achieves:
  - at least 80% nonzero extraction or explicit unsupported classification for known MCP servers,
  - at least 70% handler mapping across extracted tools.
- Highest-confidence findings are manually reviewed before public claims or maintainer PRs.

### Non-Goals

- No Go/C#/Rust/Java extractor expansion.
- No new Python parser expansion.
- No execution of real MCP tools.
- No API-key-dependent validation.
- No public vulnerability claims from unreviewed candidates.
- No ML-based CI blocking.

## M8: Partner-Ready Evidence Engine

- Target window: After M7 validation
- Goal: Package HintLint as an embeddable verifier for registries, gateways, and governance platforms.
- Primary users: Stacklok/ToolHive-like platforms, Glama-like registries, agent security vendors, enterprise AI platform teams.

### Exit Criteria

- Stable JSON artifact versioning.
- Documented API/library interface in addition to CLI.
- Ruleset versioning and provenance metadata in every report.
- Optional CycloneDX-like Tool Behavior BOM export evaluated.
- Example ingestion guide for registry/gateway platforms.
- Clear commercial boundary:
  - OSS CLI/rules for adoption,
  - hosted/enterprise integrations only after evidence demand is proven.

## Release Labels

| Release | Milestone | Public Promise |
| --- | --- | --- |
| `v0.1.0` | M0-M1 | Extract MCP tool hints from TypeScript/Python source |
| `v0.2.0` | M2 | Produce source-backed behavior evidence |
| `v0.3.0` | M3 | Flag annotation drift with suggested fixes |
| `v0.4.0` | M4 | CI/SARIF/GitHub Action ready |
| `v0.5.0` | M5 | Public drift report and registry artifact |
| `v0.6.0-experimental` | M6 | ML advisory preview |
| `v0.7.0` | M7 | 80/20 extractor coverage and handler-to-sink evidence tiers |
| `v1.0.0` | M8 | Stable evidence engine for CI and integrations |

## Milestone Gate Principles

- Do not advance a milestone by adding broader features; advance only when exit criteria are met.
- Do not fail CI on metadata-only or ML-only findings.
- Do not call a finding source-backed unless a specific tool handler is linked to specific evidence.
- Do not ship public claims without reproducible fixtures or scans.
- Prefer fewer high-confidence findings over broad noisy coverage.
