import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const CONFIG_FILES = [
  "hintlint.json",
  "hintlint.config.json",
  "hintlint.yaml",
  "hintlint.yml"
];

export const DEFAULT_OPTIONS = {
  format: "text",
  output: null,
  ci: false,
  failOn: "high"
};

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function configSearchDir(targetPath) {
  const target = resolve(targetPath);
  const targetStat = await stat(target);
  return targetStat.isDirectory() ? target : dirname(target);
}

function normalizeKey(key) {
  if (key === "fail_on") {
    return "failOn";
  }
  return key;
}

function normalizeValue(rawValue) {
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  return value;
}

function parseFlatYaml(text) {
  const result = {};
  for (const line of text.split("\n")) {
    const withoutComment = line.replace(/\s+#.*$/, "").trim();
    if (!withoutComment) {
      continue;
    }
    const match = withoutComment.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/);
    if (!match) {
      throw new Error("Only flat key/value hintlint YAML config is supported in the MVP");
    }
    result[normalizeKey(match[1])] = normalizeValue(match[2]);
  }
  return result;
}

function parseConfig(filePath, text) {
  if (filePath.endsWith(".json")) {
    return JSON.parse(text);
  }
  return parseFlatYaml(text);
}

export async function loadConfig(targetPath, explicitPath = null) {
  if (explicitPath) {
    const filePath = resolve(explicitPath);
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      config: parseConfig(filePath, text)
    };
  }

  const searchDir = await configSearchDir(targetPath);
  for (const fileName of CONFIG_FILES) {
    const filePath = join(searchDir, fileName);
    if (await exists(filePath)) {
      const text = await readFile(filePath, "utf8");
      return {
        path: filePath,
        config: parseConfig(filePath, text)
      };
    }
  }

  return {
    path: null,
    config: {}
  };
}

export function applyConfig(args, loadedConfig) {
  const options = { ...DEFAULT_OPTIONS, ...loadedConfig };
  for (const key of args._explicit) {
    options[key] = args[key];
  }
  return {
    ...args,
    ...options
  };
}
