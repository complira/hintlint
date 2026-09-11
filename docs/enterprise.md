# MCP tool procurement

Organizations can make MCP security part of tool approval.

```text
MCP server code → HintLint scan → procurement risk review → Tool BOM / registry
```

Before connecting an MCP server to an agent runtime:

1. Obtain the source repository or a saved `tools/list` response.
2. Run HintLint and review source-backed findings.
3. Set an approval policy for high and critical findings.
4. Attach the JSON, SARIF, or registry artifact to the tool’s Tool BOM entry.
5. Re-scan when the server version or source commit changes.

This creates a durable record of what was reviewed and when. It also gives MCP gateways and internal catalogs a security signal they can use alongside ownership, version, license, and dependency metadata.

```bash
npx hintlint ./mcp-server --format registry --output hintlint.registry.json
```

The scan is static evidence, not a penetration test or exploit confirmation. Keep the sample, commit, scanner version, and review decision with the procurement record. See [Enterprise Usage](enterprise-usage.md) for catalog scanning and continuous monitoring patterns.
