# v1.0.3

REST API, web dashboard, CI/CD support, flexible server exposure modes, and a local development stack.

## New

- **REST API** — all MCP tools are now available as standard REST endpoints (`/api/deploy`, `/api/apps`, `/api/apps/:name`, etc.) for use from GitHub Actions, shell scripts, or any HTTP client. No MCP client required.
- **Web dashboard** — the root URL (`/`) now serves a built-in dashboard showing all deployed apps with status, resource usage, and logs. Auth via API key, dark theme, auto-refresh, no external dependencies.
- **MCP server exposure modes** — the installer now asks how the MCP server should be accessible: domain only (default), direct port only, or both. Port-only mode is useful for CI/CD or when running behind your own reverse proxy.
- **Local development stack** — new `docker-compose.dev.yml` runs the full stack locally with self-signed TLS, source mounting, and `--watch` live reload. Compatible with Docker, Podman, and OrbStack.
- **GitHub Actions examples** — README now includes ready-to-use workflow examples for deploying from a registry, uploading images directly, and deploying static sites.

## Improved

- **Deploy logic extracted into reusable functions** — each tool's core logic (`deployApp`, `listApps`, `getAppStatus`, `getAppLogs`, `stopApp`, `startApp`, `removeApp`) is now exported as a standalone function, shared by both MCP tools and the REST API. No duplicated code.
- **Static site deploys clear default nginx files** — `deployStaticSite` now removes the default nginx welcome page before extracting the user's archive, preventing leftover files from appearing alongside deployed content.
- **Traefik labels support dev mode** — when `ACME_ENABLED=false`, deployed apps get a self-signed TLS router plus an HTTP router so they're reachable without Let's Encrypt in local dev.
- **Installer shows all access URLs** — the post-install summary now displays the dashboard URL, REST API URL, and adjusts based on the chosen exposure mode.
- **README overhaul** — added table of contents, REST API docs with curl examples, GitHub Actions section, web dashboard section, exposure modes docs, Mermaid architecture diagram, and improved development instructions.
- **Website updates** — added logo, REST API section, dashboard section, mobile-responsive fixes, Three.js particle background, and updated comparison table.
- **`deploy-static` tool description** — now mentions the auto-linking behavior when a folder has exactly one `.html` file but no `index.html`.

## Configuration

- `MCP_TRAEFIK` — new env var to disable Traefik routing for the MCP server (set to `false` for port-only mode)
- `DIRECT_PORT` — new env var to expose the MCP server on a direct port via IP (no SSL)
- `ACME_ENABLED` — new env var (server-side) to disable Let's Encrypt for local development

---

# v1.0.2

Fixed a stream race condition that could cause image uploads to silently lose data, and improved MCP tool descriptions so LLMs pick the right deployment method on the first try.

## Fixed

- **Image upload data loss** — the `/upload` endpoint had a stream race condition where a `data` event listener put the request stream into flowing mode before `loadImage` could set up its pipeline, causing early chunks to be lost. Uploads would appear to succeed but produce truncated or corrupt images. Fixed by moving byte-counting into a `Transform` stream inside a single `pipeline()` call.
- **Static deploy auth failure** — `deploy-static` tool returned `$MCP_API_KEY` placeholder in the curl command instead of the actual API key (unlike `upload-image` which correctly embedded it). LLMs couldn't authenticate the upload.
- **Podman-uploaded images not found by deploy** — images saved by Podman are prefixed with `localhost/` (e.g., `localhost/myapp:latest`). The deploy tool now checks both `myapp:latest` and `localhost/myapp:latest` automatically.
- **Redeployments served stale images** — `upload-image` skipped the upload if the tag already existed on the server, so rebuilds with the same tag (e.g., `myapp:latest`) were never pushed. The tool now always returns the upload command.

## Improved

- **Tool descriptions guide LLMs to the right tool** — each tool (`deploy`, `deploy-static`, `upload-image`) now cross-references the others with clear guidance: static files → `deploy-static`, local Docker image → `upload-image` then `deploy`, registry image → `deploy` directly.
- **macOS tar compatibility** — `deploy-static` instructions now include `COPYFILE_DISABLE=1` and `--no-xattrs` to prevent macOS extended attributes from corrupting the archive. The server also strips `._*` AppleDouble files after extraction as a fallback.
- **Static sites auto-link index.html** — if an uploaded archive has no `index.html` but contains exactly one `.html` file, the server creates a symlink so the site works at the root URL.
- **upload-image build path** — the platform rebuild example no longer assumes `.` as the build context, preventing LLMs from running `docker build` in the wrong directory.

## New

- **Unit tests** — added `loadImage` tests using `node:test` covering data integrity, size limit enforcement, chunked transfers, and boundary conditions.

---

# v1.0.1

Improved LLM compatibility for local image deployments and installer fixes.

## New

- **`upload-image` MCP tool** — LLMs can now discover the upload capability through the tool listing instead of only learning about it when deploy fails. Call it to get the exact bash command for uploading a locally-built image to the server.

## Improved

- **Deploy error messages** — when an image pull fails, the error now directs the LLM to call `upload-image` instead of dumping raw curl instructions
- **Upload reliability** — image uploads are buffered to disk before loading into Docker, preventing streaming corruption on slow connections
- **Installer compatibility** — `install.sh` now works with both `curl` and `wget`/`fetch` for downloading compose files
- **Traefik updated** to latest v3.3
- **Docker networking** — removed manual network creation, let Docker Compose handle it
- **README** — updated Claude Code setup instructions to use `claude mcp add` CLI command, added Proxmox/LXC note

---

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
