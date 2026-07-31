# HintLint

[![CI](https://github.com/hintlint/hintlint/actions/workflows/ci.yml/badge.svg)](https://github.com/hintlint/hintlint/actions/workflows/ci.yml)
[![Security](https://github.com/hintlint/hintlint/actions/workflows/security.yml/badge.svg)](https://github.com/hintlint/hintlint/actions/workflows/security.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hintlint/hintlint/badge)](https://scorecard.dev/viewer/?uri=github.com/hintlint/hintlint)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

MCP servers declare tool annotations — `readOnlyHint`, `destructiveHint`, `openWorldHint` — that tell agent runtimes which tools need human approval. Nothing verifies these annotations are accurate. HintLint does.

It reads the source code, detects what each tool actually does, and reports where annotations don't match behavior. A tool that calls `iam.delete_access_key()` but omits `destructiveHint` means the agent skips confirmation on an irreversible action.

In a [20-repo pilot](docs/findings-report-july-2026.md), HintLint confirmed 23 annotation mismatches at 82% precision, including 19 AWS tools performing destructive cloud operations without `destructiveHint`.

## Install and Run

```bash
npx hintlint ./my-mcp-server
```

```bash
# CI mode — exit 1 on high-severity findings
npx hintlint ./my-mcp-server --ci --fail-on high

# SARIF for GitHub Security tab
npx hintlint ./my-mcp-server --format sarif --output hintlint.sarif
```

Zero dependencies. Node.js 20+.

## GitHub Action

```yaml
- uses: hintlint/hintlint@v0
  with:
    target: .
    fail-on: high
    upload-sarif: "true"
    pr-comment: "true"
```

Also works with [GitLab CI, Jenkins, Azure DevOps, CircleCI](docs/ci-integration.md).

## What It Finds

| ID | What's Wrong | Severity |
|----|-------------|----------|
| HINTLINT-READONLY-001 | Says `readOnlyHint=true`, source shows writes | High |
| HINTLINT-DESTRUCTIVE-001 | Calls destructive API, no `destructiveHint` | High |
| HINTLINT-OPEN-WORLD-001 | Says `openWorldHint=false`, makes external calls | Medium |
| HINTLINT-FLOW-PROCESS-001 | User input reaches `exec()` / `subprocess.run()` | Critical |
| HINTLINT-FLOW-QUERY-001 | User input reaches raw SQL without binding | Critical |
| HINTLINT-FLOW-URL-001 | User input controls outbound URL | High |
| HINTLINT-FLOW-FILESYSTEM-001 | User input reaches file write without path check | High |
| HINTLINT-FLOW-CONNECTION-001 | User input in connection string without sanitizer | High |

Full details: [Finding Reference](docs/finding-reference.md)

## How It Works

```
Source Code → Extract tools → Detect sinks → Compare annotations → Report drift
```

1. **Extracts** MCP tool definitions from TypeScript/JavaScript and Python source
2. **Detects** what each tool handler actually does (10 sink categories: database, filesystem, HTTP, process execution, cloud APIs, etc.)
3. **Compares** declared annotations against detected behavior
4. **Reports** mismatches with evidence, CWE IDs, and repair guidance

Only findings with source-backed evidence (L3/L4) can fail CI. Metadata-only findings never block your build.

## Language Support

| Language | Handler Resolution |
|----------|--------------------|
| TypeScript / JavaScript | 88% |
| Python | 100% |

## Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Terminal | `--format text` | Developer review |
| JSON | `--format json` | Programmatic consumption |
| SARIF 2.1.0 | `--format sarif` | GitHub Security, Defect Dojo, SIEM |
| Registry artifact | `--format registry` | MCP gateway trust metadata |

## Documentation

- [FAQ](docs/faq.md) — common questions, comparisons, how it works
- [CLI Reference](docs/cli-reference.md) — flags, config, exit codes
- [Finding Reference](docs/finding-reference.md) — every finding, CWE, repair guidance
- [CI Integration](docs/ci-integration.md) — GitHub, GitLab, Jenkins, Azure DevOps, CircleCI
- [Enterprise Usage](docs/enterprise-usage.md) — pre-registry scanning, catalog management, continuous monitoring
- [Registry Artifact](docs/registry-artifact.md) — gateway integration format
- [Findings Report](docs/findings-report-july-2026.md) — validated pilot results with methodology

## Development

```bash
git clone https://github.com/hintlint/hintlint.git
cd hintlint
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).

Security issues: [SECURITY.md](SECURITY.md)

---

Built by [Complira](https://complira.co)
