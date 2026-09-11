# HintLint

Verify that MCP tool annotations match what the server code actually does.

MCP annotations such as `readOnlyHint`, `destructiveHint`, and `openWorldHint` help agent runtimes decide when to ask for approval. HintLint scans the source behind those tools and reports when the declared behavior drifts from reality.

## Why HintLint?

An MCP tool can look read-only while writing to a database, or omit `destructiveHint` while deleting cloud resources. HintLint surfaces that mismatch before the server reaches an agent, a registry, or production.

## Start in seconds

```bash
npx hintlint ./my-mcp-server
```

To install the CLI globally instead:

```bash
npm install --global hintlint
hintlint ./my-mcp-server
```

HintLint is currently distributed through npm. A PyPI package for the CLI is not available.

For CI:

```bash
npx hintlint ./my-mcp-server --ci --fail-on high
```

## Supported inputs

- TypeScript and JavaScript MCP server source
- Python MCP server source
- Saved `tools/list` JSON responses

HintLint does not need a running server or production credentials. To verify behavior, it needs the server source code or a saved tool manifest.

## Documentation

Start with [How to use HintLint](how-to-use.md) for the shortest path from installation to your first scan. Then use the navigation to add HintLint to CI/CD, understand findings, or use scan results in organizational tool procurement and Tool BOM processes.

For every command and flag, see the [CLI Reference](cli-reference.md). For the full validated pilot methodology, see the [Findings Report](findings-report-july-2026.md).

For a shareable overview, download the [HintLint report (PDF)](Report_HintLint.pdf) or the [HintLint one-pager (PDF)](one_pager_hintlint.pdf).

## For AI agents

GitBook provides agent-friendly versions of this documentation:

- [Documentation index](https://complira.gitbook.io/complira-docs/llms.txt)
- [Full documentation context](https://complira.gitbook.io/complira-docs/llms-full.txt)
- [GitBook MCP endpoint](https://complira.gitbook.io/complira-docs/~gitbook/mcp)

Individual pages are also available by adding `.md` to their GitBook URL.

The static HintLint website exposes read-only WebMCP tools for installation and documentation discovery in browsers that support the proposed WebMCP API.
