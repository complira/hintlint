# CSA mcpserver-audit Alignment

## Classification

`ModelContextProtocol-Security/mcpserver-audit` is best classified as:

> methodology/check framework and community education resource.

It is not currently a direct executable scanner competitor:

- no releases,
- no packages,
- no main implementation language,
- `tools/` only contains a README,
- main value is prompts/checklists/research resources.

Repository metadata checked via GitHub API:

- Repository: `ModelContextProtocol-Security/mcpserver-audit`
- Created: 2025-07-14
- Pushed: 2026-07-14
- Stars: 21
- Forks: 5
- License: Apache-2.0

## Inventory

Current `checks/` inventory:

- `CHECK-TEMPLATE.md`
- `README-python-authentication-semgrep-security-check.md`
- `README.md`
- `advanced-obfuscation-evasion-security-check.md`
- `ci-secrets.md`
- `compose-security.md`
- `credential-management-security.md`
- `docker-security.md`
- `dynamic-content-execution-security-check.md`
- `http-client-resilience.md`
- `k8s-security.md`
- `main-prompt.md`
- `network-port-binding-security-check.md`
- `python-authentication-semgrep-security-check.md`

Current `prompts/` inventory:

- `PROMPT-TEMPLATE.md`
- `README.md`
- `main-prompt.md`
- `security-assessment.md`
- `targeted-evaluation.md`

## What To Reuse

CSA methodology is useful for HintLint as report metadata and rule roadmap:

- CWE mapping for findings.
- AIVSS/CVSS scoring vocabulary.
- Security education wording for remediation text.
- Check template structure for future community-contributed rules.
- Credential, network binding, dynamic execution, Docker, Kubernetes, and CI secret categories.

## What Not To Copy

Do not copy the product shape:

- Do not make HintLint a prompt pack.
- Do not require an AI assistant to perform core scan logic.
- Do not lead with broad educational audit workflow.
- Do not claim broad CWE coverage in M0/M1.

## HintLint Rule Roadmap Impact

Map selected CSA checks into future deterministic checks:

| CSA Check Area | HintLint Treatment | Milestone |
| --- | --- | --- |
| Credential management | Secret/credential evidence rules and CWE metadata | M2/M3 |
| Dynamic content execution | Tool-input-to-code/process execution taint rules | M2 |
| Network port binding | Config/runtime-surface checks | M4+ |
| HTTP client resilience | SSRF and outbound-host validation checks | M2/M3 |
| Docker security | Deployment context add-on | M7 |
| Kubernetes security | Deployment context add-on | M7 |
| CI secrets | Config/repo hygiene add-on | M4+ |
| Python auth Semgrep check | Potential external Semgrep rule inspiration | M2 |

## Reporting Impact

M0 schema now allows optional:

- `cwe_id`
- `cvss_score`
- `aivss_score`
- `standards[]`

These fields are optional because the current fixture-backed detector should not overstate standards coverage before rules are mapped and validated.

## Community/Distribution Implication

CSA is a possible distribution and credibility channel. The best posture is compatibility, not competition:

- publish deterministic checks that can complement their methodology,
- contribute real MCP-specific check examples once HintLint findings are validated,
- keep public claims reproducible and evidence-backed.
