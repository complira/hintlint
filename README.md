<p align="center">
  <strong>HintLint</strong><br>
  <em>Verify MCP tool annotations match actual behavior</em>
</p>

<p align="center">
  <a href="https://github.com/complira/hintlint/actions/workflows/ci.yml"><img src="https://github.com/complira/hintlint/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/complira/hintlint/actions/workflows/security.yml"><img src="https://github.com/complira/hintlint/actions/workflows/security.yml/badge.svg" alt="Security"></a>
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/hintlint"><img src="https://img.shields.io/npm/v/hintlint.svg" alt="npm"></a>
</p>

---

MCP servers declare tool annotations — `readOnlyHint`, `destructiveHint`, `openWorldHint` — that tell agent runtimes which tools need human approval. Nothing verifies these annotations are accurate. HintLint does.

It reads the source code, detects what each tool actually does, and reports where annotations don't match behavior. A tool that calls `iam.delete_access_key()` but omits `destructiveHint` means the agent skips confirmation on an irreversible action.

In a [20-repo pilot](https://complira.gitbook.io/complira-docs/findings-report-july-2026), HintLint confirmed **23 annotation mismatches at 82% precision**, including 19 AWS tools performing destructive cloud operations without `destructiveHint`.

## Install and Run

Read the complete documentation at [complira.gitbook.io/complira-docs](https://complira.gitbook.io/complira-docs).

HintLint scans a local MCP server folder. If the server is on GitHub, download it first:

```bash
git clone https://github.com/org/my-mcp-server.git
```

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
- uses: complira/hintlint@v0
  with:
    target: .
    fail-on: high
    upload-sarif: "true"
    pr-comment: "true"
```

Also works with [GitLab CI, Jenkins, Azure DevOps, CircleCI](https://complira.gitbook.io/complira-docs/ci-integration).

## What It Finds

| ID | What's Wrong | Severity |
|----|-------------|----------|
| `READONLY-001` | Says `readOnlyHint=true`, source shows writes | High |
| `DESTRUCTIVE-001` | Calls destructive API, no `destructiveHint` | High |
| `OPEN-WORLD-001` | Says `openWorldHint=false`, makes external calls | Medium |
| `FLOW-PROCESS-001` | User input reaches `exec()` / `subprocess.run()` | Critical |
| `FLOW-QUERY-001` | User input reaches raw SQL without binding | Critical |
| `FLOW-URL-001` | User input controls outbound URL | High |
| `FLOW-FILESYSTEM-001` | User input reaches file write without path check | High |
| `FLOW-CONNECTION-001` | User input in connection string without sanitizer | High |

Full details with CWE IDs and repair guidance: [Finding Reference](https://complira.gitbook.io/complira-docs/finding-reference)

## How It Works

```
Source Code
    |
    v
 Extract tools        TypeScript, JavaScript, Python
    |
    v
 Detect sinks         10 categories (DB, filesystem, HTTP, process, cloud, ...)
    |
    v
 Compare annotations  Declared vs verified behavior
    |
    v
 Report drift         Terminal, JSON, SARIF 2.1.0, Registry artifact
    |
    v
 CI policy            Fail only on source-backed findings (L3/L4)
```

Only findings with handler-scoped source evidence can fail your build. Metadata-only guesses never block CI.

## Language Support

| Language | Handler Resolution |
|----------|--------------------|
| TypeScript / JavaScript | 88% |
| Python | 100% |

## Output Formats

| Format | Use Case |
|--------|----------|
| Terminal | Developer review |
| JSON | Programmatic consumption |
| SARIF 2.1.0 | GitHub Security, Defect Dojo, SIEM |
| Registry artifact | MCP gateway trust metadata |

## Documentation

Read the complete documentation at [complira.gitbook.io/complira-docs](https://complira.gitbook.io/complira-docs).

| | |
|---|---|
| [FAQ](https://complira.gitbook.io/complira-docs/faq) | Common questions, comparisons |
| [CLI Reference](https://complira.gitbook.io/complira-docs/cli-reference) | Flags, config, exit codes |
| [Finding Reference](https://complira.gitbook.io/complira-docs/finding-reference) | Every finding, CWE, repair guidance |
| [CI Integration](https://complira.gitbook.io/complira-docs/ci-integration) | GitHub, GitLab, Jenkins, Azure DevOps, CircleCI |
| [Enterprise Usage](https://complira.gitbook.io/complira-docs/enterprise-usage) | Pre-registry scanning, catalog management, continuous monitoring |
| [Registry Artifact](https://complira.gitbook.io/complira-docs/registry-artifact) | Gateway integration format |
| [Findings Report](https://complira.gitbook.io/complira-docs/findings-report-july-2026) | Validated pilot results with methodology |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Zero-dependency policy is intentional.

## License

Apache 2.0 — [LICENSE](LICENSE) | Security issues — [SECURITY.md](SECURITY.md)

---

<p align="center">Built by <a href="https://complira.co">Complira</a></p>
