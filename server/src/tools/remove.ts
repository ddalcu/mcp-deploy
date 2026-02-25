import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker } from "../docker.ts";
import { appName } from "../validation.ts";

export async function removeApp(name: string, removeVolumes = false) {
  const containerName = `mcp-deploy-${name}`;
  const container = docker.getContainer(containerName);

  try {
    await container.stop();
  } catch {
    // Already stopped
  }

  await container.remove({ v: removeVolumes });

  return { message: `Removed ${name}.${removeVolumes ? " Volumes also removed." : ""}` };
}

export function registerRemoveTool(server: McpServer) {
  server.registerTool(
    "remove",
    {
      description: "Stop and permanently remove a deployed application and its container.",
      inputSchema: z.object({
        name: appName,
        remove_volumes: z.boolean().optional().default(false).describe("Also remove associated volumes"),
      }),
    },
    async ({ name, remove_volumes }) => {
      const result = await removeApp(name, remove_volumes);
      return {
        content: [{ type: "text" as const, text: result.message }],
      };
    }
  );
}
