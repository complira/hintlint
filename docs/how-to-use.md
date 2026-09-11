# How to use HintLint

## 1. Get your MCP server code

Make sure the server code is on your computer. If it is on GitHub, download it first:

```bash
git clone https://github.com/org/my-mcp-server.git
```

## 2. Run HintLint

```bash
npx hintlint ./my-mcp-server
```

Or install it globally with npm:

```bash
npm install --global hintlint
hintlint ./my-mcp-server
```

HintLint is currently an npm package. There is no PyPI installation for the CLI.

Replace `./my-mcp-server` with the folder that contains your MCP server.

## 3. Read the result

HintLint tells you when a tool’s annotation does not match its code.

For example:

```text
HIGH  delete_access_key
      destructiveHint is missing
```

This means the tool can delete something, but it did not declare that behavior.

## 4. Fix the issue

Update the annotation or the code, then run the command again.

## Optional: use it in GitHub Actions

Add this to your workflow:

```yaml
- uses: complira/hintlint@v0
  with:
    target: .
    fail-on: high
```

That’s it. HintLint checks the MCP server code on every push or pull request.
