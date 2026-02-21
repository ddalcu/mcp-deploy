import { config } from "./config.ts";

export function traefikLabels(name: string, port: number): Record<string, string> {
  return {
    "traefik.enable": "true",
    [`traefik.http.routers.${name}.rule`]: `Host(\`${name}.${config.domain}\`)`,
    [`traefik.http.routers.${name}.entrypoints`]: "websecure",
    [`traefik.http.routers.${name}.tls.certresolver`]: "letsencrypt",
    [`traefik.http.services.${name}.loadbalancer.server.port`]: String(port),
  };
}
