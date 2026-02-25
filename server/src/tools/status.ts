import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker, NAME_LABEL } from "../docker.ts";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export async function getAppStatus(name: string) {
  const containerName = `mcp-deploy-${name}`;
  const container = docker.getContainer(containerName);
  const info = await container.inspect();

  const result: Record<string, unknown> = {
    name: info.Config.Labels?.[NAME_LABEL] || name,
    container: containerName,
    image: info.Config.Image,
    status: info.State.Status,
    running: info.State.Running,
    created: info.Created,
    started: info.State.StartedAt,
    restartCount: info.RestartCount,
    url: `https://${name}.${config.domain}`,
  };

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

      result.memory = `${memMB} MB (${memPercent}%)`;
      result.cpu = `${cpuPercent}%`;
    } catch {
      result.memory = "unavailable";
      result.cpu = "unavailable";
    }
  }

  return result;
}

export function registerStatusTool(server: McpServer) {
  server.registerTool(
    "status",
    {
      description: "Get detailed status of a deployed application including resource usage.",
      inputSchema: z.object({ name: appName }),
    },
    async ({ name }) => {
      const status = await getAppStatus(name);
      const lines = Object.entries(status).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`);
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
