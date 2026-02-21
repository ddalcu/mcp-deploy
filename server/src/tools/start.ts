import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker } from "../docker.ts";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export function registerStartTool(server: McpServer) {
  server.registerTool(
    "start",
    {
      description: "Start a previously stopped application.",
      inputSchema: z.object({ name: appName }),
    },
    async ({ name }) => {
      const container = docker.getContainer(`mcp-deploy-${name}`);
      await container.start();
      const url = `https://${name}.${config.domain}`;
      return {
        content: [{ type: "text" as const, text: `Started ${name}.\nURL: ${url}` }],
      };
    }
  );
}
