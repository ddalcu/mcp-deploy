import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.ts";
import { imageExistsLocally } from "../docker.ts";

export function registerUploadImageTool(server: McpServer) {
  server.registerTool(
    "upload-image",
    {
      description:
        "Get the bash command to upload a locally-built Docker image to the server. " +
        "Use this BEFORE calling deploy when the image only exists on the user's machine (not in a registry). " +
        "Run the returned command via bash, then call deploy.",
      inputSchema: z.object({
        image: z.string().min(1).describe("Docker image name and tag (e.g. my-app:latest)"),
      }),
    },
    async ({ image }) => {
      const alreadyExists = await imageExistsLocally(image);
      if (alreadyExists) {
        return {
          content: [{
            type: "text" as const,
            text: `Image "${image}" already exists on the server. No upload needed — you can call deploy directly.`,
          }],
        };
      }

      const uploadUrl = `https://mcp.${config.domain}/upload`;
      return {
        content: [{
          type: "text" as const,
          text: [
            `Run this bash command to upload "${image}" to the server:`,
            "",
            `docker save ${image} | curl -X POST -T - -H "Authorization: Bearer <TOKEN>" "${uploadUrl}"`,
            "",
            "Replace <TOKEN> with the Bearer token from your MCP server configuration (the same Authorization header used to connect to this MCP server).",
            "",
            "IMPORTANT: If the image was built on macOS (ARM/Apple Silicon) and the server is linux/amd64, rebuild first:",
            `  docker build --platform linux/amd64 -t ${image} .`,
            "",
            "After the upload succeeds, call the deploy tool.",
          ].join("\n"),
        }],
      };
    }
  );
}
