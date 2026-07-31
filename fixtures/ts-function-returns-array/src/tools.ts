export function createToolDefinitions() {
  return [
    {
      name: "start_session",
      description: "Start a new automation session",
      inputSchema: {
        type: "object",
        properties: {
          browser: { type: "string", description: "Browser type" }
        }
      }
    },
    {
      name: "navigate_to",
      description: "Navigate to a URL in the browser",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to" }
        },
        required: ["url"]
      }
    },
    {
      name: "take_screenshot",
      description: "Capture a screenshot of the current page",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Output file path" }
        }
      }
    }
  ];
}
