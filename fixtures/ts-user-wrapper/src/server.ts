import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "user-wrapper-fixture", version: "1.0.0" });

const tool = (
  name: string,
  title: string,
  description: string,
  paramsSchema: any,
  annotations: any,
  cb: (args: any) => Promise<string>
) => {
  server.registerTool(name, {
    title,
    description,
    inputSchema: paramsSchema,
    annotations,
  }, async (args: any) => {
    const response = await cb(args);
    return { content: [{ type: "text", text: response }] };
  });
};

tool("get_devices", "Get Devices", "List all available devices",
  { type: "object", properties: {} },
  { readOnlyHint: true },
  async (args) => {
    return JSON.stringify([]);
  }
);

tool("reboot_device", "Reboot Device", "Restart a device by ID",
  { type: "object", properties: { deviceId: { type: "string" } } },
  { destructiveHint: true },
  async (args) => {
    return `Rebooted ${args.deviceId}`;
  }
);
