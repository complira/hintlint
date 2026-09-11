# Understanding findings

HintLint compares two things:

1. What the MCP tool declares through annotations.
2. What its source code actually reaches and performs.

## Common high-impact findings

| Finding | Meaning |
| --- | --- |
| `READONLY-001` | The tool says it is read-only, but the source performs a write. |
| `DESTRUCTIVE-001` | The tool calls a destructive operation without `destructiveHint=true`. |
| `OPEN-WORLD-001` | The tool says it is closed-world, but it makes external calls. |
| `FLOW-URL-001` | User input controls an outbound URL. |
| `FLOW-PROCESS-001` | User input reaches process execution. |
| `FLOW-QUERY-001` | User input reaches raw SQL without safe binding. |

## Evidence levels

Source-backed evidence is scoped to the tool handler and can participate in CI gating. Project-level or manifest-only evidence is useful for review, but is not treated as proof of handler behavior.

## What to do next

1. Open the reported file and line.
2. Confirm the sink and the tool handler are the same execution path.
3. Correct the annotation or the implementation.
4. Re-run HintLint and keep the result with the review record.

See the full [Finding Reference](finding-reference.md) for CWE mappings, examples, and repair guidance.
