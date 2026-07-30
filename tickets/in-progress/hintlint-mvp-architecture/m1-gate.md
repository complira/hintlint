# M1 Gate

## Decision

M1 complete.

## Exit Criteria Check

| Exit Criterion | Status | Evidence |
| --- | --- | --- |
| TypeScript extractor resolves tool name, description, input schema, declared annotations, and handler location for supported MCP SDK patterns | Pass | `npm test`; `node src/cli.js fixtures/ts-basic --format json` |
| Python extractor resolves tool name, description, input schema, declared annotations, and handler location for supported MCP SDK patterns | Pass | `npm test`; `node src/cli.js fixtures/py-basic` |
| Unsupported dynamic registration produces `unknown_handler`, not a false proof | Pass | `fixtures/ts-basic/src/server.ts` dynamic registration reports `<dynamic:dynamicToolName>` with `handler.confidence = unknown_handler` and zero findings |
| `tools/list` JSON import works as metadata-only mode | Pass | `fixtures/tools-list/tools-list.json`; direct file scan reports `handler.confidence = metadata_only` and zero findings |
| Scan summary reports tools discovered | Pass | `summary.tools_scanned` in terminal and JSON reports |
| Scan summary reports handlers resolved | Pass | `summary.handlers_resolved` in terminal and JSON reports |
| Scan summary reports annotations present/missing | Pass | `summary.annotations_present` and per-tool annotations in reports |
| Scan summary reports unsupported patterns | Pass | `summary.unsupported_patterns` and `unsupported[]` records |

## Verification Commands

```bash
npm test
npm run scan:fixtures
node src/cli.js fixtures/tools-list/tools-list.json --format json
node src/cli.js fixtures/ts-basic --format json
```

## Claims Allowed

- HintLint can extract fixture-backed TypeScript and Python MCP tool metadata.
- HintLint distinguishes source-backed, unknown-handler, and metadata-only records.
- Saved MCP `tools/list` JSON can be imported without making source-backed claims.
- Flat local config works for developer defaults.

## Claims Not Allowed

- Full AST-level TypeScript/Python extraction.
- Complete support for all MCP SDK overloads.
- Semgrep/dataflow reachability.
- Production-grade vulnerability proof.

## Next Milestone

M2: Source Evidence Engine.

Priority:

1. Introduce Semgrep rule-pack layout.
2. Normalize Semgrep JSON into HintLint evidence records.
3. Attach sink evidence only to resolved tool handlers.
4. Start MCP parameter-as-source taint fixtures.
