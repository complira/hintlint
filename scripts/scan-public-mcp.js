#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runScan } from "../src/index.js";
import { SEVERITY_RANK } from "../src/policy.js";
import { toRegistryArtifact } from "../src/reporters/registry-artifact.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = join(ROOT, "benchmark", "public-mcp-manifest.json");
const DEFAULT_WORKDIR = join(ROOT, "benchmark", "external", "public-mcp");
const DEFAULT_OUT = join(ROOT, "benchmark", "results-public");
const DEFAULT_RULES = join(ROOT, "rules", "semgrep", "hintlint-mcp.yml");
const DEFAULT_SEMGREP_BIN = join(ROOT, ".venv-semgrep", "bin", "semgrep");
const DEFAULT_DOCKER_IMAGE = "semgrep/semgrep:1.172.0";

function usage() {
  return [
    "Usage: node scripts/scan-public-mcp.js [options]",
    "",
    "Options:",
    "  --manifest <path>      Public MCP manifest. Default: benchmark/public-mcp-manifest.json",
    "  --workdir <path>       Clone/work directory. Default: benchmark/external/public-mcp",
    "  --out <path>           Output directory. Default: benchmark/results-public",
    "  --limit <n>            Scan only the first n enabled manifest entries",
    "  --include-disabled     Include disabled manifest entries",
    "  --skip-fetch           Reuse existing clones without fetching latest default branch",
    "  --semgrep <mode>       auto, local, docker, or none. Default: auto",
    "  --semgrep-bin <path>   Local Semgrep binary. Default: .venv-semgrep/bin/semgrep",
    "  --semgrep-config <p>   Semgrep rule pack. Default: rules/semgrep/hintlint-mcp.yml",
    "  --docker-image <name>  Semgrep Docker image. Default: semgrep/semgrep:1.172.0",
    "  --help                 Show help"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    workdir: DEFAULT_WORKDIR,
    out: DEFAULT_OUT,
    limit: null,
    includeDisabled: false,
    skipFetch: false,
    semgrep: "auto",
    semgrepBin: DEFAULT_SEMGREP_BIN,
    semgrepConfig: DEFAULT_RULES,
    dockerImage: DEFAULT_DOCKER_IMAGE
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (arg === "--manifest") {
      args.manifest = resolve(argv[++index]);
      continue;
    }
    if (arg === "--workdir") {
      args.workdir = resolve(argv[++index]);
      continue;
    }
    if (arg === "--out") {
      args.out = resolve(argv[++index]);
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number.parseInt(argv[++index], 10);
      continue;
    }
    if (arg === "--include-disabled") {
      args.includeDisabled = true;
      continue;
    }
    if (arg === "--skip-fetch") {
      args.skipFetch = true;
      continue;
    }
    if (arg === "--semgrep") {
      args.semgrep = argv[++index];
      continue;
    }
    if (arg === "--semgrep-bin") {
      args.semgrepBin = resolve(argv[++index]);
      continue;
    }
    if (arg === "--semgrep-config") {
      args.semgrepConfig = resolve(argv[++index]);
      continue;
    }
    if (arg === "--docker-image") {
      args.dockerImage = argv[++index];
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!["auto", "local", "docker", "none"].includes(args.semgrep)) {
    throw new Error(`Unsupported Semgrep mode: ${args.semgrep}`);
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  return args;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function runCommand(command, commandArgs, options = {}) {
  const allowedExitCodes = options.allowedExitCodes ?? [0];
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectCommand);
    child.on("close", (code) => {
      if (allowedExitCodes.includes(code)) {
        resolveCommand({ code, stdout, stderr });
        return;
      }
      const printable = [command, ...commandArgs].join(" ");
      rejectCommand(new Error(`${printable} exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

function relativeIfInside(path) {
  const rel = relative(ROOT, path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
}

function selectedServers(manifest, args) {
  const enabled = manifest.servers.filter((server) => args.includeDisabled || server.enabled);
  return args.limit ? enabled.slice(0, args.limit) : enabled;
}

function gitRef(server) {
  return server.source.ref ?? "HEAD";
}

async function cloneOrUpdate(server, args) {
  const reposDir = join(args.workdir, "repos");
  const repoDir = join(reposDir, server.id);
  await mkdir(reposDir, { recursive: true });

  if (server.source.kind !== "git") {
    throw new Error("public scan runner only supports source.kind=git");
  }
  if (!server.source.url) {
    throw new Error("source.url is required");
  }

  if (!(await exists(join(repoDir, ".git")))) {
    const cloneArgs = ["clone", "--depth", "1", "--filter=blob:none"];
    if (server.source.ref) {
      cloneArgs.push("--branch", server.source.ref);
    }
    cloneArgs.push(server.source.url, repoDir);
    await runCommand("git", cloneArgs, { cwd: reposDir });
  } else if (!args.skipFetch) {
    await runCommand("git", ["-C", repoDir, "fetch", "--depth", "1", "origin", gitRef(server)]);
    await runCommand("git", ["-C", repoDir, "checkout", "--detach", "FETCH_HEAD"]);
  }

  if (server.source.commit) {
    await runCommand("git", ["-C", repoDir, "fetch", "--depth", "1", "origin", server.source.commit], {
      allowedExitCodes: [0, 1]
    });
    await runCommand("git", ["-C", repoDir, "checkout", "--detach", server.source.commit]);
  }

  const commit = (await runCommand("git", ["-C", repoDir, "rev-parse", "HEAD"])).stdout.trim();
  const targetPath = resolve(repoDir, server.source.path ?? ".");
  return { repoDir, targetPath, commit };
}

async function localSemgrepAvailable(args) {
  const bin = existsSync(args.semgrepBin) ? args.semgrepBin : "semgrep";
  try {
    const result = await runCommand(bin, ["--version"]);
    return { available: true, bin, version: result.stdout.trim() };
  } catch {
    return { available: false, bin, version: null };
  }
}

async function dockerSemgrepAvailable(args) {
  try {
    const result = await runCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
    return { available: true, version: result.stdout.trim(), image: args.dockerImage };
  } catch {
    return { available: false, version: null, image: args.dockerImage };
  }
}

async function resolveSemgrepMode(args) {
  if (args.semgrep === "none") {
    return { mode: "none" };
  }
  if (args.semgrep === "local") {
    const local = await localSemgrepAvailable(args);
    if (!local.available) {
      throw new Error(`local Semgrep is not available at ${local.bin}`);
    }
    return { mode: "local", ...local };
  }
  if (args.semgrep === "docker") {
    const docker = await dockerSemgrepAvailable(args);
    if (!docker.available) {
      throw new Error("Docker Semgrep requested but Docker daemon is not available");
    }
    return { mode: "docker", ...docker };
  }

  const local = await localSemgrepAvailable(args);
  if (local.available) {
    return { mode: "local", ...local };
  }
  const docker = await dockerSemgrepAvailable(args);
  if (docker.available) {
    return { mode: "docker", ...docker };
  }
  return { mode: "none", reason: "Semgrep unavailable" };
}

function semgrepEnv(args) {
  const env = { ...process.env };
  env.HOME = env.HINTLINT_SEMGREP_HOME || join(args.workdir, "semgrep-home");
  if (!env.SSL_CERT_FILE && existsSync("/etc/ssl/cert.pem")) {
    env.SSL_CERT_FILE = "/etc/ssl/cert.pem";
  }
  if (env.SSL_CERT_FILE) {
    env.CURL_CA_BUNDLE = env.CURL_CA_BUNDLE || env.SSL_CERT_FILE;
    env.REQUESTS_CA_BUNDLE = env.REQUESTS_CA_BUNDLE || env.SSL_CERT_FILE;
  }
  return env;
}

async function runLocalSemgrep(server, targetPath, semgrepJsonPath, semgrep, args) {
  await mkdir(dirname(semgrepJsonPath), { recursive: true });
  await mkdir(join(args.workdir, "semgrep-home"), { recursive: true });
  await runCommand(semgrep.bin, [
    "scan",
    "--metrics",
    "off",
    "--config",
    args.semgrepConfig,
    targetPath,
    "--json",
    "--output",
    semgrepJsonPath
  ], {
    env: semgrepEnv(args),
    allowedExitCodes: [0, 1]
  });
  return {
    server_id: server.id,
    mode: "local",
    path: relativeIfInside(semgrepJsonPath),
    version: semgrep.version
  };
}

async function runDockerSemgrep(server, targetPath, semgrepJsonPath, semgrep, args) {
  await mkdir(dirname(semgrepJsonPath), { recursive: true });
  const targetRel = relative(ROOT, targetPath);
  if (targetRel.startsWith("..") || isAbsolute(targetRel)) {
    throw new Error("Docker Semgrep mode requires targetPath inside the HintLint workspace");
  }
  const result = await runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${ROOT}:/src:ro`,
    "-w",
    "/src",
    semgrep.image,
    "semgrep",
    "scan",
    "--metrics",
    "off",
    "--config",
    `/src/${relative(ROOT, args.semgrepConfig)}`,
    `/src/${targetRel}`,
    "--json"
  ], {
    allowedExitCodes: [0, 1]
  });
  await writeFile(semgrepJsonPath, result.stdout, "utf8");
  return {
    server_id: server.id,
    mode: "docker",
    path: relativeIfInside(semgrepJsonPath),
    version: semgrep.version,
    image: semgrep.image
  };
}

async function runSemgrepFor(server, targetPath, semgrepJsonPath, semgrep, args) {
  if (semgrep.mode === "none") {
    return {
      server_id: server.id,
      mode: "none",
      path: null,
      reason: semgrep.reason ?? "disabled"
    };
  }
  if (semgrep.mode === "docker") {
    return runDockerSemgrep(server, targetPath, semgrepJsonPath, semgrep, args);
  }
  return runLocalSemgrep(server, targetPath, semgrepJsonPath, semgrep, args);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function severitySort(a, b) {
  return (SEVERITY_RANK[b.severity] ?? -1) - (SEVERITY_RANK[a.severity] ?? -1)
    || a.server_id.localeCompare(b.server_id)
    || a.tool.localeCompare(b.tool)
    || a.id.localeCompare(b.id);
}

function compactFinding(scan, finding) {
  return {
    server_id: scan.server.id,
    server_name: scan.server.name,
    id: finding.id,
    severity: finding.severity,
    type: finding.type,
    tool: finding.tool,
    confidence: finding.confidence,
    evidence_tier: finding.evidence_tier,
    message: finding.message,
    evidence: (finding.evidence ?? []).slice(0, 2).map((item) => ({
      file: item.file,
      line: item.line,
      category: item.category,
      sink: item.sink,
      rule_id: item.rule_id,
      evidence_tier: item.evidence_tier
    }))
  };
}

function aggregate(manifest, manifestPath, scans, skipped, failures, semgrep, generatedAt) {
  const severityCounts = {};
  const findingIdCounts = {};
  const findingTypeCounts = {};
  const extractionStatusCounts = {};
  const evidenceTierCounts = {};
  const findingTierCounts = {};
  const allFindings = [];

  for (const scan of scans) {
    increment(extractionStatusCounts, scan.report.coverage?.extraction_status ?? "unknown");
    for (const [tier, count] of Object.entries(scan.report.summary.evidence_records_by_tier ?? {})) {
      evidenceTierCounts[tier] = (evidenceTierCounts[tier] ?? 0) + count;
    }
    for (const [tier, count] of Object.entries(scan.report.summary.findings_by_tier ?? {})) {
      findingTierCounts[tier] = (findingTierCounts[tier] ?? 0) + count;
    }
    for (const finding of scan.report.findings) {
      increment(severityCounts, finding.severity);
      increment(findingIdCounts, finding.id);
      increment(findingTypeCounts, finding.type);
      allFindings.push(compactFinding(scan, finding));
    }
  }

  const sourceBackedFindings = allFindings.filter((finding) => finding.confidence === "source-backed");
  const sourceExtractableServers = scans.filter((scan) =>
    scan.report.coverage?.extraction_status === "supported" ||
    scan.report.coverage?.extraction_status === "unsupported_pattern"
  );
  const classifiedOrExtractedServers = scans.filter((scan) =>
    scan.report.summary.tools_scanned > 0 ||
    scan.report.coverage?.extraction_status !== "unknown"
  );
  const totalTools = scans.reduce((sum, scan) => sum + scan.report.summary.tools_scanned, 0);
  const totalResolvedHandlers = scans.reduce((sum, scan) => sum + scan.report.summary.handlers_resolved, 0);
  return {
    artifact_version: "hintlint.public-scan-summary.v1",
    generated_at: generatedAt,
    review_status: "unreviewed",
    manifest: {
      name: manifest.name,
      path: relativeIfInside(manifestPath),
      claim_level: manifest.methodology?.claim_level ?? "curated",
      scope: manifest.methodology?.scope ?? ""
    },
    semgrep: {
      mode: semgrep.mode,
      version: semgrep.version ?? null,
      image: semgrep.image ?? null,
      reason: semgrep.reason ?? null
    },
    totals: {
      servers_configured: manifest.servers.length,
      servers_scanned: scans.length,
      servers_skipped: skipped.length,
      servers_failed: failures.length,
      tools_scanned: scans.reduce((sum, scan) => sum + scan.report.summary.tools_scanned, 0),
      handlers_resolved: totalResolvedHandlers,
      handler_mapping_rate: totalTools ? Number((totalResolvedHandlers / totalTools).toFixed(4)) : null,
      source_evidence: scans.reduce((sum, scan) => sum + scan.report.summary.source_evidence, 0),
      project_evidence: scans.reduce((sum, scan) => sum + scan.report.summary.project_evidence, 0),
      findings: allFindings.length,
      source_backed_findings: sourceBackedFindings.length,
      zero_tool_servers: scans.filter((scan) => scan.report.summary.tools_scanned === 0).length,
      classified_or_extracted_rate: scans.length ? Number((classifiedOrExtractedServers.length / scans.length).toFixed(4)) : null,
      source_extractable_servers: sourceExtractableServers.length
    },
    coverage: {
      extraction_status_counts: sortedObject(extractionStatusCounts),
      evidence_records_by_tier: sortedObject(evidenceTierCounts),
      findings_by_tier: sortedObject(findingTierCounts)
    },
    counts_by_severity: sortedObject(severityCounts),
    counts_by_finding_id: sortedObject(findingIdCounts),
    counts_by_finding_type: sortedObject(findingTypeCounts),
    servers: scans.map((scan) => ({
      id: scan.server.id,
      name: scan.server.name,
      url: scan.server.source.url,
      commit: scan.commit,
      target: relativeIfInside(scan.targetPath),
      languages: scan.report.project.languages,
      tools_scanned: scan.report.summary.tools_scanned,
      handlers_resolved: scan.report.summary.handlers_resolved,
      source_evidence: scan.report.summary.source_evidence,
      project_evidence: scan.report.summary.project_evidence,
      coverage_status: scan.report.coverage?.extraction_status ?? "unknown",
      coverage_reason: scan.report.coverage?.extraction_reason ?? "",
      handler_mapping_rate: scan.report.coverage?.handler_mapping_rate,
      evidence_records_by_tier: scan.report.summary.evidence_records_by_tier,
      findings: scan.report.summary.findings,
      source_backed_findings: scan.report.findings.filter((finding) => finding.confidence === "source-backed").length,
      semgrep_json: scan.semgrepResult.path,
      raw_report: relativeIfInside(scan.reportPath),
      registry_artifact: relativeIfInside(scan.artifactPath)
    })),
    zero_tool_servers: scans
      .filter((scan) => scan.report.summary.tools_scanned === 0)
      .map((scan) => ({
        id: scan.server.id,
        status: scan.report.coverage?.extraction_status ?? "unknown",
        reason: scan.report.coverage?.extraction_reason ?? ""
      })),
    top_findings: allFindings.sort(severitySort).slice(0, 50),
    skipped,
    failures
  };
}

function markdownTable(headers, rows) {
  if (rows.length === 0) {
    return "None.\n";
  }
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`)
  ].join("\n") + "\n";
}

function renderMarkdown(summary) {
  const serverRows = summary.servers.map((server) => [
    server.id,
    server.commit.slice(0, 12),
    server.languages.join(", ") || "none",
    server.coverage_status,
    server.tools_scanned,
    server.handlers_resolved,
    server.source_evidence,
    server.findings,
    server.source_backed_findings
  ]);
  const findingRows = summary.top_findings.slice(0, 20).map((finding) => [
    finding.server_id,
    finding.tool,
    finding.severity,
    finding.id,
    finding.evidence[0] ? `${finding.evidence[0].file}:${finding.evidence[0].line}` : "n/a"
  ]);
  const failureRows = summary.failures.map((failure) => [failure.id, failure.reason]);

  return [
    "# HintLint Public MCP Scan Pilot",
    "",
    `Generated: ${summary.generated_at}`,
    "",
    "## Review Status",
    "",
    "Unreviewed. Treat these as scanner candidates, not confirmed vulnerabilities or public prevalence claims.",
    "",
    "## Scope",
    "",
    summary.manifest.scope,
    "",
    `Claim level: ${summary.manifest.claim_level}`,
    `Semgrep mode: ${summary.semgrep.mode}${summary.semgrep.version ? ` (${summary.semgrep.version})` : ""}`,
    "",
    "## Aggregate Stats",
    "",
    `- Servers scanned: ${summary.totals.servers_scanned}`,
    `- Servers failed: ${summary.totals.servers_failed}`,
    `- Tools scanned: ${summary.totals.tools_scanned}`,
    `- Handlers resolved: ${summary.totals.handlers_resolved}`,
    `- Handler mapping rate: ${summary.totals.handler_mapping_rate ?? "n/a"}`,
    `- Zero-tool servers: ${summary.totals.zero_tool_servers}`,
    `- Source evidence records: ${summary.totals.source_evidence}`,
    `- Project evidence records: ${summary.totals.project_evidence}`,
    `- Findings: ${summary.totals.findings}`,
    `- Source-backed findings: ${summary.totals.source_backed_findings}`,
    `- Extraction status counts: ${JSON.stringify(summary.coverage.extraction_status_counts)}`,
    `- Evidence records by tier: ${JSON.stringify(summary.coverage.evidence_records_by_tier)}`,
    "",
    "## Server Results",
    "",
    markdownTable(["Server", "Commit", "Languages", "Coverage", "Tools", "Handlers", "Evidence", "Findings", "Source-backed"], serverRows),
    "## Zero-Tool Servers",
    "",
    markdownTable(
      ["Server", "Status", "Reason"],
      summary.zero_tool_servers.map((server) => [server.id, server.status, server.reason])
    ),
    "## Top Unreviewed Findings",
    "",
    markdownTable(["Server", "Tool", "Severity", "Finding", "Evidence"], findingRows),
    "## Failures",
    "",
    markdownTable(["Server", "Reason"], failureRows),
    "## Methodology",
    "",
    "- Clone each enabled `git` source from `benchmark/public-mcp-manifest.json`.",
    "- Record the exact scanned commit in `summary.json`.",
    "- Run the HintLint Semgrep rule pack when Semgrep is available.",
    "- Import Semgrep JSON into HintLint and generate raw reports plus registry artifacts.",
    "- Keep generated clones and public-scan outputs ignored until manual review decides what to publish.",
    "",
    "## Constraints",
    "",
    "- Current extractor support is limited to TypeScript, JavaScript, Python, and metadata-only tools-list JSON.",
    "- Current Semgrep rules are pattern/sink oriented, not whole-program dataflow proof.",
    "- A public report requires manual review of every high-impact finding and maintainer-friendly reproduction notes.",
    ""
  ].join("\n");
}

async function scanPublicMcp(args) {
  const manifestPath = resolve(args.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const servers = selectedServers(manifest, args);
  const outDir = resolve(args.out);
  const reportsDir = join(outDir, "reports");
  const registryDir = join(outDir, "registry");
  const semgrepDir = join(outDir, "semgrep");
  const generatedAt = new Date().toISOString();

  await mkdir(reportsDir, { recursive: true });
  await mkdir(registryDir, { recursive: true });
  await mkdir(semgrepDir, { recursive: true });

  const semgrep = await resolveSemgrepMode(args);
  const scans = [];
  const skipped = [];
  const failures = [];

  for (const server of servers) {
    if (!server.enabled && !args.includeDisabled) {
      skipped.push({ id: server.id, reason: "disabled" });
      continue;
    }

    console.log(`[${server.id}] clone/update`);
    try {
      const { targetPath, commit } = await cloneOrUpdate(server, args);
      const semgrepJsonPath = join(semgrepDir, `${server.id}.semgrep.json`);
      console.log(`[${server.id}] semgrep ${semgrep.mode}`);
      const semgrepResult = await runSemgrepFor(server, targetPath, semgrepJsonPath, semgrep, args);
      console.log(`[${server.id}] hintlint`);
      const report = await runScan(targetPath, {
        semgrepJsonPath: semgrepResult.path ? resolve(ROOT, semgrepResult.path) : null
      });
      report.target = relativeIfInside(targetPath);

      const reportPath = join(reportsDir, `${server.id}.json`);
      const artifactPath = join(registryDir, `${server.id}.registry.json`);
      const source = {
        ...server.source,
        commit,
        path: server.source.path
      };
      const artifact = toRegistryArtifact(report, {
        id: server.id,
        name: server.name,
        source,
        tags: server.tags ?? [],
        generated_at: generatedAt
      });
      await writeJson(reportPath, report);
      await writeJson(artifactPath, artifact);
      scans.push({ server, report, reportPath, artifactPath, targetPath, commit, semgrepResult });
    } catch (error) {
      failures.push({ id: server.id, reason: error.message });
      console.error(`[${server.id}] failed: ${error.message}`);
    }
  }

  const summary = aggregate(manifest, manifestPath, scans, skipped, failures, semgrep, generatedAt);
  await writeJson(join(outDir, "summary.json"), summary);
  await writeFile(join(outDir, "public-scan-report.md"), renderMarkdown(summary), "utf8");

  console.log([
    `HintLint public MCP scan: ${manifest.name}`,
    `servers scanned: ${summary.totals.servers_scanned}`,
    `tools scanned: ${summary.totals.tools_scanned}`,
    `source-backed findings: ${summary.totals.source_backed_findings}`,
    `failures: ${summary.totals.servers_failed}`,
    `report: ${relativeIfInside(join(outDir, "public-scan-report.md"))}`
  ].join("\n"));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
} else {
  scanPublicMcp(args).catch((error) => {
    console.error(`hintlint public scan: ${error.message}`);
    process.exitCode = 2;
  });
}
