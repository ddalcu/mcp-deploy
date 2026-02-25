import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getManagedContainers, NAME_LABEL } from "../docker.ts";
import { config } from "../config.ts";

export async function listApps(status?: string) {
  const dockerStatus = !status || status === "all" ? undefined : status === "stopped" ? "exited" : status;
  const containers = await getManagedContainers(dockerStatus);

  return containers.map((c) => ({
    name: c.Labels[NAME_LABEL] || "unknown",
    state: c.State,
    image: c.Image,
    url: `https://${c.Labels[NAME_LABEL] || "unknown"}.${config.domain}`,
  }));
}

export function registerListTool(server: McpServer) {
  server.registerTool(
    "list",
    {
      description: "List all deployed applications managed by mcp-deploy.",
      inputSchema: z.object({
        status: z
          .enum(["running", "stopped", "all"])
          .optional()
          .default("all")
          .describe("Filter by container status"),
      }),
    },
    async ({ status }) => {
      const apps = await listApps(status);

      if (apps.length === 0) {
        return { content: [{ type: "text" as const, text: "No deployments found." }] };
      }

      const header = "Name | Status | Image | URL";
      const separator = "--- | --- | --- | ---";
      const lines = apps.map((a) => `${a.name} | ${a.state} | ${a.image} | ${a.url}`);
      return {
        content: [{ type: "text" as const, text: [header, separator, ...lines].join("\n") }],
      };
    }
  );
}
