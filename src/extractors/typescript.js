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
  ".registerTool(",
  ".addTool("
];
const TOOL_FACTORY_NAMES = [
  "defineTool",
  "definePageTool",
  "createTool",
  "makeTool",
  "tool"
];
const HANDLER_FIELDS = ["handler", "execute", "run", "callback"];
const OBJECT_STYLE_KINDS = new Set([
  "defineTool",
  "definePageTool",
  "createTool",
  "makeTool",
  "toolFactory",
  "staticRegistry",
  "addToolsInline",
  "listToolsHandler",
  "toolFunctionReturn"
]);

function languageForFile(filePath) {
  return /\.(js|mjs|cjs)$/.test(filePath) ? "javascript" : "typescript";
}

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
        kind: pattern === ".registerTool("
          ? "registerTool"
          : pattern === ".addTool("
            ? "addTool"
            : "tool"
      });
      searchFrom = closeIndex + 1;
    }
  }
  return blocks;
}

function collectFactoryBlocks(source) {
  const blocks = [];
  const factoryPattern = new RegExp(`\\b(${TOOL_FACTORY_NAMES.join("|")})\\s*\\(`, "g");
  for (const match of source.matchAll(factoryPattern)) {
    const factoryName = match[1];
    const callIndex = match.index;
    const before = source.slice(Math.max(0, callIndex - 20), callIndex);
    if (source[callIndex - 1] === ".") {
      continue;
    }
    if (/\bfunction\s+$/.test(before)) {
      continue;
    }
    const openIndex = source.indexOf("(", callIndex);
    const closeIndex = findMatchingParen(source, openIndex);
    if (closeIndex === -1) {
      continue;
    }
    blocks.push({
      start: callIndex,
      end: closeIndex + 1,
      text: source.slice(callIndex, closeIndex + 1),
      kind: factoryName === "tool" ? "toolFactory" : factoryName,
      symbol: parseAssignedSymbol(source, callIndex)
    });
  }
  return blocks;
}

function findMatchingBracket(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") {
      depth += 1;
      continue;
    }
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function splitTopLevelItemsWithOffsets(text, absoluteStart) {
  const items = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      continue;
    }
    if (char === "," && depth === 0) {
      const raw = text.slice(start, index);
      const leading = raw.length - raw.trimStart().length;
      if (raw.trim()) {
        items.push({ text: raw.trim(), start: absoluteStart + start + leading });
      }
      start = index + 1;
    }
  }

  const raw = text.slice(start);
  const leading = raw.length - raw.trimStart().length;
  if (raw.trim()) {
    items.push({ text: raw.trim(), start: absoluteStart + start + leading });
  }
  return items;
}

function startsWithFactoryCall(text) {
  return new RegExp(`^(${TOOL_FACTORY_NAMES.join("|")})\\s*\\(`).test(text.trim());
}

function collectStaticRegistryBlocks(source, eligibleSymbols = new Set()) {
  const blocks = [];
  const registryPattern = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\[/g;
  for (const match of source.matchAll(registryPattern)) {
    const symbol = match[1];
    if (!eligibleSymbols.has(symbol) && !/tools?/i.test(symbol)) {
      continue;
    }
    const openIndex = source.indexOf("[", match.index);
    const closeIndex = findMatchingBracket(source, openIndex);
    if (closeIndex === -1) {
      continue;
    }
    const items = splitTopLevelItemsWithOffsets(source.slice(openIndex + 1, closeIndex), openIndex + 1);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.text.startsWith("{") || startsWithFactoryCall(item.text)) {
        continue;
      }
      blocks.push({
        start: item.start,
        end: item.start + item.text.length,
        text: item.text,
        kind: "staticRegistry",
        symbol: `${symbol}[${index}]`,
        registrySymbol: symbol
      });
    }
  }
  return blocks;
}

function collectAddToolsBlocks(source) {
  const calls = [];
  const blocks = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const callIndex = source.indexOf(".addTools(", searchFrom);
    if (callIndex === -1) {
      break;
    }
    const openIndex = callIndex + ".addTools(".length - 1;
    const closeIndex = findMatchingParen(source, openIndex);
    if (closeIndex === -1) {
      searchFrom = openIndex + 1;
      continue;
    }
    const callText = source.slice(callIndex, closeIndex + 1);
    const args = splitTopLevelArguments(callText);
    calls.push({
      start: callIndex,
      text: callText,
      registryExpression: args[0]?.trim() ?? ""
    });
    if (args[0]?.trim().startsWith("[")) {
      const inlineOpenIndex = source.indexOf("[", callIndex);
      const inlineCloseIndex = findMatchingBracket(source, inlineOpenIndex);
      if (inlineCloseIndex !== -1) {
        const items = splitTopLevelItemsWithOffsets(source.slice(inlineOpenIndex + 1, inlineCloseIndex), inlineOpenIndex + 1);
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (!item.text.startsWith("{") || startsWithFactoryCall(item.text)) {
            continue;
          }
          blocks.push({
            start: item.start,
            end: item.start + item.text.length,
            text: item.text,
            kind: "addToolsInline",
            symbol: `addTools[${index}]`
          });
        }
      }
    }
    searchFrom = closeIndex + 1;
  }
  return { calls, blocks };
}

function collectRegisteredRegistrySymbols(source, addToolsCalls) {
  const symbols = new Set();
  for (const call of addToolsCalls) {
    const symbol = call.registryExpression.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
    if (symbol) {
      symbols.add(symbol);
    }
  }
  for (const match of source.matchAll(/for\s*\(\s*const\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)\s*\)/g)) {
    const variable = match[1];
    const registry = match[2];
    const nearbyBody = source.slice(match.index, match.index + 800);
    if (new RegExp(`\\.tool\\s*\\(\\s*${variable}\\.name`).test(nearbyBody)) {
      symbols.add(registry);
    }
  }
  return symbols;
}

function collectStaticLoopVariables(source, registrySymbols) {
  const variables = new Set();
  for (const match of source.matchAll(/for\s*\(\s*const\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)\s*\)/g)) {
    if (registrySymbols.has(match[2])) {
      variables.add(match[1]);
    }
  }
  return variables;
}

function collectListToolsHandlerBlocks(source) {
  const blocks = [];
  const handlerPattern = /setRequestHandler\s*\(\s*ListTools(?:Request(?:Schema)?)?/g;
  for (const match of source.matchAll(handlerPattern)) {
    const braceIndex = source.indexOf("{", match.index + match[0].length);
    if (braceIndex === -1) continue;
    const closeBrace = findMatchingBrace(source, braceIndex);
    if (closeBrace === -1) continue;
    const body = source.slice(braceIndex, closeBrace + 1);
    const arrayPattern = /(?:const|let|var)\s+\w+\s*=\s*\[/g;
    for (const arrMatch of body.matchAll(arrayPattern)) {
      const absOpenBracket = braceIndex + arrMatch.index + arrMatch[0].length - 1;
      const openBracket = source.indexOf("[", absOpenBracket);
      if (openBracket === -1) continue;
      let bracketDepth = 0;
      let closeBracket = -1;
      let quote = null;
      let escaped = false;
      for (let i = openBracket; i < source.length; i++) {
        const char = source[i];
        if (quote) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === quote) quote = null;
          continue;
        }
        if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
        if (char === "[") bracketDepth++;
        else if (char === "]") { bracketDepth--; if (bracketDepth === 0) { closeBracket = i; break; } }
      }
      if (closeBracket === -1) continue;
      const items = splitTopLevelItemsWithOffsets(source.slice(openBracket + 1, closeBracket), openBracket + 1);
      for (const item of items) {
        if (!item.text.trim().startsWith("{")) continue;
        if (!/name\s*:/.test(item.text)) continue;
        blocks.push({
          start: item.start,
          end: item.start + item.text.length,
          text: item.text,
          kind: "listToolsHandler",
          symbol: null,
          registrySymbol: null
        });
      }
    }
  }
  return blocks;
}

function collectToolFunctionReturnArrays(source) {
  const blocks = [];
  const pattern = /(?:export\s+)?function\s+(\w*[Tt]ool\w*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
  for (const match of source.matchAll(pattern)) {
    const funcName = match[1];
    const openBrace = source.indexOf("{", match.index + match[0].length - 1);
    if (openBrace === -1) continue;
    const closeBrace = findMatchingBrace(source, openBrace);
    if (closeBrace === -1) continue;
    const body = source.slice(openBrace, closeBrace + 1);
    const returnMatch = body.match(/return\s*\[/);
    if (!returnMatch) continue;
    const arrayOpen = openBrace + returnMatch.index + returnMatch[0].length - 1;
    let bracketDepth = 0;
    let arrayClose = -1;
    let quote = null;
    let escaped = false;
    for (let i = arrayOpen; i < source.length; i++) {
      const char = source[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "[") bracketDepth++;
      else if (char === "]") { bracketDepth--; if (bracketDepth === 0) { arrayClose = i; break; } }
    }
    if (arrayClose === -1) continue;
    const items = splitTopLevelItemsWithOffsets(source.slice(arrayOpen + 1, arrayClose), arrayOpen + 1);
    for (let i = 0; i < items.length; i++) {
      if (!items[i].text.trim().startsWith("{")) continue;
      if (!/name\s*:/.test(items[i].text)) continue;
      blocks.push({
        start: items[i].start,
        end: items[i].start + items[i].text.length,
        text: items[i].text,
        kind: "toolFunctionReturn",
        symbol: `${funcName}[${i}]`,
        registrySymbol: funcName
      });
    }
  }
  return blocks;
}

function resolvePropertyAccess(source, expression) {
  const match = expression.match(/^([A-Za-z_$][\w$]*)\.name$/);
  if (!match) return null;
  const objectName = match[1];
  const objMatch = source.match(new RegExp(
    `(?:export\\s+)?const\\s+${objectName}\\s*=\\s*\\{[^}]*name:\\s*["']([^"']+)["']`
  ));
  return objMatch ? objMatch[1] : null;
}

/**
 * Extract case blocks from switch/case tool dispatch patterns.
 * Scans for case "tool_name": blocks that follow a switch on a name-like variable.
 * Returns a map of tool name -> { line, body } for each case block.
 */
function collectDispatchCaseBlocks(source) {
  const cases = new Map();
  // Verify the file has a tool-name switch dispatch pattern
  if (!/switch\s*\(\s*(?:name|request\.params\.name|toolName|args\.name|tool\.name|input\.tool)\s*\)/.test(source)) {
    return cases;
  }
  // Scan for all case "string": patterns — these are tool dispatch entries
  const casePattern = /case\s+["']([^"']+)["']\s*:/g;
  let caseMatch;
  while ((caseMatch = casePattern.exec(source)) !== null) {
    const toolName = caseMatch[1];
    if (cases.has(toolName)) continue;
    const caseStart = caseMatch.index + caseMatch[0].length;
    // Find end: next case "string": or default: at roughly the same indentation
    const remaining = source.slice(caseStart);
    const nextCase = remaining.search(/\bcase\s+["']|default\s*:/);
    const caseEnd = nextCase === -1 ? Math.min(remaining.length, 500) : nextCase;
    const caseBody = remaining.slice(0, caseEnd).trim();
    cases.set(toolName, {
      line: source.slice(0, caseMatch.index).split("\n").length,
      body: caseBody,
      offset: caseMatch.index
    });
  }
  return cases;
}

function isStaticRegistryLoopRegistration(block, loopVariables) {
  if (block.kind !== "tool") {
    return false;
  }
  const args = splitTopLevelArguments(block.text);
  const firstArg = args[0]?.trim() ?? "";
  const match = firstArg.match(/^([A-Za-z_$][\w$]*)\.name$/);
  return Boolean(match && loopVariables.has(match[1]));
}

function parseAssignedSymbol(source, callIndex) {
  const before = source.slice(Math.max(0, callIndex - 240), callIndex);
  const match = before.match(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*$/);
  return match ? match[1] : null;
}

function parseConstStringMap(source) {
  const values = new Map();
  for (const match of source.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*["']([^"']+)["']/g)) {
    values.set(match[1], match[2]);
  }
  return values;
}

function parseStringLiteral(expression) {
  const match = expression.trim().match(/^(["'`])([^"'`$]+)\1$/);
  return match ? match[2] : null;
}

function parsePropertyExpression(objectText, propertyName) {
  const match = objectText.match(new RegExp(`${propertyName}\\s*:\\s*`));
  if (!match) {
    return null;
  }
  const valueStart = match.index + match[0].length;
  const firstChar = objectText[valueStart];
  if (firstChar === "{") {
    const closeIndex = findMatchingBrace(objectText, valueStart);
    return closeIndex === -1 ? null : objectText.slice(valueStart, closeIndex + 1).trim();
  }
  if (firstChar === "(") {
    const closeIndex = findMatchingParen(objectText, valueStart);
    return closeIndex === -1 ? null : objectText.slice(valueStart, closeIndex + 1).trim();
  }
  if (firstChar === "[") {
    const closeIndex = findMatchingBracket(objectText, valueStart);
    return closeIndex === -1 ? null : objectText.slice(valueStart, closeIndex + 1).trim();
  }
  if (firstChar === "\"" || firstChar === "'" || firstChar === "`") {
    let escaped = false;
    for (let index = valueStart + 1; index < objectText.length; index += 1) {
      const char = objectText[index];
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === firstChar) {
        return objectText.slice(valueStart, index + 1).trim();
      }
    }
    return null;
  }
  const rest = objectText.slice(valueStart);
  const endMatch = rest.match(/[,}\n]/);
  const endIndex = endMatch ? endMatch.index : rest.length;
  return rest.slice(0, endIndex).trim();
}

function parsePropertyString(objectText, propertyName, constStrings = new Map()) {
  const expression = parsePropertyExpression(objectText, propertyName);
  if (!expression) {
    return null;
  }
  return parseStringLiteral(expression) ?? constStrings.get(expression) ?? null;
}

function parseDescription(args, kind, callText, constStrings) {
  if (kind === "tool" && !args[0]?.trim().startsWith("{")) {
    return parseStringLiteral(args[1] ?? "") ?? "";
  }
  if (OBJECT_STYLE_KINDS.has(kind) || args[0]?.trim().startsWith("{")) {
    return parsePropertyString(callText, "description", constStrings) ?? "";
  }
  return parsePropertyString(args[1] ?? "", "description", constStrings) ?? "";
}

function compactExpression(expression) {
  return expression.replace(/\s+/g, " ").trim().slice(0, 120);
}

function parseParameterNames(callText) {
  const params = new Set();
  for (const propertyName of ["inputSchema", "schema"]) {
    const schemaBlock = parseObjectPropertyBlock(callText, propertyName);
    if (schemaBlock) {
      for (const name of parseObjectPropertyNames(schemaBlock)) {
        params.add(name);
      }
    }
  }
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

function parseObjectPropertyBlock(text, propertyName) {
  const expression = parsePropertyExpression(text, propertyName);
  if (!expression?.startsWith("{")) {
    return null;
  }
  return expression.slice(1, -1);
}

function parseObjectPropertyNames(objectText) {
  const names = new Set();
  for (const match of objectText.matchAll(/(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*:/gm)) {
    names.add(match[1]);
  }
  return names;
}

function parseInputSchema(callText, args, kind) {
  const parameterNames = parseParameterNames(callText);
  let schemaSource = null;

  if (kind === "tool" && !args[0]?.trim().startsWith("{")) {
    schemaSource = args[2]?.trim() || null;
  } else {
    const optionsText = OBJECT_STYLE_KINDS.has(kind) || args[0]?.trim().startsWith("{")
      ? callText
      : args[1] ?? "";
    const inputSchemaMatch = optionsText.match(/(?:inputSchema|schema)\s*:\s*\{/);
    if (inputSchemaMatch) {
      const openIndex = optionsText.indexOf("{", inputSchemaMatch.index);
      const closeIndex = findMatchingBrace(optionsText, openIndex);
      if (closeIndex !== -1) {
        schemaSource = optionsText.slice(openIndex, closeIndex + 1).trim();
      }
    }
    if (!schemaSource && (OBJECT_STYLE_KINDS.has(kind) || args[0]?.trim().startsWith("{"))) {
      const schemaBlock = parseObjectPropertyBlock(callText, "inputSchema")
        ?? parseObjectPropertyBlock(callText, "schema");
      schemaSource = schemaBlock ? `{${schemaBlock}}` : null;
    }
  }

  return {
    parameter_names: parameterNames,
    schema_format: schemaSource ? "typescript-expression" : "unknown",
    schema_source: schemaSource
  };
}

function parseHandlerSymbol(callText) {
  for (const field of HANDLER_FIELDS) {
    const expression = parsePropertyExpression(callText, field);
    if (!expression) {
      continue;
    }
    const match = expression.match(/^([A-Za-z_$][\w$]*)$/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function hasHandler(callText, args, kind) {
  const firstArg = args[0]?.trim() ?? "";
  const objectStyle = firstArg.startsWith("{") || (OBJECT_STYLE_KINDS.has(kind) && !parseStringLiteral(firstArg));
  if (objectStyle) {
    return HANDLER_FIELDS.some((field) => new RegExp(`${field}\\s*:`).test(callText));
  }
  return callText.includes("async") || callText.includes("=>") || callText.includes("function");
}

function isObjectStyleTool(args, kind) {
  const firstArg = args[0]?.trim() ?? "";
  if (firstArg.startsWith("{")) return true;
  if (parseStringLiteral(firstArg)) return false;
  return OBJECT_STYLE_KINDS.has(kind);
}

function parseToolBlock(project, filePath, sourceFile, block, constStrings = new Map()) {
  const args = splitTopLevelArguments(block.text);
  const objectStyle = isObjectStyleTool(args, block.kind);
  let name = objectStyle
    ? parsePropertyString(block.text, "name", constStrings)
    : parseStringLiteral(args[0] ?? "");
  if (!name && !objectStyle) {
    const firstArg = args[0]?.trim() ?? "";
    const resolved = resolvePropertyAccess(sourceFile.text, firstArg);
    if (resolved) name = resolved;
  }
  const dynamicNameExpression = name
    ? null
    : objectStyle
      ? compactExpression(block.symbol ?? "definition factory")
      : compactExpression(args[0] ?? "unknown");

  const line = lineForOffset(sourceFile.lineStarts, block.start);
  const handlerConfidence = name ? "resolved" : "unknown_handler";
  const toolName = name ?? `<dynamic:${dynamicNameExpression}>`;
  const propertyHandlerSymbol = parseHandlerSymbol(block.text);
  const handlerSymbol = block.kind === "staticRegistry" || block.kind === "addToolsInline"
    ? propertyHandlerSymbol ?? block.symbol
    : block.symbol ?? propertyHandlerSymbol;

  return {
    name: toolName,
    description: parseDescription(args, block.kind, block.text, constStrings),
    language: languageForFile(filePath),
    source: {
      file: project.relativePath(filePath),
      line
    },
    input_schema: parseInputSchema(block.text, args, block.kind),
    declared_annotations: parseBooleanAnnotations(block.text),
    handler: {
      file: project.relativePath(filePath),
      line,
      symbol: handlerSymbol,
      confidence: hasHandler(block.text, args, block.kind)
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
      start_line: line,
      end_line: line + block.text.split("\n").length - 1
    }
  };
}

export async function scanTypeScript(project) {
  const tools = [];
  const unsupported = [];
  const files = project.files.filter((file) => TS_EXTENSIONS.test(file));

  for (const filePath of files) {
    const sourceFile = await readSourceFile(filePath);
    const constStrings = parseConstStringMap(sourceFile.text);
    const addTools = collectAddToolsBlocks(sourceFile.text);
    const registeredRegistrySymbols = collectRegisteredRegistrySymbols(sourceFile.text, addTools.calls);
    const staticRegistryBlocks = collectStaticRegistryBlocks(sourceFile.text, registeredRegistrySymbols);
    const staticRegistrySymbols = new Set(staticRegistryBlocks.map((block) => block.registrySymbol).filter(Boolean));
    const staticLoopVariables = collectStaticLoopVariables(sourceFile.text, staticRegistrySymbols);
    const blocks = [
      ...collectCallBlocks(sourceFile.text),
      ...collectFactoryBlocks(sourceFile.text),
      ...staticRegistryBlocks,
      ...addTools.blocks,
      ...collectListToolsHandlerBlocks(sourceFile.text),
      ...collectToolFunctionReturnArrays(sourceFile.text)
    ]
      .sort((a, b) => a.start - b.start);
    const seen = new Set();
    for (const block of blocks) {
      if (isStaticRegistryLoopRegistration(block, staticLoopVariables)) {
        continue;
      }
      const tool = parseToolBlock(project, filePath, sourceFile, block, constStrings);
      const key = `${tool.source.file}:${tool.source.line}:${tool.name}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      tools.push(tool);
      if (tool.handler.confidence === "unknown_handler") {
        unsupported.push({
          file: project.relativePath(filePath),
          line: lineForOffset(sourceFile.lineStarts, block.start),
          reason: "Dynamic TypeScript tool name; handler evidence is not treated as source-backed"
        });
      }
    }
    // Correlate unresolved tools with switch/case dispatch handlers
    const dispatchCases = collectDispatchCaseBlocks(sourceFile.text);
    if (dispatchCases.size > 0) {
      for (const tool of tools) {
        if (tool.handler.confidence !== "unknown_handler") continue;
        if (tool.source.file !== project.relativePath(filePath)) continue;
        const caseBlock = dispatchCases.get(tool.name);
        if (!caseBlock) continue;
        tool.handler.confidence = "resolved";
        tool.handler.line = caseBlock.line;
        tool.handler.symbol = tool.name;
        const fullText = `case "${tool.name}": ${caseBlock.body}`;
        tool._analysis.text = `${tool._analysis.text}\n${fullText}`;
        tool._analysis.end_line = caseBlock.line + fullText.split("\n").length;
      }
    }

    for (const call of addTools.calls) {
      const registryName = call.registryExpression.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
      if (registryName && staticRegistrySymbols.has(registryName)) {
        continue;
      }
      if (call.registryExpression.startsWith("[")) {
        continue;
      }
      unsupported.push({
        file: project.relativePath(filePath),
        line: lineForOffset(sourceFile.lineStarts, call.start),
        reason: `Unable to resolve TypeScript addTools registry '${compactExpression(call.registryExpression || "unknown")}'`
      });
    }
  }

  // Cross-file dispatch correlation: scan all files for switch/case dispatch
  // and match against tools with unresolved handlers from other files
  const unresolvedTools = tools.filter((t) => t.handler.confidence === "unknown_handler" && !t.extraction?.dynamic_name);
  if (unresolvedTools.length > 0) {
    const unresolvedByName = new Map();
    for (const t of unresolvedTools) {
      unresolvedByName.set(t.name, t);
    }
    for (const filePath of files) {
      const sourceFile = await readSourceFile(filePath);
      const dispatchCases = collectDispatchCaseBlocks(sourceFile.text);
      for (const [toolName, caseBlock] of dispatchCases) {
        const tool = unresolvedByName.get(toolName);
        if (!tool) continue;
        tool.handler.confidence = "resolved";
        tool.handler.file = project.relativePath(filePath);
        tool.handler.line = caseBlock.line;
        tool.handler.symbol = toolName;
        const fullText = `case "${toolName}": ${caseBlock.body}`;
        tool._analysis.text = `${tool._analysis.text}\n${fullText}`;
        tool._analysis.end_line = caseBlock.line + fullText.split("\n").length;
        unresolvedByName.delete(toolName);
      }
      if (unresolvedByName.size === 0) break;
    }
  }

  return { tools, unsupported };
}
