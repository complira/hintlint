import {
  readSourceFile,
  findMatchingBrace,
  findMatchingParen,
  lineForOffset,
  parseBooleanAnnotations,
  splitTopLevelArguments
} from "./common.js";

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

function parseStringLiteral(expression) {
  const match = expression.trim().match(/^["']([^"']+)["']$/);
  return match ? match[1] : null;
}

function parsePropertyString(objectText, propertyName) {
  const match = objectText.match(new RegExp(`${propertyName}\\s*:\\s*["']([^"']+)["']`));
  return match ? match[1] : null;
}

function parseDescription(args, kind) {
  if (kind === "tool") {
    return parseStringLiteral(args[1] ?? "") ?? "";
  }
  return parsePropertyString(args[1] ?? "", "description") ?? "";
}

function compactExpression(expression) {
  return expression.replace(/\s+/g, " ").trim().slice(0, 120);
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

function parseInputSchema(callText, args, kind) {
  const parameterNames = parseParameterNames(callText);
  let schemaSource = null;

  if (kind === "tool") {
    schemaSource = args[2]?.trim() || null;
  } else {
    const optionsText = args[1] ?? "";
    const inputSchemaMatch = optionsText.match(/inputSchema\s*:\s*\{/);
    if (inputSchemaMatch) {
      const openIndex = optionsText.indexOf("{", inputSchemaMatch.index);
      const closeIndex = findMatchingBrace(optionsText, openIndex);
      if (closeIndex !== -1) {
        schemaSource = optionsText.slice(openIndex, closeIndex + 1).trim();
      }
    }
  }

  return {
    parameter_names: parameterNames,
    schema_format: schemaSource ? "typescript-expression" : "unknown",
    schema_source: schemaSource
  };
}

function parseToolBlock(project, filePath, sourceFile, block) {
  const args = splitTopLevelArguments(block.text);
  const name = parseStringLiteral(args[0] ?? "");
  const dynamicNameExpression = name ? null : compactExpression(args[0] ?? "unknown");

  const line = lineForOffset(sourceFile.lineStarts, block.start);
  const handlerConfidence = name ? "resolved" : "unknown_handler";
  const toolName = name ?? `<dynamic:${dynamicNameExpression}>`;

  return {
    name: toolName,
    description: parseDescription(args, block.kind),
    language: "typescript",
    source: {
      file: project.relativePath(filePath),
      line
    },
    input_schema: parseInputSchema(block.text, args, block.kind),
    declared_annotations: parseBooleanAnnotations(block.text),
    handler: {
      file: project.relativePath(filePath),
      line,
      symbol: null,
      confidence: block.text.includes("async") || block.text.includes("=>") || block.text.includes("function")
        ? handlerConfidence
        : "unknown_handler"
    },
    extraction: {
      extractor: "typescript-regex-mvp",
      pattern: block.kind,
      name_expression: dynamicNameExpression,
      dynamic_name: Boolean(dynamicNameExpression)
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
      tools.push(tool);
      if (tool.handler.confidence === "unknown_handler") {
        unsupported.push({
          file: project.relativePath(filePath),
          line: lineForOffset(sourceFile.lineStarts, block.start),
          reason: "Dynamic TypeScript tool name; handler evidence is not treated as source-backed"
        });
      }
    }
  }

  return { tools, unsupported };
}
