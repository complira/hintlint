# Changelog

All notable changes to HintLint will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-31

### Added

- **Extractors**: TypeScript/JavaScript tool extraction supporting `server.tool()`, `server.registerTool()`, `defineTool()`, `createTool()`, `makeTool()`, static registries, `addTools()` inline, factory wrapper functions with positional args, `ListToolsRequestSchema` inline arrays, function-returned tool arrays, property access name resolution (`obj.name`), and switch/case dispatch handler correlation.
- **Extractors**: Python tool extraction supporting `@mcp.tool()`, `@server.tool()`, bare `@mcp.tool` (no parentheses), and `ToolAnnotations()` constructor kwargs.
- **Extractors**: Saved `tools/list` JSON import as metadata-only tools.
- **Evidence engine**: 10 built-in sink categories — database mutation, filesystem mutation, HTTP mutation, external send, cloud mutation, process execution, query execution, URL construction, connection string, and validation asymmetry.
- **Evidence engine**: Semgrep JSON import and normalization with `--semgrep-json`.
- **Evidence engine**: TypeScript/JavaScript local helper reachability via call-graph traversal (BFS, depth 4).
- **Evidence engine**: Evidence tiers L1-L4. Only L3/L4 (source-backed, handler-reachable) can fail CI.
- **Cross-validation pipeline**: Generic SARIF normalizer, Bandit normalizer, ESLint normalizer, CodeQL normalizer.
- **Cross-validation pipeline**: Semgrep taint-mode rules (`hintlint-mcp-taint.yml`) with MCP handler params as sources.
- **Cross-validation pipeline**: CodeQL query pack with 6 custom taint queries for MCP sink categories.
- **Cross-validation pipeline**: Automated finding review (`auto-review.js`) — verifies sinks and annotations against source.
- **Cross-validation pipeline**: Review scaffold generator and validated report generator.
- **Reporters**: JSON, terminal, SARIF 2.1.0, and registry artifact output formats.
- **CI integration**: Composite GitHub Action with SARIF upload, PR comments, and configurable severity threshold.
- **CI integration**: CI policy module — only source-backed L3/L4 findings at or above threshold fail the build.
- **Benchmark harness**: Reproducible fixture benchmark and public MCP server scan pilot (20 curated repos).
- **ML bridge**: Feature export (`--format features`) and advisory ML advice merge. ML predictions are advisory-only and cannot fail CI.
- **Schemas**: 11 JSON Schema contracts for reports, findings, evidence, tools, reviews, cross-validation, registry artifacts, ML features, ML advice, benchmark manifests, and metadata validation.
- **Rules**: Semgrep pattern-only rule pack (`hintlint-mcp.yml`) and taint-mode rule pack (`hintlint-mcp-taint.yml`).
- **Rules**: CodeQL query pack with process execution, filesystem write, database mutation, query injection, URL SSRF, and connection string taint queries.

### Validated Results

- 20-repo public MCP pilot: 1,160 tools extracted, 1,021 handlers resolved (88%), 26 source-backed findings, 23 confirmed true positives, 5 false positives, 82% precision.
- Zero npm dependencies. Zero scanner failures.

---

HintLint is maintained by [Complira](https://complira.co).
