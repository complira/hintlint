# Enterprise Usage Guide

HintLint integrates into your MCP server adoption workflow as a pre-registry gate. Before an MCP server is approved for use with AI agents, HintLint scans it and verifies that tool annotations match actual behavior.

## Usage Patterns

### 1. Scan Before You Adopt (One-Shot)

Before adding a third-party MCP server to your enterprise catalog:

```bash
# Clone the server and scan it
git clone https://github.com/vendor/their-mcp-server.git
npx hintlint ./their-mcp-server

# Get structured output for your security review
npx hintlint ./their-mcp-server --format json --output review.json

# Get SARIF for import into Defect Dojo, Snyk, or your SIEM
npx hintlint ./their-mcp-server --format sarif --output review.sarif
```

If HintLint reports annotation drift, the server's tool metadata cannot be trusted for policy enforcement.

### 2. CI Gate on Your Own MCP Servers

Add HintLint to your MCP server's CI pipeline. Every PR gets scanned — annotation drift blocks merge.

```yaml
# .github/workflows/hintlint.yml
name: HintLint

on: [pull_request]

jobs:
  hintlint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: hintlint/hintlint@v0
        with:
          target: .
          fail-on: high
          upload-sarif: "true"
          pr-comment: "true"
```

**What happens:**
- HintLint scans the MCP server source code
- Findings appear as inline annotations in the PR
- SARIF results appear in the GitHub Security tab
- The build fails if high-severity annotation drift is found

### 3. Pre-Registry Gate for MCP Server Catalog

When your enterprise maintains a catalog of approved MCP servers, run HintLint as the admission gate:

```bash
# Create your enterprise catalog
cat > catalog.json << 'EOF'
{
  "manifest_version": "hintlint.benchmark.v1",
  "name": "acme-corp-mcp-catalog",
  "servers": [
    {
      "id": "internal-billing",
      "name": "Billing MCP",
      "enabled": true,
      "source": { "kind": "git", "url": "git@github.com:acme/billing-mcp.git" }
    },
    {
      "id": "vendor-crm",
      "name": "Vendor CRM MCP",
      "enabled": true,
      "source": { "kind": "git", "url": "https://github.com/vendor/crm-mcp.git" }
    }
  ]
}
EOF

# Scan all servers in the catalog
npx hintlint-scan --manifest catalog.json --semgrep docker

# Auto-review findings
npx hintlint-review-auto

# Generate validated report
npx hintlint-review-report
```

The validated report tells you which servers have verified annotations (safe to register) and which have drift (block or require manual review).

### 4. Continuous Monitoring

Run HintLint on a schedule to catch drift when servers update:

```bash
# Scan every hour, alert on new findings
node scripts/continuous-scan.js \
  --manifest catalog.json \
  --interval 3600 \
  --webhook https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**What happens:**
- Every hour, HintLint pulls the latest code for each server
- Scans, cross-validates, auto-reviews
- Compares against the previous scan
- If new annotation drift is found, sends a webhook alert

### 5. GitHub Actions for Catalog Scanning

Automate catalog scanning as a scheduled GitHub Action:

```yaml
# .github/workflows/mcp-catalog-scan.yml
name: MCP Catalog Scan

on:
  schedule:
    - cron: "0 6 * * *"  # Daily at 6 AM UTC
  workflow_dispatch:       # Manual trigger

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Scan MCP catalog
        run: |
          node scripts/scan-public-mcp.js \
            --manifest catalog.json \
            --semgrep docker \
            --out scan-results

      - name: Auto-review findings
        run: |
          node scripts/cross-validate-public.js \
            --reports scan-results/reports \
            --tools bandit
          node scripts/generate-review-scaffold.js \
            --input scan-results/cross-validation/summary.json
          node scripts/auto-review.js \
            --reports scan-results/reports
          node scripts/generate-validated-report.js \
            --out scan-results

      - name: Upload scan results
        uses: actions/upload-artifact@v4
        with:
          name: mcp-catalog-scan
          path: scan-results/

      - name: Alert on new findings
        if: always()
        run: |
          findings=$(node -e "
            const r = JSON.parse(require('fs').readFileSync('scan-results/validated-report.json','utf-8'));
            console.log(r.totals.confirmed);
          ")
          if [ "$findings" -gt "0" ]; then
            echo "::warning::$findings confirmed annotation drift findings in MCP catalog"
          fi
```

## Integration Points

### MCP Gateway / Registry

HintLint produces a **registry artifact** for each scanned server — a compact JSON file containing trust metadata:

```bash
npx hintlint ./my-server --format registry
```

```json
{
  "artifact_version": "hintlint.registry-artifact.v1",
  "server": { "name": "my-server" },
  "summary": {
    "tools_scanned": 15,
    "findings": 0,
    "highest_severity": null
  },
  "tools": [
    { "name": "get_data", "finding_count": 0, "verified_behavior": { "readOnlyHint": true } }
  ]
}
```

Your MCP gateway can consume this artifact to enforce policy: only allow tools with verified annotations, require human approval for unverified tools, block tools with known drift.

### SIEM / Security Platform

HintLint SARIF output imports directly into:
- **GitHub Security** — via `upload-sarif` action
- **Defect Dojo** — SARIF import
- **Snyk** — SARIF import via API
- **Splunk / Sentinel** — parse SARIF JSON for alerting
- **Jira** — create tickets from findings via CI script

### SBOM Correlation

HintLint findings reference specific files, lines, and CWE IDs. Cross-reference with your SBOM to identify which deployed MCP servers have unverified annotations:

```bash
# Generate SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Scan and correlate
npx hintlint . --format json --output hintlint.json
```

## Output Formats

| Format | Use Case | Command |
|--------|----------|---------|
| Terminal | Developer review | `npx hintlint .` |
| JSON | Programmatic consumption | `npx hintlint . --format json` |
| SARIF | GitHub Security, SIEM | `npx hintlint . --format sarif` |
| Registry | MCP gateway policy | `npx hintlint . --format registry` |
| ML Features | Training data export | `npx hintlint . --format features` |

## Contact

For enterprise integration support: venkata@complira.co
