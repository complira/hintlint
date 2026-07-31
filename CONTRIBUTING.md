# Contributing to HintLint

Thank you for your interest in contributing to HintLint.

## Getting Started

```bash
git clone https://github.com/hintlint/hintlint.git
cd hintlint
npm test
```

HintLint has zero npm dependencies. You only need Node.js >= 20.

## Development Workflow

1. Fork the repository and create a feature branch from `main`
2. Make your changes
3. Run the test suite: `npm test`
4. Run fixture scans: `npm run scan:fixtures`
5. Submit a pull request

## What We Accept

- **Extractor improvements**: New tool registration patterns for TypeScript, Python, or new languages
- **Evidence rules**: New sink categories, sanitizer patterns, or flow detections
- **Bug fixes**: False positive reductions, edge case handling
- **Documentation**: Corrections, examples, guides

## What We Don't Accept

- Adding npm dependencies (the zero-dependency policy is intentional)
- Features that require runtime execution of scanned code
- Changes that reduce precision (lower true positive rate) without clear justification

## Code Style

- No linter or formatter is enforced. Match the existing style.
- Prefer explicit code over abstractions. Three similar lines is better than a premature helper.
- Add tests for new extraction patterns. Every fixture should represent a real-world MCP server pattern.
- Keep finding messages actionable: tell the user what's wrong and what to do.

## Testing

```bash
npm test                    # Run all tests (51 tests)
npm run scan:fixtures       # Run all fixture scans
npm run benchmark           # Run fixture benchmark
```

Tests use Node.js built-in `node:test`. No test framework dependencies.

## Reporting Bugs

Open a GitHub issue with:

1. The MCP server source pattern that HintLint fails on (anonymized if needed)
2. Expected behavior
3. Actual behavior
4. HintLint version (`node src/cli.js --version`)

## Security Issues

See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
