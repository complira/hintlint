# Proposed Design

## Summary

HintLint is a local-first MCP capability linting tool. The first product surface verifies MCP tool annotations against source evidence and reports annotation drift in CI.

It should be built as a layered scanner:

1. Extract declared tool metadata.
2. Collect source-backed behavior evidence.
3. Compare behavior evidence to declared hints.
4. Report exact mismatches with patch suggestions.
5. Later, use ML to prioritize ambiguous cases and improve coverage.

## Architecture and Boundaries

```text
CLI / GitHub Action
  |
  v
Project Discovery
  - language/package detection
  - MCP SDK/framework detection
  - config loading
  |
  v
Tool Extractors
  - TypeScript extractor
  - Python extractor
  - tools/list introspection fallback
  |
  v
Evidence Engine
  - Semgrep MCP rule pack
  - sink taxonomy
  - MCP tool parameter source model
  - taint and sanitizer checks
  - handler-to-sink mapper
  - evidence normalizer
  |
  v
Behavior Inference
  - read/write/destructive/open-world/idempotent inference
  - confidence tiering
  - no-source/unknown handling
  |
  v
Annotation Comparator
  - declared vs verified hints
  - finding severity
  - suggested annotation patch
  |
  v
MCP Security Comparator
  - unsafe tool-input-to-sink flows
  - validation asymmetry
  - capability drift
  |
  v
Reporters
  - terminal
  - JSON
  - SARIF
  - GitHub PR comments

Optional later:

ML Advisory Layer
  - ambiguous behavior classifier
  - cross-encoder label entailment
  - active-learning queue
```

Core boundaries:

- HintLint verifies claims; it does not enforce runtime policy.
- Source-backed verdicts are distinct from metadata-only risk classifications.
- MCP tool input parameters are treated as attacker-controlled sources.
- ML advisory output must be distinguishable from deterministic evidence.
- Remote-only servers are classified as unknown unless independent source or attestation is available.

## Data Contracts

### Tool Record

```json
{
  "server": "example-mcp",
  "tool": "delete_customer",
  "description": "Delete a customer record",
  "input_schema": {},
  "declared_annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": false,
    "openWorldHint": false
  },
  "handler": {
    "file": "src/tools/customers.ts",
    "line": 32,
    "symbol": "deleteCustomerTool"
  }
}
```

### Evidence Record

```json
{
  "tool": "delete_customer",
  "category": "destructive_write",
  "sink": "prisma.customer.delete",
  "file": "src/db/customers.ts",
  "line": 88,
  "trace": [
    "src/tools/customers.ts:32",
    "src/services/customers.ts:51",
    "src/db/customers.ts:88"
  ],
  "source": "semgrep",
  "confidence": "source-backed"
}
```

### Input-To-Sink Evidence Record

```json
{
  "tool": "query_postgres",
  "source": {
    "parameter": "query",
    "schema_path": "$.properties.query",
    "file": "src/tools/db.ts",
    "line": 18
  },
  "sink": {
    "category": "sql_query_execution",
    "symbol": "client.query",
    "file": "src/db/postgres.ts",
    "line": 44
  },
  "sanitizer": {
    "status": "not_found",
    "expected": "parameterized query or read-only query validator"
  },
  "confidence": "source-backed"
}
```

### Finding Record

```json
{
  "id": "HINTLINT-READONLY-001",
  "severity": "high",
  "tool": "delete_customer",
  "type": "false_readonly",
  "declared": {
    "readOnlyHint": true
  },
  "verified": {
    "readOnlyHint": false,
    "destructiveHint": true
  },
  "evidence": [],
  "suggested_annotations": {
    "readOnlyHint": false,
    "destructiveHint": true
  }
}
```

## Dependency and Config Changes

Recommended implementation stack:

- Core CLI: TypeScript/Node if optimizing for MCP ecosystem fit and GitHub Action packaging.
- Static rules: Semgrep YAML rule pack invoked as external binary or Docker action.
- Parsing: start with Semgrep/search patterns plus lightweight AST parsing where needed.
- Output schemas: checked into repo and versioned.
- GitHub Action: composite action or Node action wrapping CLI.

Config file:

```yaml
version: 1
severity:
  fail_on: high
evidence:
  require_source_backed_for_fail: true
languages:
  typescript: true
  python: true
ml:
  enabled: false
```

## Error Handling and Fallback

- If no source is available, emit `unknown/no_source_evidence`.
- If Semgrep is missing, fail with clear install/Docker guidance.
- If MCP tool extraction fails, emit unsupported-framework diagnostics.
- If handler mapping is uncertain, report evidence as project-level risk but do not attach it to a specific tool as proof.
- If tool-parameter taint reaches a sink but sanitizer status is unclear, mark as `needs_review` instead of exploitable.
- If ML is enabled but unavailable, continue deterministic scan.

## Observability

CLI should report:

- tools scanned
- tools with handlers resolved
- tools with source-backed evidence
- annotation coverage
- findings by severity
- unsupported files/frameworks
- runtime duration

Machine output should include:

- `hintlint_version`
- `ruleset_version`
- `scan_started_at`
- `scan_duration_ms`
- `project_fingerprint`
- optional `commit_sha`

## Rollback

Every ticket should be independently shippable:

- Rule pack can ship separately from CLI.
- GitHub Action can pin a CLI version.
- ML remains disabled by default until validation passes.
- CI fail behavior is opt-in and severity-gated.

## Validation Impact

Validation must focus on false-safe prevention:

- high-confidence findings should be precise enough for maintainer PRs;
- uncertain cases should abstain;
- ML must never turn unknown into verified-safe without deterministic evidence.
