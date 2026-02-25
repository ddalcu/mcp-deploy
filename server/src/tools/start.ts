import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker } from "../docker.ts";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export async function startApp(name: string) {
  const container = docker.getContainer(`mcp-deploy-${name}`);
  await container.start();
  const url = `https://${name}.${config.domain}`;
  return { message: `Started ${name}.`, url };
}

export function registerStartTool(server: McpServer) {
  server.registerTool(
    "start",
    {
      description: "Start a previously stopped application.",
      inputSchema: z.object({ name: appName }),
    },
    async ({ name }) => {
      const result = await startApp(name);
      return {
        content: [{ type: "text" as const, text: `${result.message}\nURL: ${result.url}` }],
      };
    }
  );
}
