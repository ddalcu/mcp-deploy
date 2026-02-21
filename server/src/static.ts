import type Docker from "dockerode";
import { docker, imageExistsLocally, pullImage, MANAGED_LABEL, NAME_LABEL, LABEL_PREFIX, NETWORK_NAME } from "./docker.ts";
import { traefikLabels } from "./labels.ts";
import { config } from "./config.ts";

const STATIC_IMAGE = "nginx:alpine";
const TYPE_LABEL = `${LABEL_PREFIX}.type`;

export async function deployStaticSite(name: string, tarStream: NodeJS.ReadableStream): Promise<string> {
  const containerName = `mcp-deploy-${name}`;
  const volumeName = `mcp-static-${name}`;

  if (!await imageExistsLocally(STATIC_IMAGE)) {
    await pullImage(STATIC_IMAGE);
  }

  // Remove existing container
  try {
    const existing = docker.getContainer(containerName);
    await existing.stop().catch(() => {});
    await existing.remove();
  } catch {
    // Container doesn't exist
  }

  // Remove existing volume for clean deploy
  try {
    await docker.getVolume(volumeName).remove();
  } catch {
    // Volume doesn't exist
  }

  await docker.createVolume({ Name: volumeName });

  const labels: Record<string, string> = {
    ...traefikLabels(name, 80),
    [MANAGED_LABEL]: "true",
    [NAME_LABEL]: name,
    [TYPE_LABEL]: "static",
  };

  const container = await docker.createContainer({
    Image: STATIC_IMAGE,
    name: containerName,
    Labels: labels,
    HostConfig: {
      RestartPolicy: { Name: "unless-stopped" },
      Binds: [`${volumeName}:/usr/share/nginx/html`],
    },
    NetworkingConfig: {
      EndpointsConfig: { [NETWORK_NAME]: {} },
    },
  } as Docker.ContainerCreateOptions);

  await container.start();
  await container.putArchive(tarStream, { path: "/usr/share/nginx/html" });

  return `https://${name}.${config.domain}`;
}
