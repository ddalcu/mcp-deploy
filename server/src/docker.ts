import Docker from "dockerode";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

export const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export const LABEL_PREFIX = "mcp-deploy";
export const MANAGED_LABEL = `${LABEL_PREFIX}.managed`;
export const NAME_LABEL = `${LABEL_PREFIX}.name`;
export const NETWORK_NAME = "web";

export async function getManagedContainers(statusFilter?: string) {
  const filters: Docker.ContainerListOptions["filters"] = {
    label: [`${MANAGED_LABEL}=true`],
  };

  if (statusFilter && statusFilter !== "all") {
    filters.status = [statusFilter];
  }

  return docker.listContainers({ all: true, filters });
}

export async function imageExistsLocally(image: string): Promise<boolean> {
  try {
    await docker.getImage(image).inspect();
    return true;
  } catch {
    return false;
  }
}

export async function pullImage(
  image: string,
  auth?: { username: string; password: string }
): Promise<void> {
  const options: Record<string, unknown> = {};
  if (auth) {
    options.authconfig = {
      username: auth.username,
      password: auth.password,
    };
  }

  const stream = await docker.pull(image, options);
  return new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });
}

export async function getExposedPort(image: string): Promise<number | null> {
  const imageInfo = await docker.getImage(image).inspect();
  const exposedPorts = imageInfo.Config?.ExposedPorts;
  if (!exposedPorts) return null;

  const ports = Object.keys(exposedPorts).map((p) => parseInt(p));
  return ports.length === 1 ? ports[0] : null;
}

export async function loadImage(tarStream: NodeJS.ReadableStream): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), "mcp-upload-"));

  try {
    // Buffer to disk first to avoid streaming corruption on slow connections
    const tarPath = join(tmpDir, "upload.tar");
    await pipeline(tarStream, createWriteStream(tarPath));

    const stream = await docker.loadImage(createReadStream(tarPath));
    return await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      stream.on("error", reject);
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
