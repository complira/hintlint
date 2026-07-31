# M7 80/20 Coverage and Reachability Plan

## Purpose

M7 should make HintLint reliable on the dominant real-world MCP server patterns before it tries to become partner-ready. The goal is not universal language/framework support. The goal is that popular TypeScript/JavaScript MCP servers either produce useful source-backed results or explain exactly why they are unsupported. Python keeps the existing lightweight decorator support, but M7 does not add a new Python parser; Semgrep remains the cross-language source/sink evidence layer.

## Current Baseline

The first Docker-backed public scan produced:

- 20 repositories scanned
- 802 tools extracted
- 794 handlers resolved
- 38 tool-specific source evidence records
- 4,571 project-level evidence records
- 21 source-backed candidate findings
- 0 scan runner failures

This validates the problem surface, but it does not yet prove high recall. Several repositories still extract zero tools or only project-level evidence, and current sink matching is pattern-backed rather than deep dataflow reachability.

## 80/20 Principle

Prioritize the patterns likely to cover most popular source-available MCP servers:

- TypeScript using `@modelcontextprotocol/sdk`
- TypeScript factory/wrapper helpers around SDK registration
- TypeScript static arrays or registries of tool definitions
- local helper calls from tool handlers to service modules
- Semgrep-backed sink detection for supported source files, including existing Python decorator-extracted handlers

Long-tail support is explicitly deferred:

- Go, C#, Rust, Java, and custom protocol implementations
- remote-only servers without source
- dynamic plugin systems that build tools from runtime data
- execution of real tools that require API keys or cloud credentials
- public claims from unreviewed scan candidates

## Tickets

### HL-080 Baseline Coverage Taxonomy

Classify every zero-tool or low-evidence repository in the public sample.

Acceptance criteria:

- Each repository is classified as `supported`, `unsupported_language`, `unsupported_pattern`, `not_mcp_server`, `requires_build`, or `runtime_only`.
- The scan report lists the reason when extraction returns zero tools.
- At least 10 examples are saved as reduced fixtures or documented patterns.

### HL-081 TypeScript Static Registry Extraction

Extract tools defined in static arrays and registries.

Acceptance criteria:

- Supports `const tools = [...]`, `export const tools = [...]`, and imported static registries.
- Supports registration through `server.addTool(...)`, `server.addTools(...)`, and simple loops over static arrays.
- Preserves tool name, description, schema, annotations, and handler reference when statically resolvable.

### HL-082 TypeScript Wrapper Factory Extraction

Extract tools hidden behind common wrapper helpers.

Acceptance criteria:

- Supports local wrappers like `createTool(...)`, `defineTool(...)`, `makeTool(...)`, and `tool(...)` when object fields are static.
- Resolves handler aliases from object fields such as `handler`, `execute`, `run`, and `callback`.
- Emits `unsupported_pattern` with file/line when a wrapper is dynamic instead of silently losing the tool.

### HL-083 Semgrep-Backed Python Evidence Without Parser Expansion

Keep Python support conservative while still using Semgrep evidence when the existing decorator extractor resolves a handler.

Acceptance criteria:

- Existing `@mcp.tool` / `@server.tool` decorator extraction continues to work.
- No new Python AST/parser implementation is added in M7.
- Semgrep findings inside resolved Python handlers are normalized as `L3`.
- Semgrep findings outside resolved Python handlers remain `L2` project evidence.
- Unsupported Python patterns are classified rather than silently counted as proof gaps.

### HL-084 No-Secrets Runtime Introspection

Add optional safe introspection for runnable servers without executing any business tool.

Acceptance criteria:

- Starts local server in Docker or a controlled subprocess.
- Calls only MCP `initialize` and `tools/list`.
- Never calls listed tools.
- Reports missing environment variables or credentials as `requires_credentials`, not a scan failure.
- Merges runtime tool metadata with source extraction when names match.

### HL-085 Coverage Report Contract

Make coverage visible and hard to overclaim.

Acceptance criteria:

- Report includes tools from `tools/list`, tools extracted from source, handlers resolved, handler mapping coverage, evidence tiers, and unsupported patterns.
- Public report separates `candidate`, `reviewed`, and `confirmed` findings.
- CI can fail on extraction regressions for fixtures and benchmark repos.

### HL-086 TypeScript Local Call Graph Reachability

Trace one-hop and simple multi-hop local calls from handlers to sinks.

Acceptance criteria:

- Indexes local functions, exported functions, imported functions, and simple class methods.
- Produces handler-to-sink paths such as `tool handler -> service.deleteUser -> prisma.user.delete`.
- Caps traversal depth and records when traversal stops.
- Does not treat project-level sinks as source-backed tool evidence unless reachable.

### HL-087 Deferred Python Reachability Decision

Record the decision on whether Python reachability should be Semgrep-only, tree-sitter-based, or deferred until after TypeScript/JavaScript coverage proves distribution value.

Acceptance criteria:

- No Python parser is introduced in this milestone.
- Python findings keep explicit `L2`/`L3` evidence tiers.
- Any future Python parser proposal requires a separate design gate.

### HL-088 Evidence Tiers and CI Gating

Define exactly what can block CI.

Acceptance criteria:

- `L1`: metadata-only classification from tool name/schema/description.
- `L2`: project-level source evidence without handler reachability.
- `L3`: handler-reachable source evidence.
- `L4`: handler-reachable source evidence plus safe runtime introspection.
- CI fails only on configured severities at `L3` or `L4`.
- ML output remains advisory and cannot raise evidence above `L2`.

### HL-089 Public Validation Loop

Rerun the public scan after coverage and reachability improvements.

Acceptance criteria:

- Scan at least 50 source-available TypeScript/Python MCP repositories.
- At least 80% of known MCP server repos have nonzero extraction or explicit unsupported classification.
- At least 70% of extracted tools have handler mapping.
- Manually review the highest-confidence source-backed findings.
- Open 3-5 high-quality maintainer PRs or record why candidate fixes were not appropriate.

## Exit Criteria

M7 is complete when:

- top TypeScript/Python patterns are covered by fixtures and public examples,
- zero-tool results are explained instead of silent,
- source-backed findings carry evidence tier `L3` or `L4`,
- project-level evidence is clearly separated from handler-reachable proof,
- the public report avoids unreviewed prevalence claims,
- maintainers receive concrete PRs or reviewed findings with source evidence.

## Sequencing

1. Week 1: HL-080 and HL-085.
2. Week 2: HL-081 and HL-082.
3. Week 3: HL-083 and HL-084.
4. Week 4: HL-086.
5. Week 5: HL-087 decision record and HL-088.
6. Week 6: HL-089.

## Success Metrics

- Extraction coverage across the curated TypeScript/Python sample.
- Handler mapping coverage across extracted tools.
- False-zero rate for known MCP server repos.
- Precision of manually reviewed `L3`/`L4` findings.
- Number and quality of maintainer PRs or maintainer confirmations.

## No-Go Conditions

- Findings depend only on tool names while being labeled source-backed.
- CI blocks on metadata-only, project-only, or ML-only findings.
- Runtime introspection requires real vendor API keys.
- Public reports imply confirmed vulnerabilities before manual review.
- Long-tail framework work displaces the dominant TypeScript/Python patterns.
