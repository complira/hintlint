import { readSourceFile, findMatchingParen, lineForOffset, parseBooleanAnnotations } from "./common.js";

const TS_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;
const TOOL_CALL_PATTERNS = [
  ".tool(",
  ".registerTool("
];

function collectCallBlocks(source) {
  const blocks = [];
  for (const pattern of TOOL_CALL_PATTERNS) {
    let searchFrom = 0;
    while (searchFrom < source.length) {
      const callIndex = source.indexOf(pattern, searchFrom);
      if (callIndex === -1) {
        break;
      }
      const openIndex = callIndex + pattern.length - 1;
      const closeIndex = findMatchingParen(source, openIndex);
      if (closeIndex === -1) {
        searchFrom = openIndex + 1;
        continue;
      }
      blocks.push({
        start: callIndex,
        end: closeIndex + 1,
        text: source.slice(callIndex, closeIndex + 1),
        kind: pattern === ".registerTool(" ? "registerTool" : "tool"
      });
      searchFrom = closeIndex + 1;
    }
  }
  return blocks;
}

function parseDescription(callText) {
  const strings = [...callText.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  return strings.length > 1 ? strings[1] : "";
}

function parseParameterNames(callText) {
  const params = new Set();
  for (const match of callText.matchAll(/(?:z\.)?object\s*\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    for (const prop of match[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) {
      params.add(prop[1]);
    }
  }
  for (const match of callText.matchAll(/properties\s*:\s*\{([\s\S]*?)\}/g)) {
    for (const prop of match[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) {
      params.add(prop[1]);
    }
  }
  for (const match of callText.matchAll(/(?:async\s*)?\(\s*\{([^}]*)\}\s*\)\s*=>/g)) {
    for (const param of match[1].split(",")) {
      const name = param.trim().split(/[=:]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) {
        params.add(name);
      }
    }
  }
  return [...params].sort();
}

function parseToolBlock(project, filePath, sourceFile, block) {
  const nameMatch = block.text.match(/\.(?:tool|registerTool)\s*\(\s*["']([^"']+)["']/);
  const name = nameMatch ? nameMatch[1] : null;
  if (!name) {
    return null;
  }

  const line = lineForOffset(sourceFile.lineStarts, block.start);
  const parameterNames = parseParameterNames(block.text);

  return {
    name,
    description: parseDescription(block.text),
    language: "typescript",
    source: {
      file: project.relativePath(filePath),
      line
    },
    input_schema: {
      parameter_names: parameterNames
    },
    declared_annotations: parseBooleanAnnotations(block.text),
    handler: {
      file: project.relativePath(filePath),
      line,
      symbol: null,
      confidence: block.text.includes("async") || block.text.includes("=>") || block.text.includes("function")
        ? "resolved"
        : "unknown"
    },
    extraction: {
      extractor: "typescript-regex-mvp",
      pattern: block.kind
    },
    _analysis: {
      text: block.text,
      start_line: line
    }
  };
}

export async function scanTypeScript(project) {
  const tools = [];
  const unsupported = [];
  const files = project.files.filter((file) => TS_EXTENSIONS.test(file));

  for (const filePath of files) {
    const sourceFile = await readSourceFile(filePath);
    const blocks = collectCallBlocks(sourceFile.text);
    for (const block of blocks) {
      const tool = parseToolBlock(project, filePath, sourceFile, block);
      if (tool) {
        tools.push(tool);
      } else {
        unsupported.push({
          file: project.relativePath(filePath),
          line: lineForOffset(sourceFile.lineStarts, block.start),
          reason: "Unable to parse TypeScript tool name"
        });
      }
    }
  }

  return { tools, unsupported };
}
