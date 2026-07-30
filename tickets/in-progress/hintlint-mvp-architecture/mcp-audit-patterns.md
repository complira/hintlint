# MCP Audit Patterns

## Why This Changes The Plan

The Microsoft MCP audit pattern shifts HintLint from only:

> declared annotation vs implementation behavior

to a broader evidence engine:

> MCP tool input/schema/annotation claims vs source-backed capability and vulnerability evidence.

Annotation drift is still the first developer wedge, but the highest-value enterprise findings often come from tainted MCP tool parameters reaching dangerous sinks without validation.

## Pattern Classes To Support

### 1. Tool Parameter To Query Sink

Risk:

- SQL injection
- KQL injection
- GraphQL/LDAP/query-language injection
- unsafe database read/write operations

Evidence model:

- source: MCP tool input parameter
- sink: query constructor or query execution API
- sanitizer: parameter binding, allowlisted identifier validation, safe query builder

Finding shape:

```text
Tool parameter `table` reaches KQL command string interpolation.
No allowlist or identifier escaping detected.
```

### 2. Tool Parameter To URL/Host Sink

Risk:

- SSRF
- credential/token exfiltration
- confused-deputy cloud API calls

Evidence model:

- source: MCP tool input parameter
- sink: HTTP request URL, SDK endpoint, cloud service URL template
- attached credential: bearer token, managed identity, service principal, API key
- sanitizer: strict host/resource-name regex, URL allowlist, cloud resource ID parser

Finding shape:

```text
Tool parameter `accountName` controls outbound URL host used with authenticated Azure request.
No Azure storage-account-name validation detected.
```

### 3. Tool Parameter To Connection String

Risk:

- connection string injection
- parameter pollution
- credential disclosure to attacker-controlled host

Evidence model:

- source: MCP tool input parameter
- sink: connection string concatenation or builder
- delimiter risk: `;`, `=`, URL query separators, headers
- sanitizer: typed connection string builder or delimiter-rejecting validation

Finding shape:

```text
Tool parameter `database` is interpolated into a connection string that also contains credentials.
No delimiter validation or typed builder detected.
```

### 4. Tool Parameter To Process Execution

Risk:

- arbitrary command execution
- cloud CLI abuse
- credential exposure through command-line arguments

Evidence model:

- source: MCP tool input parameter
- sink: subprocess/process/CLI execution
- sanitizer: command allowlist, argument array validation, policy enforcement in server code

Finding shape:

```text
Tool parameter `command` reaches process execution.
Tool description requires confirmation, but no server-side allowlist is enforced.
```

### 5. Tool Parameter To Filesystem Sink

Risk:

- path traversal
- arbitrary file write/read/delete
- persistence through config/profile/cron/SSH paths

Evidence model:

- source: MCP tool path parameter
- sink: read/write/mkdir/delete/archive extraction
- sanitizer: containment under configured root, path canonicalization plus root check, deny symlinks where relevant

Finding shape:

```text
Tool parameter `destinationPath` controls file write destination.
Path is normalized but not constrained to an allowed root.
```

### 6. Validation Asymmetry

Risk:

- one service has validation while a sibling service omits it
- patched CVE pattern remains in parallel implementations

Evidence model:

- detect parallel service families,
- detect validator functions in one family,
- detect structurally similar sink in sibling without validator,
- optionally connect to known CVE pattern.

Finding shape:

```text
MySQL query tool validates read-only safety before execution.
PostgreSQL query tool exposes equivalent query execution without the same validation guard.
```

## Architecture Additions

Add a taint-aware security track beside annotation verification:

```text
Tool Extractors
  -> Tool Parameter Source Model
  -> Semgrep/Taint Rules
  -> Validation/Sanitizer Model
  -> Vulnerability Evidence Comparator
  -> Findings:
       annotation drift
       unsafe input-to-sink flow
       validation asymmetry
       capability drift
```

This keeps the same core engine and reporting surface while expanding beyond hints.

## Product Implication

Keep public positioning tight:

> HintLint verifies MCP tool claims and traces dangerous tool inputs to source evidence.

Avoid becoming a generic vulnerability scanner on day one. The security rules should be MCP-specific:

- tool inputs as attacker-controlled sources,
- LLM confirmation is not a security control,
- credentials attached to tool-side requests amplify impact,
- annotations and tool descriptions are claims, not enforcement.
- AIVSS/CWE mappings can be included as reporting metadata, but should not replace source evidence.

## Methodology Reuse

The CSA `mcpserver-audit` repository is useful as a checklist and education source, not as the product surface to copy. HintLint should convert relevant methodology into deterministic checks:

- credential handling checks become source/evidence rules,
- network binding checks become config/runtime-surface rules,
- dynamic content execution checks become tool-input-to-code-exec rules,
- Docker/Kubernetes checks remain later deployment-context add-ons,
- AIVSS/CWE mappings become report fields for enterprise/security review.

The key distinction:

```text
mcpserver-audit: expert-guided audit checklist and teaching workflow
HintLint: executable CI verifier with machine-readable source evidence
```

## Fixture Additions

Add fixture cases for:

- raw SQL query parameter,
- unsafe identifier interpolation,
- connection string delimiter injection,
- user-controlled URL host with bearer token,
- arbitrary CLI command string,
- path normalization without root containment,
- safe counterpart with validator,
- sibling service missing validator.

## Differentiation From Existing Auditors

Existing tools often classify tool risk from names/descriptions or detect dangerous code patterns at file level. HintLint should be better by requiring:

- source parameter identified as MCP tool input,
- sink identified with category,
- sanitizer/validator check,
- tool-specific evidence path,
- exact repair guidance,
- abstain behavior when reachability is not established.

## Safety Notes

Reports should avoid exploit payloads by default. Developer output should describe the unsafe flow and required validation pattern without providing copy-paste attack strings unless an explicit `--show-poc` or internal mode exists.
