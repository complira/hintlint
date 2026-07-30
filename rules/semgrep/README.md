# HintLint Semgrep Rules

This rule pack is the M2 contract for source evidence. The CLI can normalize Semgrep JSON through `--semgrep-json`, while the local built-in matcher keeps fixture tests dependency-light.

Current taxonomy:

- `filesystem_mutation`
- `database_mutation`
- `http_mutation`
- `process_execution`
- `external_send`
- `cloud_mutation`
- `query_execution`
- `url_construction`
- `connection_string`

Rules are intentionally conservative and should be expanded with fixture-backed cases before public benchmark claims.
