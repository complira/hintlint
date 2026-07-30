# Competitor Teardown: mcp-security-auditor

## Decision

Yes, analyze `mcp-security-auditor`, `mcp-security-audit`, and `ModelContextProtocol-Security/mcpserver-audit` before implementation.

`mcp-security-auditor` is the closest direct static-analysis overlap with HintLint because it publicly claims:

- static MCP security analysis,
- `readOnlyHint` auditing,
- `destructiveHint` auditing,
- read-only mode enforcement,
- JSON/SARIF/HTML/SIEM output,
- CI/CD mode with exit codes,
- Python, TypeScript, and JavaScript support.

`mcp-security-audit` is a separate package/tool that claims live MCP server enumeration, risk classification, injection pattern scanning, and scored reports. It is a closer overlap for advertised-surface and dynamic MCP auditing.

`ModelContextProtocol-Security/mcpserver-audit` is not currently a packaged scanner. It is a Cloud Security Alliance/community methodology repository with prompts, markdown check procedures, AIVSS/CWE-oriented scoring guidance, and ecosystem handoffs to audit-db, vulnerability-db, mcpserver-builder, and mcpserver-operator. It has no releases/packages and appears documentation/check driven rather than executable-product driven.

The goal is not to copy it. The goal is to prove HintLint has a sharper wedge:

> tool-level annotation drift and unsafe MCP input-to-sink flows with handler-to-sink source evidence and suggested patches.

## Teardown Questions

### Competitor Category

- Is it a packaged scanner, live MCP auditor, registry/gateway feature, or methodology/check repository?
- Is there a runnable CLI or only prompts/checklists?
- Are findings generated deterministically, by an AI assistant following prompts, or by runtime/live tests?
- Does it produce machine-readable artifacts suitable for CI?

### Product Surface

- What user does it serve: server author, security engineer, enterprise platform team, registry, or all of them?
- Is annotation verification a core workflow or one analyzer among many?
- How does it present annotation mismatch findings?
- Does it include suggested code or annotation patches?
- Does it optimize for local developer adoption or enterprise compliance reporting?

### Technical Depth

- How does it extract MCP tools?
- Which SDK patterns does it support?
- Does it map tool name to handler function?
- Does it trace handler-to-sink reachability?
- Does it use AST, Semgrep, tree-sitter, regex, import graph, call graph, or runtime introspection?
- Can it distinguish project-level risky code from tool-specific evidence?
- Does it support cross-file evidence?
- Does it produce evidence paths or only file-level findings?
- Does it model MCP tool parameters as taint sources?
- Does it detect validators/sanitizers, or only dangerous sinks?
- Does it distinguish "dangerous capability exists" from "attacker-controlled MCP input reaches dangerous capability"?

### Annotation Semantics

- How does it decide `readOnlyHint` is wrong?
- How does it decide `destructiveHint` is missing or wrong?
- Does it reason about `idempotentHint`?
- Does it reason about `openWorldHint`?
- Does it treat annotations as untrusted hints?
- Does it avoid proof claims for closed-source/remote-only servers?

### CI and Report Quality

- What is its JSON schema?
- What does SARIF point to: tool declaration, sink, or both?
- Does CI failure distinguish source-backed proof from heuristic suspicion?
- Does it support baselines and suppressions?
- Are exit codes predictable enough for adoption?

### Distribution

- Is the GitHub repo active and accessible?
- How many releases, stars, issues, and maintainers?
- Are there real users or only package metadata?
- Are examples runnable?
- Are reports polished enough to satisfy enterprise buyers?

### Methodology and Standards

- Does it use AIVSS, CVSS, CWE, OWASP, NIST, MITRE ATT&CK, or compliance mappings?
- Are checks structured enough to convert into Semgrep rules or HintLint validators?
- Does it define MCP-specific audit procedures we should incorporate into fixtures?
- Does it provide a reporting format that developers or enterprises recognize?

## Required Hands-On Evaluation

Use the same fixture suite planned for HintLint:

1. read-only list/search tool,
2. additive create tool,
3. destructive delete tool,
4. external email/payment/API side-effect tool,
5. shell/process execution tool,
6. dynamic/unknown handler tool,
7. false `readOnlyHint: true` tool,
8. missing `destructiveHint` tool,
9. false `openWorldHint: false` tool.

Run `mcp-security-auditor` on the fixtures and record:

- true positives,
- false positives,
- false negatives,
- whether evidence is tool-specific,
- whether source lines are actionable,
- whether suggested remediation is exact,
- whether CI/SARIF output is usable.

## HintLint Differentiation Bar

HintLint should not ship unless it is clearly better on at least three of these:

- More precise tool-to-handler extraction.
- Source-backed handler-to-sink evidence.
- Lower false positives through `unknown`/abstain behavior.
- Better suggested MCP annotation patch.
- Better SARIF mapping to both declaration and sink.
- Better fixture benchmark transparency.
- Cleaner GitHub Action developer experience.
- Explicit no-source/no-proof evidence tiers.

## Resulting Ticket

Add `HL-004: mcp-security-auditor teardown` to M0.

Exit criteria:

- source package inspected,
- CLI run on HintLint fixture suite,
- overlap matrix completed,
- differentiation requirements updated,
- build/no-build risk decision recorded.

Add `HL-005: CSA mcpserver-audit methodology alignment` to M0.

Exit criteria:

- repo classified as methodology/check framework vs executable scanner,
- current checks/prompts inventory captured,
- AIVSS/CWE/reporting ideas evaluated,
- any useful checks converted into HintLint fixture or ruleset requirements,
- partnership/community contribution path assessed.
