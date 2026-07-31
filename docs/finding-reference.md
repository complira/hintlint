# Finding Reference

Each HintLint finding has an ID, severity, evidence category, and repair guidance.

## Annotation Drift Findings

These findings detect mismatches between declared tool annotations and observed source behavior.

### HINTLINT-READONLY-001

**Severity**: High
**Type**: `false_readonly`

Tool declares `readOnlyHint=true` but source evidence shows state mutation, external side effect, or process execution.

**Example**: A tool annotated as read-only calls `db.deleteOne()` or `fs.writeFile()`.

**Repair**: Set `readOnlyHint: false` in the tool's annotations.

### HINTLINT-DESTRUCTIVE-001

**Severity**: High
**Type**: `missing_or_false_destructive_hint`

Tool reaches destructive or process-execution evidence but does not declare `destructiveHint=true`.

**Example**: A tool calls `iam.delete_access_key()` or `elasticache.delete_cache_cluster()` without `destructiveHint: true`.

**Repair**: Add `destructiveHint: true` to the tool's annotations.

### HINTLINT-OPEN-WORLD-001

**Severity**: Medium
**Type**: `false_open_world`

Tool declares `openWorldHint=false` but source evidence reaches an external side effect, network boundary, or process execution.

**Example**: A tool annotated as closed-world calls `fetch()` to an external API or `sendgrid.send()`.

**Repair**: Set `openWorldHint: true` in the tool's annotations.

## Unsafe Flow Findings

These findings detect tool input flowing to dangerous sinks without recognized validation.

### HINTLINT-FLOW-PROCESS-001

**Severity**: Critical
**CWE**: CWE-78 (OS Command Injection)

Tool has command-like MCP parameters and reaches process execution. Enforce a server-side allowlist; tool descriptions or LLM confirmation are not security controls.

**Sinks**: `subprocess.run()`, `child_process.exec()`, `execSync()`, `spawn()`

**Repair**: Add a server-side command allowlist before the process execution call.

### HINTLINT-FLOW-FILESYSTEM-001

**Severity**: High
**CWE**: CWE-22 (Path Traversal)

Tool has path-like MCP parameters and reaches filesystem write/path operations. Validate containment under an allowed root before writing.

**Sinks**: `writeFile()`, `createWriteStream()`, `open(..., "w")`, `shutil.rmtree()`

**Repair**: Validate that the path is contained within an allowed base directory.

### HINTLINT-FLOW-QUERY-001

**Severity**: Critical
**CWE**: CWE-89 (SQL Injection)

Tool has query-like MCP parameters and reaches query execution without recognized binding or allowlist validation.

**Sinks**: `cursor.execute()`, `connection.query()`, `pool.query()`

**Repair**: Use parameterized queries or a strict query allowlist.

### HINTLINT-FLOW-URL-001

**Severity**: High
**CWE**: CWE-918 (SSRF)

Tool has host or URL-like MCP parameters and constructs an external URL without recognized allowlist validation.

**Sinks**: `fetch(url)`, `requests.get(url)`, `new URL(url)`

**Repair**: Validate the URL against a strict host or resource-name allowlist.

### HINTLINT-FLOW-CONNECTION-001

**Severity**: High
**CWE**: CWE-88 (Argument Injection)

Tool has connection-string-relevant MCP parameters and builds a structured connection string without recognized delimiter protection.

**Sinks**: Connection string interpolation with user-controlled host, database, or credential fields.

**Repair**: Use a connection string builder library or reject delimiter characters in input.

### HINTLINT-VALIDATION-ASYMMETRY-001

**Severity**: Medium

Sibling tools with the same query-shaped input have inconsistent validation. One tool validates (e.g., uses parameter binding) while another does not.

**Repair**: Apply the same validation pattern used by the sibling tool.

## Evidence Categories

Each finding is backed by evidence records in one of these categories:

| Category | Description |
|----------|-------------|
| `database_mutation` | CREATE, UPDATE, DELETE, DROP on ORM/database |
| `filesystem_mutation` | File write, mkdir, delete, rename |
| `http_mutation` | HTTP POST, PUT, PATCH, DELETE to external API |
| `external_send` | Email, payment, notification sends |
| `cloud_mutation` | Cloud provider delete, terminate, destroy operations |
| `process_execution` | Shell command, subprocess, exec |
| `query_execution` | Raw SQL, KQL, or query string execution |
| `url_construction` | URL built from user input |
| `connection_string` | Connection string interpolated from user input |

## Evidence Tiers

| Tier | Meaning | Can Fail CI |
|------|---------|-------------|
| L1 | Metadata only | No |
| L2 | Project-level (outside handler scope) | No |
| L3 | Handler-scoped, source-backed | Yes |
| L4 | Runtime-verified | Yes |

## Severity Levels

| Severity | When Used |
|----------|-----------|
| Critical | Tool input reaches process execution or query execution without validation |
| High | Annotation drift (false readonly, missing destructive) or tool input reaches filesystem/URL/connection sinks |
| Medium | False open-world or validation asymmetry |
