import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getManagedContainers, NAME_LABEL } from "../docker.ts";
import { config } from "../config.ts";

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
      const containers = await getManagedContainers(status === "all" ? undefined : status === "stopped" ? "exited" : status);

      if (containers.length === 0) {
        return { content: [{ type: "text" as const, text: "No deployments found." }] };
      }

      const lines = containers.map((c) => {
        const name = c.Labels[NAME_LABEL] || "unknown";
        const state = c.State;
        const image = c.Image;
        const url = `https://${name}.${config.domain}`;
        return `${name} | ${state} | ${image} | ${url}`;
      });

      const header = "Name | Status | Image | URL";
      const separator = "--- | --- | --- | ---";
      return {
        content: [{ type: "text" as const, text: [header, separator, ...lines].join("\n") }],
      };
    }
  );
}
