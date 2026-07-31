import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "list-tools-handler-fixture", version: "1.0.0" });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const allTools = [
    {
      name: "get_config",
      description: "Get the current server configuration",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Config key to retrieve" }
        }
      }
    },
    {
      name: "execute_command",
      description: "Execute a shell command on the server",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to run" }
        },
        required: ["command"]
      }
    },
    {
      name: "write_file",
      description: "Write content to a file",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: ["path", "content"]
      }
    }
  ];

  return { tools: allTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_config":
      return { content: [{ type: "text", text: "{}" }] };
    case "execute_command":
      const { exec } = await import("child_process");
      return { content: [{ type: "text", text: "executed" }] };
    case "write_file":
      const fs = await import("fs");
      return { content: [{ type: "text", text: "written" }] };
    default:
      throw new Error("Unknown tool");
  }
});
