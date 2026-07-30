import { readSourceFile, parseBooleanAnnotations } from "./common.js";

function startsToolDecorator(line) {
  return /@(?:\w+\.)?tool\s*\(/.test(line);
}

function collectDecorator(lines, startIndex) {
  const collected = [];
  let depth = 0;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    collected.push(line);
    for (const char of line) {
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }
    }
    if (depth <= 0) {
      return {
        text: collected.join("\n"),
        endIndex: index
      };
    }
  }
  return {
    text: collected.join("\n"),
    endIndex: startIndex
  };
}

function parseKeywordString(args, keyword) {
  const match = args.match(new RegExp(`${keyword}\\s*=\\s*["']([^"']+)["']`));
  return match ? match[1] : null;
}

function parseParameterNames(defLine) {
  const match = defLine.match(/def\s+\w+\s*\(([^)]*)\)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((param) => param.trim().split(/[=:]/)[0].trim())
    .filter((param) => param && param !== "self" && param !== "cls")
    .sort();
}

function parseInputSchema(defLine) {
  return {
    parameter_names: parseParameterNames(defLine),
    schema_format: "python-signature",
    schema_source: defLine.trim()
  };
}

function parseFunctionName(defLine) {
  const match = defLine.match(/def\s+(\w+)\s*\(/);
  return match ? match[1] : null;
}

function collectFunctionText(lines, defIndex) {
  const collected = [lines[defIndex]];
  for (let index = defIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*@(?:\w+\.)?tool\s*\(/.test(line) || /^\s*(async\s+)?def\s+\w+\s*\(/.test(line)) {
      break;
    }
    collected.push(line);
  }
  return collected.join("\n");
}

export async function scanPython(project) {
  const tools = [];
  const unsupported = [];
  const files = project.files.filter((file) => file.endsWith(".py"));

  for (const filePath of files) {
    const sourceFile = await readSourceFile(filePath);
    const lines = sourceFile.text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (!startsToolDecorator(lines[index])) {
        continue;
      }
      const decorator = collectDecorator(lines, index);
      const args = decorator.text;

      const defIndex = lines.findIndex((line, maybeDefIndex) =>
        maybeDefIndex > decorator.endIndex &&
        maybeDefIndex <= decorator.endIndex + 5 &&
        /^\s*(async\s+)?def\s+\w+\s*\(/.test(line)
      );

      if (defIndex === -1) {
        unsupported.push({
          file: project.relativePath(filePath),
          line: index + 1,
          reason: "Unable to find Python function after @tool decorator"
        });
        continue;
      }

      const defLine = lines[defIndex];
      const functionName = parseFunctionName(defLine);
      const name = parseKeywordString(args, "name") ?? functionName;
      const description = parseKeywordString(args, "description") ?? "";

      tools.push({
        name,
        description,
        language: "python",
        source: {
          file: project.relativePath(filePath),
          line: index + 1
        },
        input_schema: {
          ...parseInputSchema(defLine)
        },
        declared_annotations: parseBooleanAnnotations(decorator.text),
        handler: {
          file: project.relativePath(filePath),
          line: defIndex + 1,
          symbol: functionName,
          confidence: "resolved"
        },
        extraction: {
          extractor: "python-decorator-mvp",
          pattern: "@tool"
        },
        _analysis: {
          text: `${decorator.text}\n${collectFunctionText(lines, defIndex)}`,
          start_line: index + 1
        }
      });
    }
  }

  return { tools, unsupported };
}
