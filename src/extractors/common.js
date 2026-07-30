import { readFile } from "node:fs/promises";

export async function readSourceFile(filePath) {
  const text = await readFile(filePath, "utf8");
  const lineStarts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }
  return { text, lineStarts };
}

export function lineForOffset(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return high + 1;
}

export function parseBooleanAnnotations(source) {
  const annotations = {};
  for (const key of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
    const jsMatch = source.match(new RegExp(`${key}\\s*:\\s*(true|false)`));
    const pyMatch = source.match(new RegExp(`["']${key}["']\\s*:\\s*(True|False|true|false)`));
    const match = jsMatch ?? pyMatch;
    if (match) {
      annotations[key] = ["true", "True"].includes(match[1]);
    }
  }
  return annotations;
}

export function parseFirstString(source) {
  const match = source.match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}

export function countLine(source, index) {
  return source.slice(0, index).split("\n").length;
}

export function findMatchingParen(source, openIndex) {
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
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}
