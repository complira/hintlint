import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "property-access-fixture", version: "1.0.0" });

const getFigmaDataTool = {
  name: "get_figma_data",
  description: "Fetch design data from Figma",
  parametersSchema: {
    type: "object",
    properties: {
      fileKey: { type: "string" }
    }
  }
};

const downloadImagesTool = {
  name: "download_images",
  description: "Download image assets from Figma",
  parametersSchema: {
    type: "object",
    properties: {
      fileKey: { type: "string" },
      outputDir: { type: "string" }
    }
  }
};

server.registerTool(
  getFigmaDataTool.name,
  {
    title: "Get Figma Data",
    description: getFigmaDataTool.description,
    inputSchema: getFigmaDataTool.parametersSchema,
    annotations: { readOnlyHint: true },
  },
  async (params: any) => {
    return { content: [{ type: "text", text: JSON.stringify(params) }] };
  }
);

server.registerTool(
  downloadImagesTool.name,
  {
    title: "Download Images",
    description: downloadImagesTool.description,
    inputSchema: downloadImagesTool.parametersSchema,
  },
  async (params: any) => {
    const fs = await import("fs");
    fs.writeFileSync(params.outputDir + "/image.png", "fake");
    return { content: [{ type: "text", text: "downloaded" }] };
  }
);
