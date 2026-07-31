# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in HintLint, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **venkata@complira.co** with:

1. A description of the vulnerability
2. Steps to reproduce
3. The potential impact
4. Any suggested fix (optional)

We will acknowledge your report within 48 hours and provide a detailed response within 7 days.

## Scope

HintLint is a static analysis tool that reads source code files. Security concerns include:

- **Path traversal**: HintLint reads files relative to a target directory. It should not access files outside the target.
- **Command injection**: HintLint invokes Semgrep and Docker as subprocesses. User-controlled input must not reach shell commands unsanitized.
- **Report injection**: Finding messages and tool names from scanned code appear in SARIF, JSON, and terminal reports. These must not enable injection in downstream consumers.

## Dependencies

HintLint has **zero npm dependencies**. The attack surface is limited to Node.js built-in modules.

Optional external tools (Semgrep, Docker, CodeQL, Bandit) are invoked as subprocesses and are not bundled.
