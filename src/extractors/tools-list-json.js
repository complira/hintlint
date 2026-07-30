import { basename } from "node:path";
import { readSourceFile } from "./common.js";

const TOOLS_LIST_FILES = new Set([
  "tools-list.json",
  "tools.json",
  "mcp-tools.json"
]);

function isCandidate(filePath, project) {
  if (!filePath.endsWith(".json")) {
    return false;
  }
  if (project.files.length === 1 && project.root === filePath) {
    return true;
  }
  return TOOLS_LIST_FILES.has(basename(filePath));
}

function getToolArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.tools)) {
    return payload.tools;
  }
  if (Array.isArray(payload.result?.tools)) {
    return payload.result.tools;
  }
  return null;
}

function declaredAnnotations(tool) {
  const annotations = tool.annotations ?? tool.declared_annotations ?? {};
  return Object.fromEntries(
    Object.entries(annotations).filter(([, value]) => typeof value === "boolean")
  );
}

function inputSchema(tool) {
  const schema = tool.inputSchema ?? tool.input_schema ?? {};
  const parameterNames = Array.isArray(schema.parameter_names)
    ? schema.parameter_names
    : Object.keys(schema.properties ?? {});

  return {
    parameter_names: parameterNames.sort(),
    schema_format: "json-schema",
    json_schema: schema
  };
}

function lineForToolName(sourceFile, toolName) {
  const index = sourceFile.text.indexOf(`"${toolName}"`);
  if (index === -1) {
    return 1;
  }
  return sourceFile.text.slice(0, index).split("\n").length;
}

export async function scanToolsListJson(project) {
  const tools = [];
  const unsupported = [];

  for (const filePath of project.files.filter((file) => isCandidate(file, project))) {
    const sourceFile = await readSourceFile(filePath);
    let payload;
    try {
      payload = JSON.parse(sourceFile.text);
    } catch (error) {
      unsupported.push({
        file: project.relativePath(filePath),
        line: 1,
        reason: `Unable to parse tools/list JSON: ${error.message}`
      });
      continue;
    }

    const toolArray = getToolArray(payload);
    if (!toolArray) {
      continue;
    }

    for (const tool of toolArray) {
      if (!tool || typeof tool.name !== "string") {
        unsupported.push({
          file: project.relativePath(filePath),
          line: 1,
          reason: "tools/list JSON contains a tool without a string name"
        });
        continue;
      }

      const line = lineForToolName(sourceFile, tool.name);
      tools.push({
        name: tool.name,
        description: typeof tool.description === "string" ? tool.description : "",
        language: "metadata",
        source: {
          file: project.relativePath(filePath),
          line
        },
        input_schema: inputSchema(tool),
        declared_annotations: declaredAnnotations(tool),
        handler: {
          file: project.relativePath(filePath),
          line,
          symbol: null,
          confidence: "metadata_only"
        },
        extraction: {
          extractor: "tools-list-json",
          pattern: "tools/list"
        }
      });
    }
  }

  return { tools, unsupported };
}
