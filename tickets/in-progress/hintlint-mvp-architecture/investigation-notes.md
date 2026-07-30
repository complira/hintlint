# Investigation Notes

## Current Implementation

No implementation exists in this workspace yet. The directory contains no source files and is not currently a git repository.

## Entry Points

Planned entry points:

- CLI: `hintlint ./server`
- CLI JSON output: `hintlint ./server --format json`
- SARIF output: `hintlint ./server --format sarif`
- CI mode: `hintlint ./server --ci --fail-on high`
- GitHub Action: wraps the CLI and publishes PR annotations.
- Rule pack: MCP-specific Semgrep rules usable independently.

## Data Flow / Runtime Flow

Planned core data flow:

1. Discover project language and MCP SDK registration patterns.
2. Extract tool definitions, schemas, descriptions, handlers, and declared annotations.
3. Run Semgrep rules and custom lightweight source indexing.
4. Map sink evidence back to tool handlers.
5. Infer verified behavior labels.
6. Compare verified labels to declared MCP hints.
7. Emit terminal, JSON, and SARIF reports.

## Existing Tests

No tests exist yet. The MVP requires fixture-driven tests because correctness depends on language/framework patterns and report stability.

## Dependencies and Config

Candidate dependencies:

- Semgrep CLI/rules for static sink detection.
- Tree-sitter or language-native parsers for future handler extraction if Semgrep-only extraction is insufficient.
- Node or Python packaging depending on implementation language.
- GitHub Action wrapper for distribution.
- Optional ML dependencies after benchmark exists: `sentence-transformers`, `transformers`, `scikit-learn`, `datasets`.

## Evidence Log

| Finding | Evidence | Implication |
| --- | --- | --- |
| Workspace is empty | `rg --files` returned no project files | Planning can define greenfield architecture |
| Workspace is not a git repo | `git status` returned not a git repository | GitHub issue mirroring and branch workflow are pending |
| MCP annotations are hints, not trusted facts | MCP spec and official blog state annotations are untrusted from untrusted servers | HintLint should produce evidence and avoid unverifiable guarantees |
| Competitor overlap exists | Stacklok, mcp-security-auditor, Glama, Snyk, Microsoft AGT occupy adjacent scanner/governance surfaces | HintLint must focus on source-backed annotation drift and developer CI |

## Scope Triage

Scope: Medium/Large for the product direction, but MVP should be kept Small/Medium by limiting language/framework coverage and avoiding hosted services.
