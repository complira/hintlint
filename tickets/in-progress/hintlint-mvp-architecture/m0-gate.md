# M0 Gate

## Decision

M0 complete.

## Exit Criteria Check

| Exit Criterion | Status | Evidence |
| --- | --- | --- |
| `hintlint --version` works | Pass | `env npm_config_cache=/private/tmp/hintlint-npm-cache npm exec -- hintlint --version` returned `0.1.0` |
| `hintlint ./fixtures/ts-basic` can run | Pass | `npm run scan:fixtures` |
| `hintlint ./fixtures/py-basic` can run | Pass | `npm run scan:fixtures` |
| Tool, evidence, finding, and report JSON schemas exist | Pass | `schemas/tool.schema.json`, `schemas/evidence.schema.json`, `schemas/finding.schema.json`, `schemas/report.schema.json` |
| TypeScript fixture includes read-only tool | Pass | `list_customers` |
| TypeScript/Python fixtures include additive write tool | Pass | `create_customer` |
| TypeScript/Python fixtures include destructive delete tool | Pass | `delete_customer` |
| TypeScript/Python fixtures include external side-effect tool | Pass | `send_invoice_email` |
| TypeScript/Python fixtures include shell/process tool | Pass | `run_az_command` |
| TypeScript/Python fixtures include dynamic/unknown tool | Pass | dynamic TypeScript `server.tool(dynamicToolName, ...)` reported unsupported |
| `mcp-security-auditor` teardown complete enough to define differentiation bar | Pass | `mcp-security-auditor-teardown.md` |
| CSA `mcpserver-audit` methodology classified and mapped | Pass | `csa-mcpserver-audit-alignment.md` |

## Verification Commands

```bash
npm test
npm run scan:fixtures
env npm_config_cache=/private/tmp/hintlint-npm-cache npm exec -- hintlint --version
node src/cli.js fixtures/py-basic --ci --fail-on high
```

## Scientist Review

Verdict: Pass with constraints.

Claims allowed:

- M0 scanner contract exists.
- Supported fixture patterns extract declared MCP metadata.
- Fixture-backed source-pattern findings work.
- The closest competitor teardown found precision gaps in the fixture comparison.

Claims not allowed:

- production-grade MCP security scanner,
- Semgrep/dataflow proof,
- complete vulnerability coverage,
- public benchmark superiority.

## Next Milestone

M1: Tool Extraction MVP.

Priority:

1. Add `hintlint.yaml` config loader.
2. Improve TypeScript/Python extraction around SDK variants.
3. Add `tools/list` manifest import.
4. Keep unsupported/dynamic patterns explicit.
