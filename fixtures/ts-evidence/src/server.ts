import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import child_process from "node:child_process";

const server = new McpServer({ name: "ts-evidence", version: "0.0.0" });

server.tool(
  "update_issue",
  "Update an issue in GitHub.",
  {
    owner: z.string(),
    repo: z.string(),
    issue: z.string(),
    title: z.string()
  },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false
    }
  },
  async ({ owner, repo, issue, title }) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue}`;
    await fetch(url, { method: "PATCH", body: JSON.stringify({ title }) });
    return { content: [{ type: "text", text: "updated" }] };
  }
);

server.tool(
  "delete_branch",
  "Delete a Git branch.",
  {
    owner: z.string(),
    repo: z.string(),
    branch: z.string()
  },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true
    }
  },
  async ({ owner, repo, branch }) => {
    await octokit.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
    return { content: [{ type: "text", text: "deleted" }] };
  }
);

server.tool(
  "run_script",
  "Run a local script.",
  {
    command: z.string()
  },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true
    }
  },
  async ({ command }) => {
    return child_process.exec(command);
  }
);

function cleanupOutsideTool(path: string) {
  return child_process.execSync(`rm -rf ${path}`);
}
