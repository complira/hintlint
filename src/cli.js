#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { applyConfig, loadConfig } from "./config.js";
import { runScan } from "./index.js";
import { renderJson } from "./reporters/json.js";
import { renderTerminal } from "./reporters/terminal.js";

const VERSION = "0.1.0";

function usage() {
  return [
    "Usage: hintlint <target> [options]",
    "",
    "Options:",
    "  --config <path>       Read hintlint config from a JSON or flat YAML file",
    "  --semgrep-json <path> Import Semgrep JSON and normalize it into evidence records",
    "  --format <text|json>   Output format. Default: text",
    "  --output <path>        Write report to a file",
    "  --ci                  Use CI exit-code behavior",
    "  --fail-on <severity>  Fail on findings at or above severity. Default: high",
    "  --version             Print version",
    "  --help                Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    target: null,
    config: null,
    semgrepJsonPath: null,
    format: "text",
    output: null,
    ci: false,
    failOn: "high",
    _explicit: new Set()
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (arg === "--version" || arg === "-v") {
      return { version: true };
    }
    if (arg === "--format") {
      args.format = argv[++i];
      args._explicit.add("format");
      continue;
    }
    if (arg === "--output") {
      args.output = argv[++i];
      args._explicit.add("output");
      continue;
    }
    if (arg === "--config") {
      args.config = argv[++i];
      continue;
    }
    if (arg === "--semgrep-json") {
      args.semgrepJsonPath = argv[++i];
      args._explicit.add("semgrepJsonPath");
      continue;
    }
    if (arg === "--ci") {
      args.ci = true;
      args._explicit.add("ci");
      continue;
    }
    if (arg === "--fail-on") {
      args.failOn = argv[++i];
      args._explicit.add("failOn");
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!args.target) {
      args.target = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!args.target) {
    throw new Error("Missing target path");
  }
  return args;
}

function validateArgs(args) {
  if (!["text", "json"].includes(args.format)) {
    throw new Error(`Unsupported format: ${args.format}`);
  }
  if (!["info", "low", "medium", "high", "critical"].includes(args.failOn)) {
    throw new Error(`Unsupported fail-on severity: ${args.failOn}`);
  }
}

function shouldFail(report, failOn) {
  const severityRank = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };
  const threshold = severityRank[failOn] ?? severityRank.high;
  return report.findings.some((finding) => {
    const rank = severityRank[finding.severity] ?? 0;
    return rank >= threshold && finding.confidence === "source-backed";
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.version) {
    console.log(VERSION);
    return;
  }

  const loadedConfig = await loadConfig(args.target, args.config);
  const effectiveArgs = applyConfig(args, loadedConfig.config);
  validateArgs(effectiveArgs);

  const report = await runScan(effectiveArgs.target, {
    config: loadedConfig.path,
    ci: effectiveArgs.ci,
    failOn: effectiveArgs.failOn,
    semgrepJsonPath: effectiveArgs.semgrepJsonPath
  });
  const rendered = effectiveArgs.format === "json" ? renderJson(report) : renderTerminal(report);

  if (effectiveArgs.output) {
    await writeFile(effectiveArgs.output, rendered, "utf8");
  } else {
    console.log(rendered);
  }

  if (effectiveArgs.ci && shouldFail(report, effectiveArgs.failOn)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`hintlint: ${error.message}`);
  process.exitCode = 2;
});
