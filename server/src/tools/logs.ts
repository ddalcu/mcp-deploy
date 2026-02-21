import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docker } from "../docker.ts";
import { appName } from "../validation.ts";

function demuxDockerStream(buffer: Buffer): string {
  const lines: string[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + size > buffer.length) break;
    lines.push(buffer.subarray(offset, offset + size).toString("utf-8"));
    offset += size;
  }
  return lines.join("").trimEnd();
}

export function registerLogsTool(server: McpServer) {
  server.registerTool(
    "logs",
    {
      description: "Get recent logs from a deployed application.",
      inputSchema: z.object({
        name: appName,
        tail: z.number().int().min(1).optional().default(100).describe("Number of lines to return"),
        since: z.string().optional().describe("Show logs since (e.g. '1h', '30m', or ISO timestamp)"),
      }),
    },
    async ({ name, tail, since }) => {
      const containerName = `mcp-deploy-${name}`;
      const container = docker.getContainer(containerName);

      const options: Record<string, unknown> = {
        stdout: true,
        stderr: true,
        tail,
        follow: false,
      };

      if (since) {
        const match = since.match(/^(\d+)([hms])$/);
        if (match) {
          const [, value, unit] = match;
          const multipliers: Record<string, number> = { h: 3600, m: 60, s: 1 };
          const seconds = parseInt(value) * multipliers[unit];
          options.since = Math.floor(Date.now() / 1000) - seconds;
        } else {
          options.since = Math.floor(new Date(since).getTime() / 1000);
        }
      }

      const logBuffer = await container.logs(options);
      // Docker multiplexed stream has 8-byte headers per frame — strip them
      const logText = demuxDockerStream(logBuffer);

      return {
        content: [{ type: "text" as const, text: logText || "(no logs)" }],
      };
    }
  );
}
