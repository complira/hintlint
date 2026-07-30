# HintLint

Verify MCP tool hints against source evidence.

HintLint is starting as a local CLI for MCP server authors. The first implementation extracts MCP tools from TypeScript and Python source, records declared annotations, and emits a stable scan report. The evidence engine will expand toward Semgrep-backed handler-to-sink traces and MCP tool-input taint analysis.

## Quick Start

```bash
node src/cli.js fixtures/ts-basic
node src/cli.js fixtures/py-basic --format json
node src/cli.js fixtures/tools-list
node src/cli.js fixtures/py-taint
```

## Current Scope

- TypeScript MCP SDK-style `server.tool(...)` and `server.registerTool(...)` extraction.
- Python FastMCP-style `@mcp.tool(...)` extraction.
- Saved `tools/list` JSON import as metadata-only evidence.
- Flat `hintlint.yaml`/JSON config for local defaults.
- Normalized source evidence records for filesystem, database, HTTP, process, external-send, cloud, query, URL, and connection-string sinks.
- Semgrep-compatible rule pack in `rules/semgrep/hintlint-mcp.yml`.
- Optional Semgrep JSON import with `--semgrep-json <path>`.
- Terminal and JSON reports.
- No-source and unsupported patterns are reported honestly instead of treated as proof.

Planned next:

- Real Semgrep subprocess execution.
- Deeper handler-to-sink reachability.
- SARIF and GitHub Action integration.

## Local Skills

Project-local Codex skills copied from `../trainlens/.codex/skills` live in `.codex/skills/`. They are retained as implementation review aids, especially the `scientist` skill for keeping ML and benchmark claims conservative.
