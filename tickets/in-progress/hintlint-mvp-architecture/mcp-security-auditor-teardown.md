# mcp-security-auditor Teardown

## Summary

- Package: `mcp-security-auditor`
- Version inspected: `1.0.2`
- Source: PyPI source distribution downloaded to `/private/tmp/hintlint-competitors/mcp-security-auditor`
- CLI run: Yes, against `fixtures/ts-basic` and `fixtures/py-basic`
- Environment note: local `pip` is broken due a Python 3.14 `pyexpat`/libexpat mismatch, so `pyyaml` could not be installed normally. A minimal local `yaml.safe_load` shim was used because the default fixture scan only needs config loading.

## What It Is

`mcp-security-auditor` is a broad MCP security scanner. It has analyzers for:

- static code patterns,
- permissions,
- read-only mode,
- network,
- dependencies,
- injection,
- config,
- secrets.

Its advertised overlap with HintLint is real:

- `readOnlyHint` checks,
- `destructiveHint` checks,
- SARIF/JSON/HTML/SIEM output,
- CI mode,
- Python/TypeScript/JavaScript support.

## Implementation Inspection

Evidence from source inspection:

- Tool extraction uses regex patterns, not AST or tree-sitter.
- Annotation extraction is shallow and misses common nested TypeScript annotation shapes.
- No Semgrep integration was found.
- No handler-to-sink reachability engine was found.
- Read-only/destructive checks use tool-name heuristics plus file-level dangerous pattern scans.
- Permission checks detect implicit capabilities by scanning source files for regex indicators.
- Python multiline decorators are not reliably parsed by the current tool extraction regex.

Important files inspected:

- `/private/tmp/hintlint-competitors/mcp-security-auditor/mcp_auditor/core/scanner.py`
- `/private/tmp/hintlint-competitors/mcp-security-auditor/mcp_auditor/analyzers/permissions.py`
- `/private/tmp/hintlint-competitors/mcp-security-auditor/mcp_auditor/analyzers/readonly.py`
- `/private/tmp/hintlint-competitors/mcp-security-auditor/mcp_auditor/analyzers/static.py`

## Fixture Run Results

### TypeScript Fixture

Command:

```bash
PYTHONPATH=/private/tmp/hintlint-competitors/pyshims:/private/tmp/hintlint-competitors/mcp-security-auditor \
  python3 -m mcp_auditor.cli scan fixtures/ts-basic \
  --include-analyzers permissions readonly --format json
```

Observed behavior:

- Classified the project as `javascript`, not `typescript`, because the fixture has no TypeScript dev dependency or `tsconfig.json`.
- Found 5 tools:
  - `list_customers`
  - `delete_customer`
  - `create_customer`
  - `send_invoice_email`
  - false positive `ts-basic` from `new McpServer({ name: "ts-basic" })`
- Did not parse declared annotations for the TypeScript tools.
- Reported all real TypeScript tools as missing annotations despite annotations being present.
- Flagged `delete_customer` as destructive based on name.
- Flagged `create_customer` as missing `readOnlyHint` despite explicit annotation in source.
- Did not produce handler-to-sink evidence for `db.customer.delete`, `db.customer.create`, or `sendgrid.send`.

### Python Fixture

Command:

```bash
PYTHONPATH=/private/tmp/hintlint-competitors/pyshims:/private/tmp/hintlint-competitors/mcp-security-auditor \
  python3 -m mcp_auditor.cli scan fixtures/py-basic \
  --include-analyzers permissions readonly --format json
```

Observed behavior:

- Detected language `python` and framework `fastmcp`.
- Extracted zero tools, likely because the fixture uses multiline `@mcp.tool(...)` decorators.
- Did detect file-level implicit permissions:
  - `system.shell` at `subprocess.run(...)`
  - `filesystem.write` at `output.write(...)`
- Did not attach those file-level findings to MCP tool names.
- Did not identify `command` as the MCP parameter reaching process execution.
- Did not identify `destination_path` as the MCP parameter controlling filesystem write location.

## Overlap Matrix

| Capability | mcp-security-auditor | HintLint M0 | HintLint Target |
| --- | --- | --- | --- |
| CLI scanner | Yes | Yes | Yes |
| JSON output | Yes | Yes | Yes |
| SARIF output | Yes | No | M4 |
| TypeScript tool extraction | Partial | Partial | AST/Semgrep-backed |
| Python multiline tool extraction | Weak in fixture | Works in fixture | AST-backed |
| Annotation parsing | Weak for nested TS fixture | Works in fixture | SDK-pattern coverage |
| `readOnlyHint` mismatch | Name heuristic | Source pattern evidence | Handler-to-sink evidence |
| `destructiveHint` mismatch | Name heuristic | Source pattern evidence | Handler-to-sink evidence |
| `openWorldHint` mismatch | Not clearly covered | Source pattern evidence | External sink/dataflow |
| Tool input to process execution | File-level only | Tool-specific fixture finding | Taint/dataflow |
| Tool input to filesystem write | File-level only | Tool-specific fixture finding | Taint/dataflow |
| Handler-to-sink trace | No | Shallow same-block evidence | Semgrep/dataflow |
| Suggested exact annotation patch | Generic | Specific | Specific |
| Abstain/no-proof behavior | Limited | Unsupported dynamic tool recorded | Evidence tiers |

## Differentiation Bar

HintLint must remain stronger on:

1. Correct extraction of declared annotations from supported SDK patterns.
2. No fake tools from server metadata.
3. Multiline decorator handling.
4. Tool-specific evidence, not only file-level dangerous-code findings.
5. MCP parameter names in unsafe-flow findings.
6. Explicit `unknown`/unsupported handling for dynamic registration.
7. Suggested MCP annotation patch shaped to the actual finding.

## Build Implications

- Keep fixture tests that `mcp-security-auditor` misses or misclassifies:
  - nested TypeScript annotations,
  - multiline Python decorators,
  - dynamic TypeScript tool name,
  - source-backed `sendgrid.send`,
  - parameter-specific `subprocess.run(command)`,
  - path-specific filesystem write.
- Add competitor regression snapshots after M1/M2 if we want a public comparison.
- Do not claim uniqueness around "MCP security scanner" or "annotation auditor"; claim precision and evidence quality.
