# CLI Reference

## Installation

```bash
# Run directly (no install)
npx hintlint ./my-mcp-server

# Global install
npm install -g hintlint

# Project-local
npm install --save-dev hintlint
```

Requires Node.js >= 20. Zero npm dependencies.

## Usage

```
hintlint <target> [options]
```

`<target>` is the path to an MCP server source directory or a saved `tools/list` JSON file.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--format <fmt>` | `text` | Output format: `text`, `json`, `sarif`, `registry`, `features` |
| `--output <path>` | stdout | Write report to file |
| `--ci` | off | Exit with code 1 if source-backed findings exceed threshold |
| `--fail-on <sev>` | `high` | Minimum severity that fails CI: `critical`, `high`, `medium`, `low` |
| `--config <path>` | auto | Config file path (`.yaml` or `.json`) |
| `--semgrep-json <path>` | none | Import Semgrep JSON results for evidence fusion |
| `--ml-advice <path>` | none | Merge advisory ML predictions (JSONL) |
| `--version` | | Print version |
| `--help` | | Show help |

## Examples

```bash
# Basic scan with terminal output
hintlint ./my-server

# JSON report to file
hintlint ./my-server --format json --output report.json

# SARIF for GitHub Security / SIEM
hintlint ./my-server --format sarif --output hintlint.sarif

# Registry artifact for gateway integration
hintlint ./my-server --format registry --output trust.json

# CI mode — fail on high or critical
hintlint ./my-server --ci --fail-on high

# With Semgrep evidence
semgrep scan --json --config rules/semgrep/hintlint-mcp.yml ./my-server > semgrep.json
hintlint ./my-server --semgrep-json semgrep.json

# ML feature export for training
hintlint ./my-server --format features --output features.jsonl

# Scan a saved tools/list JSON (no source analysis)
hintlint tools-list.json
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Scan completed. No source-backed findings above threshold (or `--ci` not set). |
| 1 | Source-backed findings found at or above `--fail-on` severity. |

Only L3/L4 evidence (handler-scoped, source-backed) can trigger exit code 1. Metadata-only and project-level evidence never fail the build.

## Configuration File

HintLint looks for `hintlint.yaml`, `hintlint.yml`, or `hintlint.json` in the target directory.

```yaml
# hintlint.yaml
fail_on: high
format: json
semgrep_json: semgrep-results.json
```

CLI flags override config file values.
