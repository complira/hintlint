import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

const IGNORED_DIRS = new Set([
  ".git",
  ".codex",
  ".claude",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  "dist",
  "build",
  "coverage"
]);

const LANGUAGE_BY_EXTENSION = new Map([
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".js", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".py", "python"]
]);

const TOOLS_LIST_FILES = new Set([
  "tools-list.json",
  "tools.json",
  "mcp-tools.json"
]);

function extensionOf(filePath) {
  const match = filePath.match(/(\.[^.]+)$/);
  return match ? match[1] : "";
}

async function walk(root, dir = root, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walk(root, join(dir, entry.name), files);
      }
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const filePath = join(dir, entry.name);
    const extension = extensionOf(filePath);
    if (
      LANGUAGE_BY_EXTENSION.has(extension) ||
      entry.name === "package.json" ||
      entry.name === "pyproject.toml" ||
      TOOLS_LIST_FILES.has(entry.name)
    ) {
      files.push(filePath);
    }
  }
  return files;
}

export async function discoverProject(root) {
  const rootStat = await stat(root);
  const files = rootStat.isDirectory() ? await walk(root) : [root];
  const baseDir = rootStat.isDirectory() ? root : dirname(root);
  const languages = [...new Set(
    files
      .map((file) => LANGUAGE_BY_EXTENSION.get(extensionOf(file)))
      .filter(Boolean)
  )].sort();

  return {
    root,
    languages,
    files,
    relativePath(filePath) {
      return relative(baseDir, filePath) || basename(filePath);
    }
  };
}
