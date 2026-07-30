# Runtime/Data-Flow Review

## Review Rounds

| Round | Decision | Findings | Required Updates |
| --- | --- | --- | --- |
| 1 | Candidate Go | Architecture is appropriately narrow, but ML could be over-positioned if shipped before labeled data exists | Keep ML off by default and require validation before enforcement |
| 2 | Go Confirmed | Planning artifacts separate deterministic proof from advisory ML and account for no-source cases | None |

## Missing Use Case Sweep

Covered:

- local source scan
- CI gate
- GitHub Action
- registry ingestion
- ML-assisted triage
- closed-source/no-source fallback

Not covered in MVP:

- hosted dashboard
- runtime gateway
- cross-language full call graph
- production ML classifier
- proof over closed-source remote servers

## Gate Decision

Proceed with constraints:

- Implement deterministic source-backed MVP first.
- Treat ML as research until benchmark, labels, and false-safe metrics exist.
- Keep CI failure limited to high-confidence source-backed findings.
- Avoid claims that HintLint proves complete tool behavior.
