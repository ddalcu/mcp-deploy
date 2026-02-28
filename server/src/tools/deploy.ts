import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Docker from "dockerode";
import { docker, resolveLocalImage, pullImage, getExposedPort, MANAGED_LABEL, NAME_LABEL, NETWORK_NAME } from "../docker.ts";
import { traefikLabels } from "../labels.ts";
import { config } from "../config.ts";
import { appName } from "../validation.ts";

export const deployInputSchema = z.object({
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
    .describe("Named volume mounts (e.g. ['data:/app/data']). Volume names are auto-prefixed with 'volume-{app}-' to prevent cross-app sharing."),
  ports: z
    .array(z.string().regex(/^\d+:\d+$/, "Format: 'hostPort:containerPort' (e.g. '25:2525')"))
    .optional()
    .describe("Additional host:container port mappings for non-HTTP traffic (e.g. ['25:2525', '993:9933']). These bind directly on the host, bypassing Traefik."),
  command: z.string().optional().describe("Override container command"),
});

export type DeployInput = z.infer<typeof deployInputSchema>;

export async function deployApp({ name, image, port: portInput, env, registry_auth, volumes, ports, command }: DeployInput) {
  const containerName = `mcp-deploy-${name}`;

  // Use local image if available (also checks localhost/ prefix for podman-uploaded images), otherwise pull
  let resolvedImage = await resolveLocalImage(image);
  if (!resolvedImage) {
    try {
      await pullImage(image, registry_auth);
      resolvedImage = image;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Image "${image}" is not on this server and could not be pulled from a registry. ${msg}. ` +
        `If this is a locally-built image, upload it first via POST /upload, then retry.`
      );
    }
  }

  // Resolve port: use provided value, or auto-detect from image EXPOSE
  let port = portInput;
  if (!port) {
    const exposed = await getExposedPort(resolvedImage);
    if (!exposed) {
      throw new Error("Could not auto-detect port: the image has no EXPOSE directive or has multiple exposed ports. Please specify the port explicitly.");
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
    // Namespace volume names by app to prevent cross-app data sharing
    hostConfig.Binds = volumes.map((v) => {
      const colonIdx = v.indexOf(":");
      const volName = v.slice(0, colonIdx);
      const mountPath = v.slice(colonIdx);
      return `volume-${name}-${volName}${mountPath}`;
    });
  }

  if (ports?.length) {
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    for (const mapping of ports) {
      const [hostPort, containerPort] = mapping.split(":");
      portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
    }
    hostConfig.PortBindings = portBindings;
  }

  const createOptions: Record<string, unknown> = {
    Image: resolvedImage,
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
  return { name, url, image, container: containerName, status: "running" };
}

export function registerDeployTool(server: McpServer) {
  server.registerTool(
    "deploy",
    {
      description:
        "Deploy a Docker image as a web app with automatic SSL and subdomain routing. Redeploys if the app already exists. " +
        "For public/registry images, call this directly. " +
        "For locally-built images, call upload-image first to transfer the image to the server. " +
        "For static HTML/CSS/JS sites, use deploy-static instead — simpler, no Docker image needed.",
      inputSchema: deployInputSchema,
    },
    async (input) => {
      try {
        const result = await deployApp(input);
        return {
          content: [{
            type: "text" as const,
            text: [
              `Deployed ${result.name} successfully.`,
              `URL: ${result.url}`,
              `Image: ${result.image}`,
              `Container: ${result.container}`,
              `Status: ${result.status}`,
            ].join("\n"),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }
    }
  );
}
