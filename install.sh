#!/usr/bin/env bash
set -euo pipefail

# mcp-deploy installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ddalcu/mcp-deploy/main/install.sh | bash
#    or: wget -qO- https://raw.githubusercontent.com/ddalcu/mcp-deploy/main/install.sh | bash

INSTALL_DIR="/opt/mcp-deploy"
REPO_RAW="https://raw.githubusercontent.com/ddalcu/mcp-deploy/main"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC} $1"; }
ok()    { echo -e "${GREEN}[ok]${NC} $1"; }
err()   { echo -e "${RED}[error]${NC} $1" >&2; exit 1; }
prompt() {
  local var_name="$1" message="$2" default="${3:-}"
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "${BOLD}${message}${NC} [${default}]: ")" value </dev/tty
    eval "$var_name=\"${value:-$default}\""
  else
    read -rp "$(echo -e "${BOLD}${message}${NC}: ")" value </dev/tty
    [[ -z "$value" ]] && err "Value required."
    eval "$var_name=\"$value\""
  fi
}

# HTTP fetch helper — uses curl or wget, whichever is available
fetch() {
  if command -v curl &>/dev/null; then
    curl -fsSL "$@"
  elif command -v wget &>/dev/null; then
    # Map common curl flags to wget equivalents
    local url="" output=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -o) output="$2"; shift 2 ;;
        -s) shift ;; # wget is quiet by default with -q
        *)  url="$1"; shift ;;
      esac
    done
    if [[ -n "$output" ]]; then
      wget -qO "$output" "$url"
    else
      wget -qO- "$url"
    fi
  else
    err "Neither curl nor wget found. Please install one of them."
  fi
}

# --- Preflight ---

[[ "$(uname -s)" == "Linux" ]] || err "This installer only supports Linux."
[[ "$(id -u)" -eq 0 ]] || err "Please run as root: sudo bash install.sh"

info "mcp-deploy installer"
echo ""

# --- Install Docker if missing ---

if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  fetch https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker installed."
else
  ok "Docker already installed."
fi

# Verify docker compose
docker compose version &>/dev/null || err "docker compose plugin not found. Please install it."

# --- Collect configuration ---

echo ""
info "Configuration"
echo ""

prompt DOMAIN    "Base domain — without * or leading dot (e.g. deploy.example.com)"
prompt ACME_EMAIL "Email for Let's Encrypt"

echo ""
info "How should the MCP server be accessible?"
echo -e "  ${BOLD}1)${NC} Domain only  — via mcp.${DOMAIN} (HTTPS through Traefik) ${DIM}[default]${NC}"
echo -e "  ${BOLD}2)${NC} Port only    — via IP:PORT (HTTP, no Traefik for MCP server)"
echo -e "  ${BOLD}3)${NC} Both         — domain + direct port"
echo ""
read -rp "$(echo -e "${BOLD}Choose [1/2/3]${NC}: ")" EXPOSE_MODE </dev/tty
EXPOSE_MODE=${EXPOSE_MODE:-1}

DIRECT_PORT=""
MCP_TRAEFIK=""
if [[ "$EXPOSE_MODE" == "2" || "$EXPOSE_MODE" == "3" ]]; then
  read -rp "$(echo -e "${BOLD}Direct API port (e.g. 8080)${NC}: ")" DIRECT_PORT </dev/tty
  while [[ -z "$DIRECT_PORT" ]]; do
    read -rp "$(echo -e "${BOLD}Port is required for this mode (e.g. 8080)${NC}: ")" DIRECT_PORT </dev/tty
  done
fi
if [[ "$EXPOSE_MODE" == "2" ]]; then
  MCP_TRAEFIK="false"
fi

# --- Generate secrets ---

API_KEY=$(openssl rand -hex 32)

ok "Generated API key."

# --- Create install directory ---

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# --- Download compose file ---

info "Downloading docker-compose.yml..."
fetch "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
ok "Downloaded."

# --- Write .env ---

cat > .env <<EOF
DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
API_KEY=$API_KEY
EOF

if [[ -n "$MCP_TRAEFIK" ]]; then
  echo "MCP_TRAEFIK=$MCP_TRAEFIK" >> .env
fi

if [[ -n "$DIRECT_PORT" ]]; then
  echo "DIRECT_PORT=$DIRECT_PORT" >> .env
  cat > docker-compose.override.yml <<EOF
services:
  mcp-server:
    ports:
      - "${DIRECT_PORT}:3000"
EOF
fi

if [[ "$EXPOSE_MODE" == "2" ]]; then
  ok "MCP server exposed on port ${DIRECT_PORT} only (Traefik disabled for MCP server)"
elif [[ "$EXPOSE_MODE" == "3" ]]; then
  ok "MCP server exposed via Traefik + direct port ${DIRECT_PORT}"
else
  ok "MCP server exposed via Traefik only"
fi

chmod 600 .env
ok "Configuration saved to $INSTALL_DIR/.env"

# --- Start stack ---

info "Starting mcp-deploy stack..."
docker compose up -d
ok "Stack started."

# --- Output summary ---

VPS_IP=$(fetch https://api.ipify.org 2>/dev/null || fetch https://icanhazip.com 2>/dev/null || echo 'YOUR_VPS_IP')

echo ""
echo -e "${GREEN}${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  mcp-deploy installed successfully!${NC}"
echo -e "${GREEN}${BOLD}============================================${NC}"
echo ""
if [[ "$EXPOSE_MODE" == "2" ]]; then
  MCP_URL="http://${VPS_IP}:${DIRECT_PORT}/mcp"
  UPLOAD_URL="http://${VPS_IP}:${DIRECT_PORT}/upload"
  echo -e "${BOLD}MCP Server:${NC}  ${MCP_URL}"
  echo -e "${BOLD}Health:${NC}      http://${VPS_IP}:${DIRECT_PORT}/health"
  echo -e "${BOLD}REST API:${NC}    http://${VPS_IP}:${DIRECT_PORT}/api"
  echo -e "${BOLD}Dashboard:${NC}   http://${VPS_IP}:${DIRECT_PORT}"
else
  MCP_URL="https://mcp.${DOMAIN}/mcp"
  UPLOAD_URL="https://mcp.${DOMAIN}/upload"
  echo -e "${BOLD}MCP Server:${NC}  ${MCP_URL}"
  echo -e "${BOLD}Health:${NC}      https://mcp.${DOMAIN}/health"
  echo -e "${BOLD}Dashboard:${NC}   https://mcp.${DOMAIN}"
  if [[ -n "$DIRECT_PORT" ]]; then
    echo -e "${BOLD}REST API:${NC}    http://${VPS_IP}:${DIRECT_PORT}/api"
  fi
fi
echo -e "${BOLD}API Key:${NC}     ${API_KEY}"
echo ""
echo -e "${BOLD}Add this to your MCP client config:${NC}"
echo ""
cat <<MCPCONFIG
{
  "mcpServers": {
    "deploy-$(echo "$DOMAIN" | cut -d. -f1)": {
      "type": "streamable-http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
MCPCONFIG
echo ""
echo -e "${BOLD}Push images directly (no registry needed):${NC}"
echo "  docker save myapp:latest | curl -X POST -T - -H 'Authorization: Bearer ${API_KEY}' ${UPLOAD_URL}"
echo ""
# --- DNS verification ---

echo -e "${BOLD}Verifying DNS records...${NC}"
echo ""

DNS_OK=true

# Check base domain
BASE_RESOLVED=$(dig +short "$DOMAIN" A 2>/dev/null | tail -1)
if [[ "$BASE_RESOLVED" == "$VPS_IP" ]]; then
  ok "${DOMAIN} → ${BASE_RESOLVED}"
else
  echo -e "  ${RED}✗${NC} ${DOMAIN} → ${BASE_RESOLVED:-not found} (expected ${VPS_IP})"
  DNS_OK=false
fi

# Check wildcard via a test subdomain (DNS returns the wildcard record)
WILDCARD_RESOLVED=$(dig +short "dns-check.${DOMAIN}" A 2>/dev/null | tail -1)
if [[ "$WILDCARD_RESOLVED" == "$VPS_IP" ]]; then
  ok "*.${DOMAIN} → ${WILDCARD_RESOLVED}"
else
  echo -e "  ${RED}✗${NC} *.${DOMAIN} → ${WILDCARD_RESOLVED:-not found} (expected ${VPS_IP})"
  DNS_OK=false
fi

echo ""
if [[ "$DNS_OK" == true ]]; then
  ok "DNS is configured correctly. SSL certificates will be provisioned automatically."
else
  echo -e "${BOLD}Add these DNS records to your provider:${NC}"
  echo ""
  echo "  ${DOMAIN}      A → ${VPS_IP}   (base domain — for the MCP server)"
  echo "  *.${DOMAIN}    A → ${VPS_IP}   (wildcard — for all deployed apps)"
  echo ""
  echo "  Enter *.${DOMAIN} exactly as shown (with the asterisk) in your DNS provider."
  echo ""
  echo -e "  ${CYAN}DNS propagation can take a few minutes. SSL certificates will be"
  echo -e "  provisioned automatically once the records resolve.${NC}"
fi
