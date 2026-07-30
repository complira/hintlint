import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "ts-basic", version: "0.0.0" });

server.tool(
  "list_customers",
  "List customers without mutating state.",
  {
    query: z.string().optional()
  },
  {
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  },
  async ({ query }) => {
    return { content: [{ type: "text", text: `customers:${query ?? ""}` }] };
  }
);

server.tool(
  "delete_customer",
  "Delete a customer record.",
  {
    customerId: z.string()
  },
  {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false
    }
  },
  async ({ customerId }) => {
    await db.customer.delete({ where: { id: customerId } });
    return { content: [{ type: "text", text: "deleted" }] };
  }
);

server.tool(
  "create_customer",
  "Create a customer record.",
  {
    name: z.string(),
    email: z.string()
  },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false
    }
  },
  async ({ name, email }) => {
    await db.customer.create({ data: { name, email } });
    return { content: [{ type: "text", text: "created" }] };
  }
);

server.registerTool(
  "send_invoice_email",
  {
    description: "Send an invoice email.",
    inputSchema: {
      recipient: z.string(),
      invoiceId: z.string()
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false
    }
  },
  async ({ recipient, invoiceId }) => {
    await sendgrid.send({ to: recipient, subject: invoiceId });
    return { content: [{ type: "text", text: "sent" }] };
  }
);

const dynamicToolName = process.env.DYNAMIC_TOOL_NAME ?? "dynamic_tool";

server.tool(
  dynamicToolName,
  "Dynamically registered tool that should not be treated as source-backed proof.",
  {
    value: z.string()
  },
  async ({ value }) => {
    return { content: [{ type: "text", text: value }] };
  }
);
