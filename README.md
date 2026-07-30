# HintLint

Verify MCP tool hints against source evidence.

HintLint is starting as a local CLI for MCP server authors. The first implementation extracts MCP tools from TypeScript and Python source, records declared annotations, and emits a stable scan report. The evidence engine will expand toward Semgrep-backed handler-to-sink traces and MCP tool-input taint analysis.

## Quick Start

```bash
node src/cli.js fixtures/ts-basic
node src/cli.js fixtures/py-basic --format json
node src/cli.js fixtures/ts-basic --format sarif --output hintlint.sarif
node src/cli.js fixtures/ts-basic --format registry --output hintlint.registry.json
node src/cli.js fixtures/tools-list --format features --output features.jsonl
node src/cli.js fixtures/tools-list
node src/cli.js fixtures/py-taint
npm run benchmark
```

CI mode fails only on source-backed findings at or above the configured threshold:

```bash
node src/cli.js ./server --ci --fail-on high
```

## GitHub Action

```yaml
name: HintLint

on:
  pull_request:

jobs:
  hintlint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: hintlint/hintlint@v0
        with:
          target: .
          node-version: "20"
          fail-on: high
          upload-sarif: "true"
          pr-comment: "true"
          enable-ml: "false"
```

For local development in this repository, replace `hintlint/hintlint@v0` with `./`.

## Current Scope

- TypeScript MCP SDK-style `server.tool(...)` and `server.registerTool(...)` extraction.
- Python FastMCP-style `@mcp.tool(...)` extraction.
- Saved `tools/list` JSON import as metadata-only evidence.
- Flat `hintlint.yaml`/JSON config for local defaults.
- Normalized source evidence records for filesystem, database, HTTP, process, external-send, cloud, query, URL, and connection-string sinks.
- Semgrep-compatible rule pack in `rules/semgrep/hintlint-mcp.yml`.
- Optional Semgrep JSON import with `--semgrep-json <path>`.
- Annotation drift findings include declared hints, verified behavior, source evidence, confidence tier, and suggested annotation patches.
- Unsafe-flow findings include source parameter, dangerous sink, validator status, and repair guidance.
- Terminal, JSON, and SARIF reports.
- Registry artifact output for registries, gateways, and governance platforms.
- Composite GitHub Action that generates SARIF/text reports, can upload SARIF, can comment on pull requests, and applies the conservative CI threshold.
- Benchmark harness that writes raw reports, registry artifacts, aggregate stats, and an annotation drift report.
- ML feature export and advisory ML advice merge. Python ML remains optional and advisory-only.
- No-source and unsupported patterns are reported honestly instead of treated as proof.

Planned next:

- Real Semgrep subprocess execution.
- Deeper handler-to-sink reachability.
- Public source-available MCP server scan manifest and maintainer PR workflow.
- Real Python model training/evaluation after a manually labeled, package-held-out dataset exists.

## Local Skills

Project-local Codex skills copied from `../trainlens/.codex/skills` live in `.codex/skills/`. They are retained as implementation review aids, especially the `scientist` skill for keeping ML and benchmark claims conservative.

See also:

- `docs/registry-artifact.md`
- `docs/ml-bridge.md`
- `ml/README.md`
- `benchmark/README.md`
