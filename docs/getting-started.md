# Getting started

## Requirements

- Node.js 20 or newer
- The MCP server source checked out locally

## Scan a server

HintLint scans a local folder. For a server hosted on GitHub, clone it first:

```bash
git clone https://github.com/org/my-mcp-server.git
```

```bash
npx hintlint ./my-mcp-server
```

For a persistent global installation, use npm:

```bash
npm install --global hintlint
hintlint ./my-mcp-server
```

The HintLint CLI is distributed through npm; it is not currently available on PyPI.

The terminal report shows the tool, declared annotations, observed behavior, severity, and repair guidance.

## Use a saved tool manifest

If the server is not available as source, scan a saved `tools/list` response:

```bash
npx hintlint ./tools-list.json
```

Manifest-only results are metadata evidence. They cannot prove what the handler does or block CI as source-backed findings do.

## Choose an output format

```bash
# Machine-readable report
npx hintlint ./my-mcp-server --format json --output hintlint.json

# GitHub Security, SIEM, or DefectDojo
npx hintlint ./my-mcp-server --format sarif --output hintlint.sarif

# MCP gateway or registry metadata
npx hintlint ./my-mcp-server --format registry --output hintlint.registry.json
```

## Gate a build

```bash
npx hintlint ./my-mcp-server --ci --fail-on high
```

Only source-backed findings at or above the selected threshold fail the command. Read the [CLI Reference](cli-reference.md) for all options.
