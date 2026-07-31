# FAQ

## What is HintLint?

HintLint is a static analysis tool that checks whether MCP (Model Context Protocol) server tool annotations match what the source code actually does. It detects annotation drift — cases where a tool claims to be read-only but actually writes data, or performs destructive operations without declaring it.

## What are MCP tool annotations?

MCP tool annotations are metadata hints that servers attach to their tools:

- `readOnlyHint` — true if the tool only reads data, no side effects
- `destructiveHint` — true if the tool can destroy data irreversibly
- `idempotentHint` — true if calling the tool multiple times has the same effect as calling it once
- `openWorldHint` — true if the tool interacts with services beyond the server's direct control

Agent runtimes use these annotations to decide which tool calls need human approval before execution.

## Why does annotation drift matter?

If a tool says `readOnlyHint: true` but actually calls `iam.delete_access_key()`, the agent runtime treats it as safe to execute without asking the user. The annotation is the only signal the runtime has — there's no other verification layer. HintLint is that verification layer.

## How does HintLint work?

1. It extracts MCP tool definitions from TypeScript/JavaScript and Python source files
2. It analyzes each tool's handler code to detect what it actually does (database writes, filesystem operations, HTTP calls, process execution, etc.)
3. It compares the detected behavior against the declared annotations
4. It reports mismatches as findings with evidence, severity, CWE IDs, and repair guidance

## What languages does HintLint support?

- **TypeScript / JavaScript** — 88% handler resolution. Supports `server.tool()`, `registerTool()`, factory patterns, static registries, and switch/case dispatch correlation.
- **Python** — 100% handler resolution. Supports `@mcp.tool()`, `@tool`, bare decorators, and `ToolAnnotations()` constructor.

## Does HintLint have dependencies?

No. Zero npm dependencies. Pure Node.js 20+ built-in modules only. This minimizes supply chain attack surface.

## How do I use HintLint in CI?

```bash
npx hintlint ./my-server --ci --fail-on high
```

Exit code 1 if source-backed findings exist at or above the threshold. Supports GitHub Actions (native action), GitLab CI, Jenkins, Azure DevOps, and CircleCI. See [CI Integration](ci-integration.md).

## What output formats does HintLint support?

- **Terminal** — human-readable colored output
- **JSON** — full structured report
- **SARIF 2.1.0** — for GitHub Security tab, Defect Dojo, Snyk, SIEM platforms
- **Registry artifact** — compact trust metadata for MCP gateways and registries

## Can HintLint fail my CI build?

Only if you pass `--ci`. And only source-backed findings (evidence tier L3 or L4) can trigger failure. Metadata-only guesses never block your build.

## What is evidence tier L3?

HintLint assigns tiers to evidence:

- **L1** — metadata only (tool name and description). Cannot fail CI.
- **L2** — project-level source evidence (detected in the codebase but not traced to a specific tool handler). Cannot fail CI.
- **L3** — handler-scoped source evidence (detected inside or reachable from the tool's handler function). Can fail CI.
- **L4** — runtime-verified evidence. Can fail CI.

## How accurate is HintLint?

In a 20-repo public MCP server pilot: 82% precision (23 true positives out of 28 findings, 5 false positives with identified root causes). See [Findings Report](findings-report-july-2026.md).

## How is HintLint different from Cisco MCP Scanner?

Cisco's scanner asks "Is this tool exploitable?" (vulnerability detection). HintLint asks "Does this tool's annotation match what it actually does?" (trust metadata verification). They are complementary — Cisco finds injection bugs, HintLint finds annotation lies.

## How is HintLint different from VIPER-MCP?

VIPER-MCP detects taint-style vulnerabilities and generates proof-of-concept exploits. HintLint verifies annotation accuracy. VIPER-MCP proves a tool is exploitable; HintLint proves a tool's metadata is wrong. Different problems, different tools.

## Can HintLint scan vendor/third-party MCP servers?

Yes. Clone the repo and scan it:

```bash
git clone https://github.com/vendor/their-mcp-server.git
npx hintlint ./their-mcp-server
```

For ongoing monitoring of multiple servers, use the [catalog scanning workflow](enterprise-usage.md).

## Does HintLint execute the MCP server code?

No. HintLint is purely static analysis — it reads source files but never runs them. No API keys, no network access, no Docker required for basic scanning. Semgrep integration (optional) runs as a separate subprocess.

## What license is HintLint under?

Apache License 2.0. Free for commercial use. Includes patent grant.
