import { config } from "./config.ts";

export function traefikLabels(name: string, port: number): Record<string, string> {
  const labels: Record<string, string> = {
    "traefik.enable": "true",
    [`traefik.http.routers.${name}.rule`]: `Host(\`${name}.${config.domain}\`)`,
    [`traefik.http.routers.${name}.entrypoints`]: "websecure",
    [`traefik.http.services.${name}.loadbalancer.server.port`]: String(port),
  };

  if (config.acmeEnabled) {
    labels[`traefik.http.routers.${name}.tls.certresolver`] = "letsencrypt";
  } else {
    labels[`traefik.http.routers.${name}.tls`] = "true";
    // HTTP router so apps are also reachable without TLS in dev
    labels[`traefik.http.routers.${name}-http.rule`] = `Host(\`${name}.${config.domain}\`)`;
    labels[`traefik.http.routers.${name}-http.entrypoints`] = "web";
  }

  return labels;
}
