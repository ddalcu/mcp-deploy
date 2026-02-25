import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export function registerDeployStaticTool(server: McpServer) {
  server.registerTool(
    "deploy-static",
    {
      description:
        "Deploy static files (HTML, CSS, JS) as a website with automatic SSL. " +
        "Use this for static sites — no Docker image needed. " +
        "For Docker-based apps, use the deploy tool instead. " +
        "Returns curl commands to upload and deploy the files. " +
        "If the folder has no index.html but has exactly one .html file, it will be served as the default page automatically.",
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
              `   COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/${name}.tar.gz -C /path/to/site-folder .`,
              `   (COPYFILE_DISABLE=1 and --no-xattrs prevent macOS extended attributes from breaking the archive)`,
              ``,
              `2. Upload to the deploy endpoint:`,
              `   curl -X POST ${uploadUrl} \\`,
              `     -H "Authorization: Bearer ${config.apiKey}" \\`,
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
