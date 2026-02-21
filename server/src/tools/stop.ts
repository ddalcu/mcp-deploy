import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker } from "../docker.ts";
import { appName } from "../validation.ts";

export function registerStopTool(server: McpServer) {
  server.registerTool(
    "stop",
    {
      description: "Stop a running deployed application. The container is preserved and can be started again.",
      inputSchema: z.object({ name: appName }),
    },
    async ({ name }) => {
      const container = docker.getContainer(`mcp-deploy-${name}`);
      await container.stop();
      return {
        content: [{ type: "text" as const, text: `Stopped ${name}.` }],
      };
    }
  );
}
