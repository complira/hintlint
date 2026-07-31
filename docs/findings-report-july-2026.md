# HintLint Public MCP Server Pilot: Findings Report

**Date**: July 31, 2026
**Version**: HintLint 0.1.0
**Maintained by**: [Complira](https://complira.co)

## Executive Summary

HintLint scanned 20 curated public MCP server repositories and found 23 confirmed annotation mismatches with 82% precision. The most common issue: tools that perform destructive cloud operations (deleting IAM keys, cache clusters, database instances) without declaring `destructiveHint=true`. MCP clients relying on these annotations to gate destructive actions would skip human confirmation.

## Methodology

- **Sample**: 20 source-available MCP server repositories selected from GitHub on 2026-07-30 by star count and MCP registry presence. TypeScript, JavaScript, and Python servers only (Go, C#, Rust, Java excluded — no extractor support yet).
- **Claim level**: Curated pilot. This is not a random sample and does not support ecosystem-wide prevalence claims.
- **Scanner**: HintLint 0.1.0 with Semgrep Docker evidence engine.
- **Verification**: Automated source verification (`auto-review.js`) confirmed each finding by reading the actual source file, verifying the reported sink exists at the evidence line, and checking whether annotations are declared.
- **Cross-validation**: Bandit (Python security scanner) run via Docker on all 20 repos as independent corroboration.

## Scan Statistics

| Metric | Value |
|--------|-------|
| Repositories scanned | 20 |
| Tools extracted | 1,160 |
| Handlers resolved | 1,021 (88%) |
| Source evidence records (L3) | 43 |
| Project evidence records (L2) | 4,568 |
| Source-backed findings | 26 |
| **Confirmed true positives** | **23** |
| False positives | 5 |
| **Precision** | **82%** |
| Scanner failures | 0 |

## Confirmed Findings

### Missing `destructiveHint` on Destructive Cloud Operations (20 findings)

**Affected repositories**: 2 servers
**Severity**: High

Tools that call destructive cloud APIs (AWS IAM `delete_access_key`, ElastiCache `delete_cache_cluster`, HealthImaging `delete_image_set`, Timestream `delete_db_instance`, etc.) without declaring `destructiveHint=true` in their MCP annotations.

**Impact**: An MCP client using annotation-based policy enforcement would treat these tools as non-destructive and skip human approval before executing irreversible delete operations.

**Example**:
```python
@mcp.tool()  # No annotations declared
async def delete_access_key(user_name: str, access_key_id: str, confirmed: bool):
    # ...
    iam.delete_access_key(UserName=user_name, AccessKeyId=access_key_id)
```

The tool performs a destructive AWS IAM operation but declares no MCP annotations. HintLint detected the `delete_access_key()` call as `cloud_mutation` evidence and flagged the missing `destructiveHint`.

**Suggested fix**: Add `annotations={"destructiveHint": True, "readOnlyHint": False}` to the `@mcp.tool()` decorator.

### Unsafe URL Construction From Tool Input (1 finding)

**Affected repositories**: 1 server
**Severity**: High

A tool constructs an outbound URL using user-supplied input without a recognized allowlist or validation. Tool input flows to a `fetch()` call that reaches an external API.

**Impact**: If the tool input is influenced by an LLM prompt injection, the outbound request could be directed to an attacker-controlled endpoint (SSRF).

### False Readonl Hint on Mutating Tool (2 findings — both false positive)

Two findings flagged tools declaring `readOnlyHint=true` while performing HTTP POST requests. Manual review determined these were false positives caused by handler scope resolution errors — the evidence was attributed to the wrong tool in the same source file.

## False Positive Analysis

| Root Cause | Count | Status |
|------------|-------|--------|
| Handler scope resolution — evidence attributed to adjacent tool | 2 | Extractor bug identified |
| Python `ToolAnnotations()` constructor not parsed by extractor | 2 | Fixed in 0.1.0 |
| Generic sink label doesn't match actual source text | 1 | Evidence labeling improvement planned |

All 5 false positives have identified root causes. 3 are fixed in the current version; 2 require handler scope resolution improvements.

## Coverage Gaps

| Gap | Tools Affected | Resolution |
|-----|---------------|------------|
| Runtime manifest loader (tools loaded dynamically) | 109 | Requires runtime `tools/list` introspection |
| Imported tool arrays from external modules | 12 | Cross-file import resolution planned |
| Remaining edge cases | 18 | Minor extractor pattern additions |

## Language Coverage

| Language | Repositories | Tools Extracted | Handler Rate |
|----------|-------------|----------------|--------------|
| Python | 7 | 836 | 99% |
| TypeScript/JavaScript | 13 | 324 | 71% |
| **Total** | **20** | **1,160** | **88%** |

## Repository List

All repositories were public and source-available at scan time. Exact commit hashes are recorded in scan metadata.

| Repository | Language | Tools | Handlers | Findings |
|------------|----------|-------|----------|----------|
| awslabs/mcp | Python | 443 | 443 | 19 |
| 0x4m4/hexstrike-ai | Python | 151 | 151 | 0 |
| getsentry/XcodeBuildMCP | TypeScript | 116 | 7 | 0 |
| sooperset/mcp-atlassian | Python | 104 | 104 | 0 |
| ChromeDevTools/chrome-devtools-mcp | TypeScript | 59 | 56 | 0 |
| executeautomation/mcp-playwright | TypeScript | 32 | 32 | 0 |
| mobile-next/mobile-mcp | TypeScript | 27 | 26 | 0 |
| wonderwhy-er/DesktopCommanderMCP | TypeScript | 25 | 22 | 0 |
| czlonkowski/n8n-mcp | TypeScript | 21 | 9 | 0 |
| firecrawl/firecrawl-mcp-server | TypeScript | 21 | 19 | 4 |
| CursorTouch/Windows-MCP | Python | 20 | 20 | 2 |
| mrexodia/ida-pro-mcp | Python | 118 | 118 | 0 |
| AgentDeskAI/browser-tools-mcp | JavaScript | 12 | 12 | 0 |
| upstash/context7 | TypeScript | 7 | 2 | 0 |
| GLips/Figma-Context-MCP | TypeScript | 4 | 0 | 0 |
| microsoft/playwright-mcp | TypeScript | 0 | 0 | 0 |
| oraios/serena | Multi | 0 | 0 | 0 |
| BrowserMCP/mcp | TypeScript | 0 | 0 | 0 |
| epiral/bb-browser | TypeScript | 0 | 0 | 0 |
| jacob-bd/gemini-notebook-mcp-cli | Python | 0 | 0 | 0 |

## Responsible Disclosure

No upstream maintainer issues or pull requests have been opened from this scan. Findings are shared here as aggregate data for the MCP ecosystem. Individual maintainer notifications with evidence packets and suggested patches will follow responsible disclosure timelines.

## Reproducibility

```bash
git clone https://github.com/hintlint/hintlint.git
cd hintlint
npm run benchmark:public -- --skip-fetch --semgrep docker
npm run review:auto
npm run review:report
```

Raw scan data, review templates, and validated reports are in `benchmark/results-public/`.

## Contact

For questions about this report: venkata@complira.co

## Disclaimer

This report reflects findings at a specific point in time. Repositories may have been updated since the scan date. Findings are based on static source analysis and automated review — they are not confirmed exploits. The curated sample does not represent the full MCP ecosystem and should not be used for prevalence claims beyond the 20 repositories listed.
