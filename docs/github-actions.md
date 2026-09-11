# GitHub Actions and CI/CD

Run HintLint on any MCP server repository before changes are merged.

```yaml
name: MCP Security

on: [push, pull_request]

permissions:
  contents: read
  security-events: write

jobs:
  hintlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: complira/hintlint@v0
        with:
          target: .
          fail-on: high
          upload-sarif: "true"
```

For a monorepo, point `target` to the server directory:

```yaml
with:
  target: ./servers/customer-data-mcp
```

The action scans code checked out into the workflow workspace. It does not need the server running, cloud credentials, or access to production systems.

## Available outputs

- Terminal summary in the workflow log
- SARIF for GitHub code scanning
- JSON for automation and archival
- Optional pull request comment

See the complete examples for [GitHub, GitLab, Jenkins, Azure DevOps, and CircleCI](ci-integration.md).
