import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export function registerDeployStaticTool(server: McpServer) {
  server.registerTool(
    "deploy-static",
    {
      description: "Deploy a static HTML site with automatic SSL and subdomain routing. Returns the upload endpoint — use curl to upload a tar.gz of the site files.",
      inputSchema: z.object({ name: appName }),
    },
    async ({ name }) => {
      const uploadUrl = `https://mcp.${config.domain}/deploy-static/${name}`;
      const siteUrl = `https://${name}.${config.domain}`;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `To deploy static files to ${siteUrl}:`,
              ``,
              `1. Create a tar.gz of your site folder:`,
              `   tar -czf /tmp/${name}.tar.gz -C ./your-site-folder .`,
              ``,
              `2. Upload to the deploy endpoint:`,
              `   curl -X POST ${uploadUrl} \\`,
              `     -H "Authorization: Bearer $MCP_API_KEY" \\`,
              `     -H "Content-Type: application/gzip" \\`,
              `     --data-binary @/tmp/${name}.tar.gz`,
              ``,
              `The site will be live at ${siteUrl} immediately after upload.`,
              `Use the existing list, status, logs, stop, start, and remove tools to manage the deployment.`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
