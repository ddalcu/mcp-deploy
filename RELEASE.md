# v1.0.0

Initial release of mcp-deploy - deploy Docker containers to your VPS from Claude Code, Cursor, or any MCP client.

## Features

- **One-command install** — `curl | bash` installer sets up everything on a Linux VPS
- **MCP Streamable HTTP transport** — works with Claude Code, Cursor, and any MCP client
- **Automatic SSL** — Traefik provisions per-subdomain Let's Encrypt certificates
- **No registry required** — push images directly via `/upload` endpoint or pull from GHCR/DockerHub
- **Static site deployments** — upload a tar.gz of HTML files via `/deploy-static/:name`
- **Docker is the database** — no SQLite, no JSON state files, no sync issues

## MCP Tools

| Tool | Description |
|------|-------------|
| `deploy` | Deploy or redeploy a Docker image with automatic SSL and subdomain routing |
| `deploy-static` | Deploy a static HTML site (returns upload endpoint) |
| `list` | List all managed deployments |
| `logs` | Get container logs |
| `status` | Detailed app info — CPU, memory, uptime, restart count |
| `stop` | Stop a running app (container preserved) |
| `start` | Start a stopped app |
| `remove` | Permanently remove an app and its container |

## Dependencies

| Package | Version |
|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.26.0` |
| `dockerode` | `^4.0.9` |
| `express` | `^5.2.1` |
| `zod` | `^3.24.0` |

## Infrastructure

- **Traefik v3.3** — reverse proxy with automatic SSL via HTTP-01 challenge
- **Express 5** — HTTP server for MCP and upload endpoints
- **Stateless auth** — Bearer token with timing-safe comparison
- **Named volumes only** — no host path mounts for security

## Install

```bash
ssh root@your-vps
curl -fsSL https://raw.githubusercontent.com/ddalcu/mcp-deploy/main/install.sh | bash
```
