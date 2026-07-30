# Requirements

- Status: Design-ready
- Goal: Plan the architecture and implementation tickets for HintLint, a developer-first MCP capability linting and annotation verification tool.
- Mode: Analysis-Only
- Scope: MVP architecture, phased backlog, ML validation plan, and distribution-oriented acceptance criteria.

## Product Positioning

HintLint starts narrow and developer-adoptable:

> Verify MCP tool hints against source evidence.

It should be specific enough to win adoption from MCP server authors, but broad enough to later cover annotations, schemas, permissions, provenance, and capability drift.

## In-Scope Use Cases

1. Local MCP server author runs `hintlint ./server` before publishing or opening a PR.
2. CI runs HintLint and fails only on high-confidence false-safe annotation claims.
3. A GitHub Action comments with exact source evidence and suggested annotation fixes.
4. Registry or governance platform consumes HintLint JSON/SARIF as an evidence artifact.
5. ML-assisted mode triages ambiguous tool behavior but abstains when source evidence is weak.

## Out of Scope

- Hosted registry.
- Runtime MCP gateway.
- Generic MCP trust score.
- Closed-source remote proof claims.
- Broad malware detection.
- Enforcement decisions without deterministic evidence.
- Production ML classifier in the first public MVP.

## Acceptance Criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| AC-1 | CLI scans a local TypeScript MCP server and lists tools, declared annotations, findings, and source evidence | Fixture TypeScript MCP server scan |
| AC-2 | CLI scans a local Python MCP server with the same core behavior | Fixture Python MCP server scan |
| AC-3 | False `readOnlyHint: true` is flagged when handler reaches write/delete/send/execute sinks | Unit + fixture tests |
| AC-4 | Missing or contradictory `destructiveHint` is flagged for delete/overwrite/revoke-style evidence | Unit + fixture tests |
| AC-5 | `openWorldHint: false` is flagged when handler reaches network, email, payment, or external API sinks | Unit + fixture tests |
| AC-6 | Findings include file, line, sink category, declared hint, verified behavior, confidence tier, and suggested patch | Snapshot tests on JSON output |
| AC-7 | JSON and SARIF output are stable enough for CI and GitHub code scanning | Schema validation + sample GitHub Action run |
| AC-8 | CI mode can fail only on `high` severity and `source-backed` evidence | CLI integration test |
| AC-9 | ML mode is off by default and never upgrades an uncertain tool into a verified-safe verdict | Scientific validation + unit tests |
| AC-10 | Closed-source/remote-only scans produce `unknown/no-source-evidence` rather than proof claims | Fixture scan |

## Assumptions

- Initial target users are MCP server authors, registry maintainers, AI platform teams, and security engineers.
- The first credible wedge is high-precision annotation drift, not complete behavioral proof.
- TypeScript and Python cover enough early MCP servers to validate demand.
- Semgrep provides the best first evidence engine for developer trust and rule distribution.
- ML should improve coverage and prioritization, not replace evidence.

## Open Questions

- Should the first implementation be TypeScript/Node for ecosystem fit, Python for static-analysis ergonomics, or Rust/Go for single-binary distribution?
- Should HintLint vendor Semgrep through Docker, call a local Semgrep binary, or ship rules and let users install Semgrep?
- Which official MCP SDK registration patterns should be supported first in each language?
- What is the minimum public benchmark size needed before announcing the Annotation Drift Report?
- Will registries prefer SARIF, custom JSON, CycloneDX-like TBOM, or all three?

## Risks

- Existing platforms can absorb the feature once validated.
- Static analysis may not resolve handler-to-sink reachability across files in OSS-only mode.
- False positives can damage maintainer trust if public PRs are noisy.
- Annotation semantics are contextual, especially `openWorldHint`.
- ML labels may be expensive and ambiguous without a strict rubric.

## Coverage Map

| Requirement/AC | Runtime Path | Test/Validation |
| --- | --- | --- |
| AC-1, AC-2 | Local scan path | Fixture MCP servers |
| AC-3, AC-4, AC-5 | Semgrep evidence path -> hint comparator | Unit + integration tests |
| AC-6, AC-7 | Report rendering path | JSON schema and SARIF validation |
| AC-8 | CI policy gate path | GitHub Action dry run |
| AC-9 | ML advisory path | Scientific validation and classifier gate tests |
| AC-10 | Introspection without source path | Remote/no-source fixture |
