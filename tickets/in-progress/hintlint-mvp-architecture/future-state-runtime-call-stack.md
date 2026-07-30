# Future-State Runtime / Data-Flow Model

## Use Case Matrix

| Use Case | Primary Path | Fallback/Error Path | Requirements |
| --- | --- | --- | --- |
| Local source scan | CLI -> discovery -> extractor -> Semgrep -> comparator -> terminal report | Unsupported pattern -> diagnostic + unknown verdict | AC-1 to AC-6 |
| CI gate | GitHub Action -> CLI JSON/SARIF -> fail policy -> PR annotation | Missing Semgrep -> setup failure; uncertain finding -> warning only | AC-7, AC-8 |
| Registry ingestion | CLI -> JSON evidence artifact -> registry consumes verified labels | No source evidence -> metadata-only unknown | AC-6, AC-10 |
| ML-assisted triage | Deterministic scan -> ambiguous queue -> ML likely/unknown label -> report | ML unavailable -> deterministic-only scan | AC-9 |
| Closed-source/remote server | `tools/list` metadata -> advertised-surface classification | No source -> no proof, no CI fail | AC-10 |

## Path Details

### Path A: Local TypeScript/Python Scan

1. User runs `hintlint ./server`.
2. Project discovery identifies package metadata, language, and possible MCP SDK usage.
3. Extractor finds tool registrations and declared annotations.
4. Handler mapper links each tool to a function or callback.
5. Semgrep runs MCP sink rules.
6. Evidence normalizer converts Semgrep output into sink records.
7. Handler-to-sink mapper attaches evidence to tool records.
8. Behavior inference derives verified hint values and confidence tiers.
9. Comparator emits mismatches and suggested annotations.
10. Reporter renders terminal and optional JSON/SARIF.

### Path B: GitHub Action

1. Action checks out repo.
2. Action installs or invokes pinned HintLint and Semgrep.
3. CLI scans changed project or configured directory.
4. SARIF uploads to GitHub code scanning.
5. PR comment summarizes high-confidence annotation drift.
6. Build fails only if policy threshold is met.

### Path C: Registry/Governance Platform Integration

1. Registry runs HintLint during source intake.
2. JSON artifact is stored with package/version/commit provenance.
3. Verified labels become registry metadata.
4. Gateway/policy platform can consume verified annotations, not raw self-declared hints.

### Path D: ML Advisory

1. Deterministic scan produces tool records and evidence facts.
2. Ambiguous or unsupported tools are queued.
3. Model predicts likely behavior labels with calibration.
4. Comparator marks those as `likely` or `needs_review`, never `verified`.
5. Human review decisions feed future training data.

## Boundary Cases

- Tool registration is dynamic or generated.
- One handler backs multiple tool names.
- Tool delegates behavior to imported service functions.
- Handler reaches both read and write paths conditionally.
- Tool writes only to cache or telemetry.
- Tool interacts with external service through SDK abstraction.
- Tool behavior depends on configuration or credentials.
- Source package differs from deployed artifact.
- `openWorldHint` depends on enterprise network boundaries.
