#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = join(ROOT, "benchmark", "public-mcp-manifest.json");
const DEFAULT_WORKDIR = join(ROOT, "benchmark", "external", "public-mcp");
const DEFAULT_OUT = join(ROOT, "benchmark", "results-public", "metadata-validation");
const DEFAULT_TIMEOUT_MS = 30_000;

function usage() {
  return [
    "Usage: node scripts/mcp-inspector.js [options]",
    "",
    "Start each MCP server, call tools/list, compare runtime annotations",
    "against HintLint source-extracted annotations.",
    "",
    "Options:",
    "  --manifest <path>    Public MCP manifest. Default: benchmark/public-mcp-manifest.json",
    "  --workdir <path>     Clone/work directory. Default: benchmark/external/public-mcp",
    "  --reports <path>     HintLint reports directory. Default: benchmark/results-public/reports",
    "  --out <path>         Output directory. Default: benchmark/results-public/metadata-validation",
    "  --limit <n>          Inspect only the first n enabled servers",
    "  --timeout <ms>       Per-server timeout in ms. Default: 30000",
    "  --help               Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    workdir: DEFAULT_WORKDIR,
    reports: join(ROOT, "benchmark", "results-public", "reports"),
    out: DEFAULT_OUT,
    limit: null,
    timeout: DEFAULT_TIMEOUT_MS
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (arg === "--manifest") { args.manifest = resolve(argv[++i]); continue; }
    if (arg === "--workdir") { args.workdir = resolve(argv[++i]); continue; }
    if (arg === "--reports") { args.reports = resolve(argv[++i]); continue; }
    if (arg === "--out") { args.out = resolve(argv[++i]); continue; }
    if (arg === "--limit") { args.limit = parseInt(argv[++i], 10); continue; }
    if (arg === "--timeout") { args.timeout = parseInt(argv[++i], 10); continue; }
  }
  return args;
}

/**
 * Send JSON-RPC message and read response from an MCP server stdio process.
 */
function sendJsonRpc(child, method, params = {}, id = 1) {
  return new Promise((res, rej) => {
    const message = JSON.stringify({ jsonrpc: "2.0", method, params, id });
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;

    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      // Look for Content-Length header followed by body
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.slice(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) return;
      const bodyLength = parseInt(lengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + bodyLength) return;
      const body = buffer.slice(bodyStart, bodyStart + bodyLength);
      child.stdout.removeListener("data", onData);
      try {
        res(JSON.parse(body));
      } catch (err) {
        rej(new Error(`Invalid JSON response: ${body.slice(0, 200)}`));
      }
    };
    child.stdout.on("data", onData);
    child.stdin.write(content);
  });
}

/**
 * Try to detect the start command for an MCP server from its package.json or manifest.
 */
function detectStartCommand(repoDir, serverEntry) {
  // Check manifest for runtime hints
  if (serverEntry.runtime?.command) {
    return { command: serverEntry.runtime.command, args: serverEntry.runtime.args ?? [] };
  }

  // Check for common Node.js entry points
  const pkgPath = join(repoDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf-8"));
      if (pkg.bin) {
        const binName = typeof pkg.bin === "string" ? pkg.bin : Object.values(pkg.bin)[0];
        if (binName) return { command: "node", args: [join(repoDir, binName)] };
      }
      if (pkg.main) {
        return { command: "node", args: [join(repoDir, pkg.main)] };
      }
    } catch {
      // ignore
    }
  }

  // Check for Python entry points
  const pyEntries = ["server.py", "main.py", "src/server.py", "src/main.py"];
  for (const entry of pyEntries) {
    if (existsSync(join(repoDir, entry))) {
      return { command: "python3", args: [join(repoDir, entry)] };
    }
  }

  return null;
}

/**
 * Attempt to start a server, send initialize + tools/list, and return results.
 */
async function inspectServer(repoDir, serverEntry, timeoutMs) {
  const startCmd = detectStartCommand(repoDir, serverEntry);
  if (!startCmd) {
    return { status: "no_start_command", tools: [] };
  }

  return new Promise((res) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      res({ status: "timeout", tools: [] });
    }, timeoutMs);

    let child;
    try {
      child = spawn(startCmd.command, startCmd.args, {
        cwd: repoDir,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: ["pipe", "pipe", "pipe"]
      });
    } catch (err) {
      clearTimeout(timer);
      res({ status: "start_failed", error: err.message, tools: [] });
      return;
    }

    child.on("error", (err) => {
      clearTimeout(timer);
      res({ status: "start_failed", error: err.message, tools: [] });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      res({ status: "exited_early", code, tools: [] });
    });

    // Give the server a moment to start, then send initialize + tools/list
    setTimeout(async () => {
      try {
        await sendJsonRpc(child, "initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "hintlint-inspector", version: "0.1.0" }
        }, 1);

        const toolsResponse = await sendJsonRpc(child, "tools/list", {}, 2);
        clearTimeout(timer);
        child.kill("SIGTERM");

        const tools = Array.isArray(toolsResponse?.result?.tools)
          ? toolsResponse.result.tools
          : [];

        res({ status: "success", tools });
      } catch (err) {
        clearTimeout(timer);
        child.kill("SIGTERM");
        res({ status: "protocol_error", error: err.message, tools: [] });
      }
    }, 2000);
  });
}

/**
 * Compare runtime annotations from tools/list against source-extracted annotations.
 */
function compareAnnotations(runtimeTools, sourceReport) {
  const sourceToolMap = new Map();
  if (sourceReport?.tools) {
    for (const tool of sourceReport.tools) {
      sourceToolMap.set(tool.name, tool);
    }
  }

  return runtimeTools.map((rt) => {
    const runtimeAnnotations = rt.annotations ?? {};
    const sourceTool = sourceToolMap.get(rt.name);
    const sourceAnnotations = sourceTool?.declared_annotations ?? {};

    const drifts = [];
    for (const key of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
      const runtimeVal = runtimeAnnotations[key];
      const sourceVal = sourceAnnotations[key];
      if (runtimeVal !== undefined && sourceVal !== undefined && runtimeVal !== sourceVal) {
        drifts.push({ annotation: key, runtime: runtimeVal, source: sourceVal });
      }
    }

    return {
      tool: rt.name,
      runtime_annotations: runtimeAnnotations,
      source_annotations: sourceAnnotations,
      source_extracted: sourceTool !== undefined,
      match: drifts.length === 0,
      drifts
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const manifest = JSON.parse(await readFile(args.manifest, "utf-8"));
  const servers = manifest.servers.filter((s) => s.enabled);
  const selected = args.limit ? servers.slice(0, args.limit) : servers;

  await mkdir(args.out, { recursive: true });

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const server of selected) {
    const repoDir = join(args.workdir, "repos", server.id);

    if (!existsSync(repoDir)) {
      console.log(`  SKIP ${server.id} — repo not cloned`);
      results.push({ server_id: server.id, status: "not_cloned", comparisons: [] });
      failCount++;
      continue;
    }

    console.log(`  INSPECT ${server.id}...`);
    const inspection = await inspectServer(repoDir, server, args.timeout);

    let comparisons = [];
    if (inspection.status === "success" && inspection.tools.length > 0) {
      // Load the HintLint source report for comparison
      const reportPath = join(args.reports, `${server.id}.json`);
      let sourceReport = null;
      if (existsSync(reportPath)) {
        sourceReport = JSON.parse(await readFile(reportPath, "utf-8"));
      }
      comparisons = compareAnnotations(inspection.tools, sourceReport);
      successCount++;
    } else {
      failCount++;
    }

    const result = {
      schema_version: "hintlint.metadata-validation.v1",
      server_id: server.id,
      server_name: server.name,
      status: inspection.status,
      error: inspection.error ?? null,
      runtime_tools_count: inspection.tools.length,
      comparisons,
      annotation_matches: comparisons.filter((c) => c.match).length,
      annotation_drifts: comparisons.filter((c) => !c.match).length,
      tools_not_in_source: comparisons.filter((c) => !c.source_extracted).length
    };

    results.push(result);
    await writeFile(join(args.out, `${server.id}.json`), JSON.stringify(result, null, 2));

    const statusIcon = inspection.status === "success" ? "OK" : inspection.status.toUpperCase();
    console.log(`    ${statusIcon}: ${inspection.tools.length} tools, ${result.annotation_drifts} drifts`);
  }

  // Write aggregate summary
  const summary = {
    schema_version: "hintlint.metadata-validation-summary.v1",
    generated_at: new Date().toISOString(),
    servers_inspected: selected.length,
    servers_success: successCount,
    servers_failed: failCount,
    total_runtime_tools: results.reduce((acc, r) => acc + r.runtime_tools_count, 0),
    total_annotation_drifts: results.reduce((acc, r) => acc + r.annotation_drifts, 0),
    total_tools_not_in_source: results.reduce((acc, r) => acc + r.tools_not_in_source, 0),
    servers: results.map((r) => ({
      server_id: r.server_id,
      status: r.status,
      runtime_tools: r.runtime_tools_count,
      drifts: r.annotation_drifts
    }))
  };

  await writeFile(join(args.out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nMetadata validation: ${successCount} success, ${failCount} failed, ${summary.total_annotation_drifts} drifts`);
}

main().catch((error) => {
  console.error(`mcp-inspector: ${error.message}`);
  process.exit(1);
});
