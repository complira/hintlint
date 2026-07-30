import { resolve } from "node:path";
import { discoverProject } from "./project-discovery.js";
import { analyzeTools } from "./evidence/static-detector.js";
import { scanPython } from "./extractors/python.js";
import { scanToolsListJson } from "./extractors/tools-list-json.js";
import { scanTypeScript } from "./extractors/typescript.js";

export async function runScan(targetPath, options = {}) {
  const startedAt = new Date();
  const root = resolve(targetPath);
  const project = await discoverProject(root);
  const tsResult = await scanTypeScript(project);
  const pyResult = await scanPython(project);
  const toolsListResult = await scanToolsListJson(project);
  const extractedTools = [...tsResult.tools, ...pyResult.tools, ...toolsListResult.tools].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const analysis = analyzeTools(extractedTools);
  const tools = analysis.tools;
  const unsupported = [...tsResult.unsupported, ...pyResult.unsupported, ...toolsListResult.unsupported];
  const endedAt = new Date();

  return {
    hintlint_version: "0.1.0",
    scan_started_at: startedAt.toISOString(),
    scan_duration_ms: endedAt.getTime() - startedAt.getTime(),
    target: root,
    project: {
      languages: project.languages,
      files_scanned: project.files.length
    },
    summary: {
      tools_scanned: tools.length,
      handlers_resolved: tools.filter((tool) => tool.handler?.confidence === "resolved").length,
      annotations_present: tools.filter((tool) => Object.keys(tool.declared_annotations).length > 0).length,
      unsupported_patterns: unsupported.length,
      findings: analysis.findings.length
    },
    tools,
    findings: analysis.findings,
    unsupported,
    options
  };
}
