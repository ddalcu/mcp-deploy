import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Docker from "dockerode";
import { docker, imageExistsLocally, pullImage, getExposedPort, MANAGED_LABEL, NAME_LABEL, NETWORK_NAME } from "../docker.ts";
import { traefikLabels } from "../labels.ts";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export function registerDeployTool(server: McpServer) {
  server.registerTool(
    "deploy",
    {
      description:
        "Deploy a Docker image as a web app with automatic SSL and subdomain routing. Redeploys if the app already exists. " +
        "For public/registry images, call this directly. " +
        "For locally-built images, call upload-image first to transfer the image to the server. " +
        "For static HTML/CSS/JS sites, use deploy-static instead — simpler, no Docker image needed.",
      inputSchema: z.object({
        name: appName,
        image: z.string().min(1).describe("Docker image to deploy (e.g. nginx:alpine, ghcr.io/user/repo:tag)"),
        port: z.number().int().min(1).max(65535).optional().describe("Container port the app listens on. Auto-detected from the image EXPOSE directive if not provided."),
        env: z.record(z.string(), z.string()).optional().describe("Environment variables to set"),
        registry_auth: z
          .object({ username: z.string(), password: z.string() })
          .optional()
          .describe("Credentials for private registries (GHCR, DockerHub, etc.)"),
        volumes: z
          .array(z.string().regex(/^[a-zA-Z0-9_-]+:\//, "Only named volumes allowed (e.g. 'data:/app/data')"))
          .optional()
          .describe("Named volume mounts (e.g. ['data:/app/data'])"),
        command: z.string().optional().describe("Override container command"),
      }),
    },
    async ({ name, image, port: portInput, env, registry_auth, volumes, command }) => {
      const containerName = `mcp-deploy-${name}`;

      // Use local image if available, otherwise pull
      const isLocal = await imageExistsLocally(image);
      if (!isLocal) {
        try {
          await pullImage(image, registry_auth);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: "text" as const,
              text: [
                `FAILED: Image "${image}" is not on this server and could not be pulled from a registry.`,
                `Error: ${msg}`,
                "",
                "If this is a locally-built image, call the upload-image tool first to get the upload command, then retry deploy.",
              ].join("\n"),
            }],
            isError: true,
          };
        }
      }

      // Resolve port: use provided value, or auto-detect from image EXPOSE
      let port = portInput;
      if (!port) {
        const exposed = await getExposedPort(image);
        if (!exposed) {
          return {
            content: [{
              type: "text" as const,
              text: "Could not auto-detect port: the image has no EXPOSE directive or has multiple exposed ports. Please specify the port explicitly.",
            }],
            isError: true,
          };
        }
        port = exposed;
      }

      // Remove existing container if redeploying
      try {
        const existing = docker.getContainer(containerName);
        await existing.stop().catch(() => {});
        await existing.remove();
      } catch {
        // Container doesn't exist
      }

      const labels: Record<string, string> = {
        ...traefikLabels(name, port),
        [MANAGED_LABEL]: "true",
        [NAME_LABEL]: name,
      };

      const hostConfig: Record<string, unknown> = {
        RestartPolicy: { Name: "unless-stopped" },
      };

      if (volumes?.length) {
        hostConfig.Binds = volumes;
      }

      const createOptions: Record<string, unknown> = {
        Image: image,
        name: containerName,
        Labels: labels,
        Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : [],
        HostConfig: hostConfig,
        NetworkingConfig: {
          EndpointsConfig: { [NETWORK_NAME]: {} },
        },
      };

      if (command) {
        createOptions.Cmd = command.split(" ");
      }

      const container = await docker.createContainer(createOptions as Docker.ContainerCreateOptions);
      await container.start();

      const url = `https://${name}.${config.domain}`;
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Deployed ${name} successfully.`,
              `URL: ${url}`,
              `Image: ${image}`,
              `Container: ${containerName}`,
              `Status: running`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
