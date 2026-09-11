# We Scanned 20 MCP Servers. Here's What We Found About Tool Annotations.

*July 31, 2026 — Complira*

MCP tool annotations — `readOnlyHint`, `destructiveHint`, `openWorldHint` — are how servers tell agent runtimes which tools need human approval. The MCP spec defaults are conservative: a tool with no annotations is assumed destructive and open-world. Clients that follow the spec will gate unannotated tools behind confirmation.

But two problems remain. First, most MCP servers ship without any annotations at all, forcing clients to fall back on defaults rather than informed decisions. Second — and this is the real risk — some tools declare annotations that are *wrong*. A tool that says `readOnlyHint: true` but actually deletes data bypasses confirmation even in spec-compliant clients.

We built [HintLint](https://github.com/complira/hintlint) to catch both cases. It reads MCP server source code, detects what each tool actually does, and reports where annotations are missing or inaccurate.

## What We Found

We scanned 20 curated public MCP server repositories — TypeScript, JavaScript, and Python — selected from GitHub by star count and MCP registry presence. HintLint extracted 1,160 tool definitions, resolved handlers for 1,021 of them (88%), and produced 28 source-backed candidate findings.

After automated source verification, **23 were confirmed issues** at **82% precision**.

The findings break into two categories:

### Missing Annotations on Destructive Tools (20 findings)

19 findings came from [awslabs/mcp](https://github.com/awslabs/mcp), the official AWS MCP server collection. Plus 1 from cursortouch/Windows-MCP. The pattern:

```python
@mcp.tool()  # No annotations declared
async def delete_access_key(user_name, access_key_id, confirmed):
    iam.delete_access_key(UserName=user_name, AccessKeyId=access_key_id)
```

The tool calls a destructive AWS IAM API but declares no annotations. Under the MCP spec, missing `destructiveHint` defaults to `true` — so a spec-compliant client *would* gate this correctly. The tools are safe by default.

**So why does this matter?**

1. **Explicit is better than implicit.** Developers reading the code see `@mcp.tool()` with no annotations and have no idea if the omission was intentional or accidental. Did the author know about annotations? Did they choose not to use them? Explicit `destructiveHint=True` is documentation that helps the next developer.

2. **Not all clients follow spec defaults.** The MCP spec says missing `destructiveHint` should default to `true`, but that's a "should" in the spec, not an enforcement mechanism. A client that treats missing annotations as "unknown" rather than "assume destructive" would auto-approve these tools.

3. **Annotation adoption drives the ecosystem.** When major servers like awslabs ship without annotations, it signals that annotations are optional. If AWS annotated their tools, it would set a standard for everyone building MCP servers.

The same pattern appeared across IAM, ElastiCache, HealthImaging, Timestream, and CloudFormation:

- `delete_access_key` — permanently removes IAM access key
- `delete_cache_cluster` — destroys ElastiCache cluster
- `delete_db_instance` — drops Timestream database instance
- `delete_image_set` — removes HealthImaging data
- `delete_resource` — destroys CloudFormation resource
- ...and 14 more

The developers even added their own confirmation guards and read-only mode checks — they knew the operations were destructive. They just didn't express that knowledge through MCP annotations.

### Incorrect Annotations (3 findings)

This is the category that's genuinely dangerous. A tool that declares `readOnlyHint: true` but performs mutations will bypass confirmation in *every* client, including spec-compliant ones.

**firecrawl-mcp-server**: 1 finding where tool input flows to an outbound `fetch()` call without URL allowlist validation — an SSRF risk where the tool's parameters control the destination of an external HTTP request.

The remaining 2 incorrect-annotation candidates turned out to be false positives (handler scope resolution error — HintLint attributed evidence to the wrong tool in the same file).

### The Risk Hierarchy

| Scenario | Spec-compliant client | Non-compliant client |
|----------|----------------------|---------------------|
| No annotations (awslabs pattern) | Safe — defaults assume destructive | Depends on client behavior |
| Wrong annotations (`readOnlyHint: true` on a destructive tool) | **Unsafe** — client trusts the lie | **Unsafe** |
| Correct annotations | Safe | Safe |

The bottom line: missing annotations are a hygiene problem. Wrong annotations are a safety problem. HintLint catches both.

## How HintLint Works

HintLint is a static analysis tool. It never runs the MCP server code — it only reads source files.

**Extract**: Parse MCP tool registrations from TypeScript, JavaScript, and Python source. Supports 15+ registration patterns including `server.tool()`, factory wrappers, static registries, and switch/case dispatch.

**Detect**: Analyze each handler for 10 categories of behavior — database mutation, filesystem writes, HTTP calls, process execution, cloud API calls, query execution, URL construction, connection strings, external sends, and validation asymmetry.

**Compare**: Check declared annotations against detected behavior. A tool that calls `delete_cache_cluster()` without `destructiveHint` is flagged. A tool that declares `readOnlyHint: true` but writes to the database is flagged.

**Report**: Output findings with source evidence, CWE IDs, and repair guidance in SARIF 2.1.0, JSON, or terminal format.

Only findings with handler-scoped source evidence (L3/L4) can fail CI. HintLint never blocks a build on a guess.

## False Positive Analysis

5 of 28 candidates were false positives (18%):

| Root Cause | Count | Status |
|------------|-------|--------|
| Handler scope resolution — evidence attributed to adjacent tool in same file | 3 | Extractor improvement needed |
| Python `ToolAnnotations()` constructor not parsed | 2 | Fixed in v0.1.1 |

We publish false positive data because precision matters more than finding count. A security tool that cries wolf loses trust.

## Try It

```bash
npx hintlint ./your-mcp-server
```

Zero dependencies. Node.js 20+. [GitHub Action](https://github.com/marketplace/actions/hintlint) available.

```yaml
# Add to your MCP server's CI
- uses: complira/hintlint@v0
  with:
    target: .
    fail-on: high
    upload-sarif: "true"
```

## What's Next

- **Responsible disclosure**: We're preparing maintainer notifications with suggested annotation patches for each finding.
- **Coverage expansion**: Go and C# extractor support is planned for servers beyond the TypeScript/Python ecosystem.
- **Runtime verification** (coming in HintLint Pro): For tools where static analysis can't follow the control flow, runtime `tools/list` comparison closes the gap.

## Methodology

Full methodology, repository list, and per-finding evidence available in the [Findings Report](https://github.com/complira/hintlint/blob/main/docs/findings-report-july-2026.md).

- **Sample**: 20 source-available MCP server repositories, curated from GitHub by star count
- **Scanner**: HintLint v0.1.1 with Semgrep Docker evidence engine
- **Verification**: Automated source verification confirming sink existence and annotation status
- **Claim level**: Curated pilot. Not a random sample. Does not support ecosystem-wide prevalence claims.

---

*HintLint is open source (Apache 2.0) and built by [Complira](https://complira.co). Published on [npm](https://www.npmjs.com/package/hintlint) and the [GitHub Marketplace](https://github.com/marketplace/actions/hintlint).*
