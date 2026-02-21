# mcp-deploy

Deploy Docker containers to your VPS from Claude Code, Cursor, or any MCP client. One command to install, one sentence to deploy.

```
> You: "Deploy my-api"
> MCP: Deployed my-api successfully.
     URL: https://my-api.deploy.example.com
     Status: running
```

## How It Works

```
┌─────────────────┐       HTTPS        ┌─────────────────────────────────────┐
│  Claude Code /  │ ────────────────── │          Your VPS                   │
│  Cursor / any   │   MCP Protocol     │                                     │
│  MCP Client     │                    │  Traefik ──→ MCP Server (:3000)     │
└─────────────────┘                    │     │                               │
                                       │     ├──→ my-app.deploy.example.com  │
                                       │     ├──→ my-api.deploy.example.com  │
                                       │     └──→ blog.deploy.example.com    │
                                       └─────────────────────────────────────┘
```

- **Traefik** handles SSL (automatic per-subdomain Let's Encrypt certs) and routes each subdomain to the right container
- **MCP Server** receives tool calls over [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) and manages Docker containers
- **No database** — Docker is the source of truth
- **No registry required** — push images directly or pull from GHCR/DockerHub

## Quick Start

### 0. Get a VPS

You need a Linux VPS with a public IP. Any provider works — if you don't have one yet, [Hetzner gives you a $20 credit to get started](https://hetzner.cloud/?ref=4bBAKWKbTCIO). A CX22 (2 vCPU, 4 GB RAM) is more than enough.

### 1. Set Up DNS

Create two DNS A records pointing to your VPS IP:

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `deploy.example.com` | A | `YOUR_VPS_IP` | MCP server (`mcp.deploy.example.com`) |
| `*.deploy.example.com` | A | `YOUR_VPS_IP` | All deployed apps (`myapp.deploy.example.com`, etc.) |

> **Note:** The wildcard record (`*`) must include the dot and asterisk prefix — enter it exactly as `*.deploy.example.com` in your DNS provider. This is a separate record from the base domain.

### 2. Install on Your VPS

```bash
ssh root@your-vps
curl -fsSL https://raw.githubusercontent.com/ddalcu/mcp-deploy/main/install.sh | bash
```

The installer asks for two things: your **base domain** (e.g. `deploy.example.com`, without `*` or leading dot) and **email** (for Let's Encrypt). That's it. It generates an API key and starts everything.

### 3. Add to Your MCP Client

Copy the config the installer outputs into your MCP client settings.

**Claude Code** — add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "deploy-prod": {
      "type": "streamable-http",
      "url": "https://mcp.deploy.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### 4. Deploy Something

Open any project in Claude Code and say:

> "Deploy nginx:alpine as hello"

Visit `https://hello.deploy.example.com` — it's live with SSL.

## What Gets Installed on Your VPS

```
/opt/mcp-deploy/
├── .env                  ← your config + API key (chmod 600)
└── docker-compose.yml    ← the stack definition
```

Two files. Everything else runs in Docker:

| Container | Image | Purpose |
|-----------|-------|---------|
| `mcp-deploy-traefik` | `traefik:v3.3` | Reverse proxy + automatic SSL |
| `mcp-deploy-server` | `ghcr.io/ddalcu/mcp-deploy` | MCP server |

Plus a `traefik-certs` volume for Let's Encrypt certificates and a `web` network shared by all containers.

## Pushing Images

### Option A: Push directly (no registry needed)

Build locally and send the image straight to your VPS:

```bash
docker build -t my-app:latest .
docker save my-app:latest | curl -X POST -T - \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://mcp.deploy.example.com/upload
```

Then deploy it:

> "Deploy my-app:latest as my-app on port 3000"

### Option B: Pull from an external registry

Use any registry. Public images just work:

> "Deploy nginx:alpine as docs on port 80"

For private registries, pass credentials:

> "Deploy ghcr.io/myorg/my-app:latest as my-app on port 3000 with registry auth username myuser password ghp_abc123"

## Multiple Servers

Install on as many VPS servers as you want. Add each as a separate MCP server entry:

```json
{
  "mcpServers": {
    "deploy-prod": {
      "type": "streamable-http",
      "url": "https://mcp.prod.example.com/mcp",
      "headers": { "Authorization": "Bearer PROD_KEY" }
    },
    "deploy-staging": {
      "type": "streamable-http",
      "url": "https://mcp.staging.example.com/mcp",
      "headers": { "Authorization": "Bearer STAGING_KEY" }
    }
  }
}
```

Then specify which server: *"Deploy my-app to deploy-staging"*

## MCP Tools

| Tool | Description |
|------|-------------|
| `deploy` | Deploy or redeploy a Docker image with automatic SSL and subdomain routing |
| `list` | List all managed deployments |
| `logs` | Get container logs |
| `status` | Detailed app info — CPU, memory, uptime, restart count |
| `stop` | Stop a running app (container preserved) |
| `start` | Start a stopped app |
| `remove` | Permanently remove an app and its container |

### Deploy Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | App name — becomes the subdomain (`name.domain.com`) |
| `image` | string | yes | Docker image (e.g. `nginx:alpine`, `ghcr.io/user/repo:v1`) |
| `port` | number | no | Port the app listens on inside the container. Auto-detected from the image `EXPOSE` directive if not provided. |
| `env` | object | no | Environment variables (`{ "KEY": "value" }`) |
| `registry_auth` | object | no | `{ "username": "...", "password": "..." }` for private registries |
| `volumes` | string[] | no | Named volume mounts (`["data:/app/data"]`) |
| `command` | string | no | Override the container's default command |

## Configuration

All config is in `/opt/mcp-deploy/.env` on the VPS:

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN` | Base domain for all services | *(required)* |
| `ACME_EMAIL` | Let's Encrypt notification email | *(required)* |
| `API_KEY` | Bearer token for MCP server auth | *(auto-generated)* |
| `MCP_IMAGE` | Override the MCP server Docker image | `ghcr.io/ddalcu/mcp-deploy:latest` |

After editing `.env`, restart the stack:

```bash
cd /opt/mcp-deploy && docker compose up -d
```

## Uninstall

```bash
cd /opt/mcp-deploy && docker compose down -v
rm -rf /opt/mcp-deploy
docker network rm web
```

## Security

- All traffic is HTTPS via Traefik + Let's Encrypt (automatic per-subdomain certs via HTTP-01 challenge)
- MCP and upload endpoints require `Authorization: Bearer <token>` (timing-safe comparison)
- API key is generated with `openssl rand -hex 32` (256-bit)
- `.env` file is `chmod 600` (root-only readable)
- Volume mounts are restricted to named volumes only (no host path mounts)
- Infrastructure container names are reserved and cannot be overwritten via deploy
- Upload endpoint enforces a 2 GB size limit

## Architecture

```
server/src/
├── index.ts        ← Express + MCP Streamable HTTP transport + /upload endpoint
├── auth.ts         ← Bearer token middleware (timing-safe)
├── config.ts       ← Environment variable config
├── docker.ts       ← Dockerode singleton + pull/load/list helpers
├── labels.ts       ← Traefik label generator
├── validation.ts   ← Shared app name validation + reserved names
└── tools/
    ├── deploy.ts   ← Pull or use local image, create container with Traefik labels
    ├── list.ts     ← Query Docker for containers labeled mcp-deploy.managed=true
    ├── logs.ts     ← Container log retrieval
    ├── status.ts   ← Container inspect + live CPU/memory stats
    ├── stop.ts     ← Stop container
    ├── start.ts    ← Start container
    └── remove.ts   ← Stop + remove container
```

**Design principles:**
- Docker IS the database — no SQLite, no JSON state files, no sync issues
- Traefik auto-discovers containers via Docker labels — no config reloads
- Each tool is one file (SRP) — easy to add new tools without touching existing code
- Stateless auth — every request validates independently, no sessions

## Development

```bash
git clone https://github.com/ddalcu/mcp-deploy.git
cd mcp-deploy

# Build the server image locally
docker build -t mcp-deploy:dev ./server

# Start the stack with your local image
cp .env.example .env  # fill in your values
MCP_IMAGE=mcp-deploy:dev docker compose up -d
```

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
