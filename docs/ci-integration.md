# CI Integration Guide

HintLint integrates with any CI system that can run Node.js. It produces SARIF output for security platforms and exits with code 1 when findings exceed your threshold.

## GitHub Actions (Recommended)

### Using the HintLint Action

```yaml
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

### Action Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `target` | `.` | Path to MCP server source |
| `fail-on` | `high` | Minimum severity to fail: `critical`, `high`, `medium`, `low` |
| `upload-sarif` | `false` | Upload SARIF to GitHub Security tab |
| `pr-comment` | `false` | Post finding summary as PR comment |
| `config` | | HintLint config file path |
| `semgrep-json` | | Semgrep JSON results to import |
| `sarif-output` | `hintlint.sarif` | SARIF output path |
| `text-output` | `hintlint.txt` | Text summary output path |
| `github-token` | `${{ github.token }}` | Token for PR comments |
| `node-version` | `20` | Node.js version |
| `enable-ml` | `false` | Run optional ML sidecar |

### Using npx Directly

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
- run: npx hintlint . --ci --fail-on high --format sarif --output hintlint.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: hintlint.sarif
```

## GitLab CI

```yaml
hintlint:
  image: node:20-slim
  stage: test
  script:
    - npx hintlint . --ci --fail-on high --format sarif --output gl-hintlint.sarif
    - npx hintlint . --format json --output gl-hintlint.json
  artifacts:
    reports:
      sast: gl-hintlint.sarif
    paths:
      - gl-hintlint.json
    when: always
```

GitLab imports SARIF via `reports:sast` and displays findings in the Security Dashboard.

## Jenkins

```groovy
pipeline {
    agent { docker { image 'node:20-slim' } }
    stages {
        stage('HintLint') {
            steps {
                sh 'npx hintlint . --ci --fail-on high --format sarif --output hintlint.sarif'
                sh 'npx hintlint . --format json --output hintlint.json'
                archiveArtifacts artifacts: 'hintlint.sarif, hintlint.json'
            }
        }
    }
}
```

Import `hintlint.sarif` into Jenkins warnings-ng plugin for dashboard integration.

## Azure DevOps

```yaml
- task: NodeTool@0
  inputs:
    versionSpec: '20.x'
- script: npx hintlint . --ci --fail-on high --format sarif --output $(Build.ArtifactStagingDirectory)/hintlint.sarif
- task: PublishBuildArtifacts@1
  inputs:
    pathToPublish: $(Build.ArtifactStagingDirectory)/hintlint.sarif
    artifactName: hintlint-sarif
```

## CircleCI

```yaml
jobs:
  hintlint:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npx hintlint . --ci --fail-on high --format sarif --output hintlint.sarif
      - store_artifacts:
          path: hintlint.sarif
```

## With Semgrep

For deeper evidence, run Semgrep first and feed the results to HintLint:

```yaml
# GitHub Actions example
- name: Run Semgrep
  uses: semgrep/semgrep-action@v1
  with:
    config: rules/semgrep/hintlint-mcp.yml
    output: semgrep.json
    
- name: Run HintLint with Semgrep evidence
  run: npx hintlint . --semgrep-json semgrep.json --ci --fail-on high
```

## Threshold Configuration

The `--fail-on` flag sets the minimum severity that fails the build:

| Value | Fails On |
|-------|----------|
| `critical` | Only critical findings |
| `high` | Critical + high findings (recommended) |
| `medium` | Critical + high + medium |
| `low` | All findings |

Only source-backed findings (L3/L4 evidence tier) can fail the build. Metadata-only and project-level findings never block CI regardless of severity.
