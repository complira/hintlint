import { dirname, join, resolve } from "node:path";
import { findMatchingBrace, readSourceFile } from "../extractors/common.js";
import { normalizeFilePath } from "./tool-location.js";

const TS_JS_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
const SKIP_CALLS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Error",
  "JSON",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Set",
  "String",
  "console",
  "fetch",
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "function",
  "return"
]);

function lineForOffset(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function stripCommentsAndStrings(text) {
  let result = "";
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        result += "\n";
      } else {
        result += " ";
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        result += "  ";
        index += 1;
      } else {
        result += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      result += char === "\n" ? "\n" : " ";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      result += "  ";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      result += "  ";
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      result += " ";
      continue;
    }
    result += char;
  }
  return result;
}

function functionRange(source, matchIndex, openIndex) {
  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex === -1) {
    return null;
  }
  return {
    text: source.slice(matchIndex, closeIndex + 1),
    start_line: lineForOffset(source, matchIndex),
    end_line: lineForOffset(source, closeIndex)
  };
}

function collectFunctionDeclarations(source, file) {
  const functions = [];
  for (const match of source.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)) {
    const openIndex = source.indexOf("{", match.index);
    const range = functionRange(source, match.index, openIndex);
    if (!range) {
      continue;
    }
    functions.push({
      name: match[1],
      file,
      ...range
    });
  }
  return functions;
}

function collectConstFunctions(source, file) {
  const functions = [];
  const patterns = [
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=>\s*\{/g,
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const openIndex = source.indexOf("{", match.index);
      const range = functionRange(source, match.index, openIndex);
      if (!range) {
        continue;
      }
      functions.push({
        name: match[1],
        file,
        ...range
      });
    }
  }
  return functions;
}

function resolveLocalImport(project, currentFilePath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const absoluteBase = resolve(dirname(currentFilePath), specifier);
  const candidates = [
    absoluteBase,
    ...RESOLVE_EXTENSIONS.map((extension) => `${absoluteBase}${extension}`),
    ...RESOLVE_EXTENSIONS.map((extension) => join(absoluteBase, `index${extension}`))
  ].map((candidate) => normalizeFilePath(candidate));

  const projectFiles = new Map(project.files.map((filePath) => [normalizeFilePath(filePath), filePath]));
  for (const candidate of candidates) {
    const resolvedFile = projectFiles.get(candidate);
    if (resolvedFile) {
      return project.relativePath(resolvedFile);
    }
  }
  return null;
}

function collectImports(project, filePath, source) {
  const imports = {
    named: new Map(),
    namespace: new Map()
  };
  for (const match of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
    const targetFile = resolveLocalImport(project, filePath, match[2]);
    if (!targetFile) {
      continue;
    }
    for (const imported of match[1].split(",")) {
      const parts = imported.trim().split(/\s+as\s+/);
      const importedName = parts[0]?.trim();
      const localName = (parts[1] ?? parts[0])?.trim();
      if (importedName && localName) {
        imports.named.set(localName, {
          file: targetFile,
          name: importedName
        });
      }
    }
  }
  for (const match of source.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g)) {
    const targetFile = resolveLocalImport(project, filePath, match[2]);
    if (targetFile) {
      imports.namespace.set(match[1], targetFile);
    }
  }
  return imports;
}

function functionKey(file, name) {
  return `${normalizeFilePath(file)}:${name}`;
}

async function buildGraph(project) {
  const functions = [];
  const importsByFile = new Map();

  for (const filePath of project.files.filter((file) => TS_JS_EXTENSIONS.test(file))) {
    const sourceFile = await readSourceFile(filePath);
    const file = project.relativePath(filePath);
    functions.push(...collectFunctionDeclarations(sourceFile.text, file));
    functions.push(...collectConstFunctions(sourceFile.text, file));
    importsByFile.set(file, collectImports(project, filePath, sourceFile.text));
  }

  const byKey = new Map();
  for (const fn of functions) {
    if (!byKey.has(functionKey(fn.file, fn.name))) {
      byKey.set(functionKey(fn.file, fn.name), fn);
    }
  }

  return { byKey, importsByFile };
}

function callsInText(text) {
  const stripped = stripCommentsAndStrings(text);
  const calls = [];
  for (const match of stripped.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!SKIP_CALLS.has(match[1]) && !SKIP_CALLS.has(match[2])) {
      calls.push({
        qualifier: match[1],
        name: match[2]
      });
    }
  }
  for (const match of stripped.matchAll(/(?<!\.)\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!SKIP_CALLS.has(match[1])) {
      calls.push({
        qualifier: null,
        name: match[1]
      });
    }
  }
  return calls;
}

function resolveCall(graph, originFile, call) {
  const imports = graph.importsByFile.get(originFile);
  if (call.qualifier) {
    const namespaceFile = imports?.namespace.get(call.qualifier);
    return namespaceFile ? graph.byKey.get(functionKey(namespaceFile, call.name)) ?? null : null;
  }

  const namedImport = imports?.named.get(call.name);
  if (namedImport) {
    return graph.byKey.get(functionKey(namedImport.file, namedImport.name)) ?? null;
  }

  return graph.byKey.get(functionKey(originFile, call.name)) ?? null;
}

function reachableFunctionsForTool(graph, tool, maxDepth = 4) {
  const reachable = new Map();
  const queue = [];
  const originFile = tool.handler?.file;
  if (!originFile || !tool._analysis?.text) {
    return reachable;
  }

  for (const call of callsInText(tool._analysis.text)) {
    const fn = resolveCall(graph, originFile, call);
    if (fn) {
      queue.push({
        fn,
        depth: 1,
        path: [tool.name, fn.name]
      });
    }
  }

  const visited = new Set();
  while (queue.length > 0) {
    const item = queue.shift();
    const key = functionKey(item.fn.file, item.fn.name);
    if (visited.has(key) || item.depth > maxDepth) {
      continue;
    }
    visited.add(key);
    reachable.set(key, {
      fn: item.fn,
      path: item.path,
      depth: item.depth
    });
    for (const call of callsInText(item.fn.text)) {
      const next = resolveCall(graph, item.fn.file, call);
      if (!next) {
        continue;
      }
      queue.push({
        fn: next,
        depth: item.depth + 1,
        path: [...item.path, next.name]
      });
    }
  }
  return reachable;
}

function lineInFunction(evidence, fn) {
  return normalizeFilePath(evidence.file) === normalizeFilePath(fn.file) &&
    evidence.line >= fn.start_line &&
    evidence.line <= fn.end_line;
}

export function projectEvidenceKey(evidence) {
  return [
    normalizeFilePath(evidence.file),
    evidence.line,
    evidence.rule_id,
    evidence.engine ?? evidence.source ?? "unknown"
  ].join(":");
}

function promoteEvidence(tool, evidence, reachability) {
  return {
    ...evidence,
    tool: tool.name,
    scope: "tool",
    confidence: "source-backed",
    evidence_tier: "L3",
    reachability: {
      kind: "typescript-local-callgraph",
      path: reachability.path,
      depth: reachability.depth
    }
  };
}

export async function reachableEvidenceByTool(project, tools, projectEvidence) {
  const graph = await buildGraph(project);
  const byTool = new Map();
  const promotedProjectEvidenceKeys = new Set();

  for (const tool of tools) {
    if (tool.handler?.confidence !== "resolved" || !["typescript", "javascript"].includes(tool.language)) {
      continue;
    }
    const reachableFunctions = reachableFunctionsForTool(graph, tool);
    const promoted = [];
    for (const reachability of reachableFunctions.values()) {
      for (const evidence of projectEvidence) {
        if (!lineInFunction(evidence, reachability.fn)) {
          continue;
        }
        promoted.push(promoteEvidence(tool, evidence, reachability));
        promotedProjectEvidenceKeys.add(projectEvidenceKey(evidence));
      }
    }
    if (promoted.length > 0) {
      byTool.set(tool.name, promoted);
    }
  }

  return { byTool, promotedProjectEvidenceKeys };
}
