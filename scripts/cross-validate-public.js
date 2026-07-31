#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBanditJson } from "../src/evidence/bandit-normalizer.js";
import { normalizeEslintJson } from "../src/evidence/eslint-normalizer.js";
import { normalizeCodeqlSarif } from "../src/evidence/codeql-normalizer.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REPORTS = join(ROOT, "benchmark", "results-public", "reports");
const DEFAULT_WORKDIR = join(ROOT, "benchmark", "external", "public-mcp", "repos");
const DEFAULT_OUT = join(ROOT, "benchmark", "results-public", "cross-validation");

function usage() {
  return [
    "Usage: node scripts/cross-validate-public.js [options]",
    "",
    "Run external analysis tools against cloned MCP repos and correlate with HintLint findings.",
    "",
    "Options:",
    "  --reports <path>     HintLint reports directory. Default: benchmark/results-public/reports",
    "  --workdir <path>     Cloned repos directory. Default: benchmark/external/public-mcp/repos",
    "  --out <path>         Output directory. Default: benchmark/results-public/cross-validation",
    "  --tools <list>       Comma-separated tools to run: bandit,eslint,codeql. Default: bandit,eslint",
    "  --limit <n>          Process only the first n servers",
    "  --help               Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    reports: DEFAULT_REPORTS,
    workdir: DEFAULT_WORKDIR,
    out: DEFAULT_OUT,
    tools: ["bandit", "eslint"],
    limit: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--reports") { args.reports = resolve(argv[++i]); continue; }
    if (arg === "--workdir") { args.workdir = resolve(argv[++i]); continue; }
    if (arg === "--out") { args.out = resolve(argv[++i]); continue; }
    if (arg === "--tools") { args.tools = argv[++i].split(",").map((t) => t.trim()); continue; }
    if (arg === "--limit") { args.limit = parseInt(argv[++i], 10); continue; }
  }
  return args;
}

function runCommand(command, commandArgs, options = {}) {
  const allowedExitCodes = options.allowedExitCodes ?? [0];
  return new Promise((res, rej) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rej);
    child.on("close", (code) => {
      if (allowedExitCodes.includes(code)) {
        res({ code, stdout, stderr });
        return;
      }
      rej(new Error(`${command} exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ---------- Docker images ----------

const BANDIT_IMAGE = "pysanity/bandit:latest";
const ESLINT_IMAGE = "node:20-slim";
const CODEQL_IMAGE = "mcr.microsoft.com/cstsectools/codeql-container:latest";

// ---------- Tool runners (Docker) ----------

async function runBandit(repoDir, outDir) {
  const outPath = join(outDir, "bandit.json");
  try {
    // Run Bandit via Docker, mount repo read-only
    const result = await runCommand("docker", [
      "run", "--rm",
      "-v", `${repoDir}:/src:ro`,
      BANDIT_IMAGE,
      "bandit", "-r", "/src", "-f", "json",
      "--exit-zero" // don't fail on findings
    ], {
      allowedExitCodes: [0, 1]
    });
    if (result.stdout.trim()) {
      const banditJson = JSON.parse(result.stdout);
      await writeFile(outPath, JSON.stringify(banditJson, null, 2));
      return banditJson;
    }
  } catch (err) {
    // Try fallback: pip-installed bandit image may not exist, use python slim
    try {
      const result = await runCommand("docker", [
        "run", "--rm",
        "-v", `${repoDir}:/src:ro`,
        "python:3.12-slim",
        "sh", "-c", "pip install -q bandit && bandit -r /src -f json --exit-zero"
      ], {
        allowedExitCodes: [0, 1]
      });
      if (result.stdout.trim()) {
        // Filter out pip install output, keep only JSON
        const lines = result.stdout.split("\n");
        const jsonStart = lines.findIndex((l) => l.trim().startsWith("{"));
        if (jsonStart >= 0) {
          const jsonStr = lines.slice(jsonStart).join("\n");
          const banditJson = JSON.parse(jsonStr);
          await writeFile(outPath, JSON.stringify(banditJson, null, 2));
          return banditJson;
        }
      }
    } catch {
      // Bandit unavailable
    }
  }
  return null;
}

async function runEslint(repoDir, outDir) {
  const outPath = join(outDir, "eslint.json");
  try {
    // ESLint 8.x with --no-eslintrc works better in Docker than ESLint 9.x flat config
    const script = [
      'npm install --no-save eslint@8 eslint-plugin-security 2>/dev/null 1>/dev/null',
      '&&',
      'npx eslint --no-eslintrc --plugin security',
      '--rule \'{"security/detect-child-process": "error", "security/detect-eval-with-expression": "error", "security/detect-non-literal-fs-filename": "warn", "security/detect-non-literal-require": "error"}\'',
      '--format json --ext .js,.ts,.mjs,.cjs /src 2>/dev/null; true'
    ].join(" ");

    const result = await runCommand("docker", [
      "run", "--rm",
      "-v", `${repoDir}:/src:ro`,
      "-w", "/tmp/eslint-runner",
      ESLINT_IMAGE,
      "sh", "-c", `mkdir -p /tmp/eslint-runner && cd /tmp/eslint-runner && ${script}`
    ], {
      allowedExitCodes: [0, 1, 2]
    });
    if (result.stdout.trim()) {
      // Filter to JSON array output (skip npm install noise on stderr)
      const lines = result.stdout.split("\n");
      const jsonStart = lines.findIndex((l) => l.trim().startsWith("["));
      if (jsonStart >= 0) {
        const jsonStr = lines.slice(jsonStart).join("\n");
        try {
          const eslintJson = JSON.parse(jsonStr);
          await writeFile(outPath, JSON.stringify(eslintJson, null, 2));
          return eslintJson;
        } catch {
          // JSON parse failed — partial output
        }
      }
    }
  } catch {
    // ESLint unavailable
  }
  return null;
}

async function runCodeql(repoDir, outDir) {
  const sarifPath = join(outDir, "codeql.sarif");
  const rulesDir = join(ROOT, "rules", "codeql");
  try {
    await runCommand("docker", [
      "run", "--rm",
      "-v", `${repoDir}:/src:ro`,
      "-v", `${rulesDir}:/rules:ro`,
      "-v", `${outDir}:/out`,
      CODEQL_IMAGE,
      "sh", "-c",
      "codeql database create /tmp/db --language=javascript --source-root=/src --overwrite 2>/dev/null && " +
      "codeql database analyze /tmp/db /rules --format=sarif-latest --output=/out/codeql.sarif 2>/dev/null"
    ], {
      allowedExitCodes: [0]
    });
    if (await fileExists(sarifPath)) {
      return JSON.parse(await readFile(sarifPath, "utf-8"));
    }
  } catch {
    // CodeQL unavailable
  }
  return null;
}

// ---------- Cross-validation matching ----------

const LINE_TOLERANCE = 5;

function evidenceCorroboratesFinding(evidence, finding) {
  if (!evidence.tool || evidence.tool !== finding.tool) return false;
  // Match category: evidence category should align with finding type
  const findingCategories = (finding.evidence ?? []).map((e) => e.category);
  if (!findingCategories.includes(evidence.category)) return false;
  // Match file
  const findingFiles = (finding.evidence ?? []).map((e) => e.file);
  if (!findingFiles.includes(evidence.file)) return false;
  // Match line within tolerance
  const findingLines = (finding.evidence ?? []).map((e) => e.line);
  return findingLines.some((fl) => Math.abs(fl - evidence.line) <= LINE_TOLERANCE);
}

function buildCorroboration(finding, evidenceByEngine, allEngines) {
  const enginesConfirming = [];
  const evidenceMap = {};

  // The builtin engine always confirms (it produced the finding)
  enginesConfirming.push("builtin");
  evidenceMap.builtin = finding.evidence ?? [];

  for (const [engine, evidenceRecords] of Object.entries(evidenceByEngine)) {
    const matching = evidenceRecords.filter((e) => evidenceCorroboratesFinding(e, finding));
    if (matching.length > 0) {
      enginesConfirming.push(engine);
      evidenceMap[engine] = matching;
    }
  }

  const enginesNoSignal = allEngines.filter((e) => !enginesConfirming.includes(e));

  return {
    engines_confirming: enginesConfirming,
    engines_no_signal: enginesNoSignal,
    confirmation_count: enginesConfirming.length,
    evidence_by_engine: evidenceMap
  };
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  await mkdir(args.out, { recursive: true });

  // Discover server reports
  const reportFiles = (await readdir(args.reports)).filter((f) => f.endsWith(".json"));
  let serverIds = reportFiles.map((f) => f.replace(/\.json$/, ""));
  if (args.limit) serverIds = serverIds.slice(0, args.limit);

  const allEngines = ["builtin", ...args.tools];
  const allFindings = [];
  const engineCoverage = {};
  for (const engine of args.tools) {
    engineCoverage[engine] = { repos_analyzed: 0, repos_skipped: 0, evidence_produced: 0 };
  }

  for (const serverId of serverIds) {
    console.log(`\nCross-validating: ${serverId}`);

    // Load the HintLint report
    const report = JSON.parse(await readFile(join(args.reports, `${serverId}.json`), "utf-8"));
    const findings = report.findings ?? [];
    const tools = report.tools ?? [];
    const repoDir = join(args.workdir, serverId);
    // Docker tools mount the repo at /src, so paths come back as /src/foo.py
    // Use /src as root for Docker normalizers so relativeEvidencePath strips it correctly
    const project = { root: repoDir };
    const dockerProject = { root: "/src" };
    const serverOutDir = join(args.out, serverId);
    await mkdir(serverOutDir, { recursive: true });

    if (!existsSync(repoDir)) {
      console.log(`  SKIP — repo not found at ${repoDir}`);
      for (const engine of args.tools) engineCoverage[engine].repos_skipped++;
      for (const finding of findings) {
        allFindings.push({
          server_id: serverId,
          finding,
          corroboration: buildCorroboration(finding, {}, allEngines)
        });
      }
      continue;
    }

    // Run external tools and normalize
    const evidenceByEngine = {};

    if (args.tools.includes("bandit")) {
      console.log("  Running Bandit...");
      const banditJson = await runBandit(repoDir, serverOutDir);
      if (banditJson) {
        const evidence = normalizeBanditJson(dockerProject, tools, banditJson);
        evidenceByEngine.bandit = evidence;
        engineCoverage.bandit.repos_analyzed++;
        engineCoverage.bandit.evidence_produced += evidence.length;
        console.log(`    Bandit: ${evidence.length} evidence records`);
      } else {
        engineCoverage.bandit.repos_skipped++;
        console.log("    Bandit: unavailable or failed");
      }
    }

    if (args.tools.includes("eslint")) {
      console.log("  Running ESLint...");
      const eslintJson = await runEslint(repoDir, serverOutDir);
      if (eslintJson) {
        const evidence = normalizeEslintJson(dockerProject, tools, eslintJson);
        evidenceByEngine.eslint = evidence;
        engineCoverage.eslint.repos_analyzed++;
        engineCoverage.eslint.evidence_produced += evidence.length;
        console.log(`    ESLint: ${evidence.length} evidence records`);
      } else {
        engineCoverage.eslint.repos_skipped++;
        console.log("    ESLint: unavailable or failed");
      }
    }

    if (args.tools.includes("codeql")) {
      console.log("  Running CodeQL...");
      const sarifJson = await runCodeql(repoDir, serverOutDir);
      if (sarifJson) {
        const evidence = normalizeCodeqlSarif(dockerProject, tools, sarifJson);
        evidenceByEngine.codeql = evidence;
        engineCoverage.codeql.repos_analyzed++;
        engineCoverage.codeql.evidence_produced += evidence.length;
        console.log(`    CodeQL: ${evidence.length} evidence records`);
      } else {
        engineCoverage.codeql.repos_skipped++;
        console.log("    CodeQL: unavailable or failed");
      }
    }

    // Correlate findings with cross-validation evidence
    for (const finding of findings) {
      const corroboration = buildCorroboration(finding, evidenceByEngine, allEngines);
      allFindings.push({ server_id: serverId, finding, corroboration });
    }

    // Write per-server cross-validation
    await writeFile(
      join(serverOutDir, "cross-validation.json"),
      JSON.stringify({ server_id: serverId, evidence_by_engine: evidenceByEngine }, null, 2)
    );
  }

  // Write aggregate summary
  const confirmedBy3Plus = allFindings.filter((f) => f.corroboration.confirmation_count >= 3).length;
  const confirmedBy2 = allFindings.filter((f) => f.corroboration.confirmation_count === 2).length;
  const singleOnly = allFindings.filter((f) => f.corroboration.confirmation_count === 1).length;

  const summary = {
    artifact_version: "hintlint.cross-validation.v1",
    generated_at: new Date().toISOString(),
    engines_used: allEngines,
    findings_total: allFindings.length,
    findings_confirmed_by_3_plus: confirmedBy3Plus,
    findings_confirmed_by_2: confirmedBy2,
    findings_single_engine_only: singleOnly,
    per_finding: allFindings,
    engine_coverage: engineCoverage
  };

  await writeFile(join(args.out, "summary.json"), JSON.stringify(summary, null, 2));

  console.log(`\n--- Cross-Validation Summary ---`);
  console.log(`Findings total: ${allFindings.length}`);
  console.log(`Confirmed by 3+ engines: ${confirmedBy3Plus}`);
  console.log(`Confirmed by 2 engines: ${confirmedBy2}`);
  console.log(`Single engine only: ${singleOnly}`);
  for (const [engine, cov] of Object.entries(engineCoverage)) {
    console.log(`${engine}: ${cov.repos_analyzed} repos analyzed, ${cov.evidence_produced} evidence records`);
  }
}

main().catch((error) => {
  console.error(`cross-validate: ${error.message}`);
  process.exit(1);
});
