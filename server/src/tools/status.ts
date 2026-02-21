import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker, NAME_LABEL } from "../docker.ts";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export function registerStatusTool(server: McpServer) {
  server.registerTool(
    "status",
    {
      description: "Get detailed status of a deployed application including resource usage.",
      inputSchema: z.object({ name: appName }),
    },
    async ({ name }) => {
      const containerName = `mcp-deploy-${name}`;
      const container = docker.getContainer(containerName);
      const info = await container.inspect();

      const lines = [
        `Name: ${info.Config.Labels?.[NAME_LABEL] || name}`,
        `Container: ${containerName}`,
        `Image: ${info.Config.Image}`,
        `Status: ${info.State.Status}`,
        `Running: ${info.State.Running}`,
        `Created: ${info.Created}`,
        `Started: ${info.State.StartedAt}`,
        `Restart Count: ${info.RestartCount}`,
        `URL: https://${name}.${config.domain}`,
      ];

      if (info.State.Running) {
        try {
          const stats = await container.stats({ stream: false });
          const memUsage = stats.memory_stats.usage || 0;
          const memLimit = stats.memory_stats.limit || 1;
          const memPercent = ((memUsage / memLimit) * 100).toFixed(1);
          const memMB = (memUsage / 1024 / 1024).toFixed(1);

          const cpuDelta = (stats.cpu_stats.cpu_usage.total_usage || 0) - (stats.precpu_stats.cpu_usage.total_usage || 0);
          const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
          const cpuCount = stats.cpu_stats.online_cpus || 1;
          const cpuPercent = systemDelta > 0 ? ((cpuDelta / systemDelta) * cpuCount * 100).toFixed(1) : "0.0";

          lines.push(`Memory: ${memMB} MB (${memPercent}%)`);
          lines.push(`CPU: ${cpuPercent}%`);
        } catch {
          lines.push("Memory: unavailable");
          lines.push("CPU: unavailable");
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
