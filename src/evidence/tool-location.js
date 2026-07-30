import { basename, isAbsolute, relative } from "node:path";

export function normalizeFilePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

export function toolRange(tool) {
  const start = tool._analysis?.start_line ?? tool.handler?.line ?? tool.source?.line;
  const end = tool._analysis?.end_line ?? start;
  return { start, end };
}

export function resolvedToolForLocation(tools, file, line) {
  const normalizedFile = normalizeFilePath(file);
  return tools.find((tool) => {
    if (tool.handler?.confidence !== "resolved") {
      return false;
    }
    const handlerFile = normalizeFilePath(tool.handler.file);
    if (handlerFile !== normalizedFile) {
      return false;
    }
    const range = toolRange(tool);
    return line >= range.start && line <= range.end;
  }) ?? null;
}

export function relativeEvidencePath(project, filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!isAbsolute(filePath)) {
    const rootName = basename(project.root);
    const rootIndex = normalized.indexOf(`${rootName}/`);
    if (rootIndex !== -1) {
      return normalized.slice(rootIndex + rootName.length + 1);
    }
    return normalized.replace(/^\.\//, "");
  }
  return normalizeFilePath(relative(project.root, filePath));
}
