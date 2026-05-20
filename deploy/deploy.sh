#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"

INSTALL_DOCKER=0
RUN_SEED=0

for arg in "$@"; do
  case "$arg" in
    --install-docker)
      INSTALL_DOCKER=1
      ;;
    --seed)
      RUN_SEED=1
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: bash deploy/deploy.sh [--install-docker] [--seed]

Options:
  --install-docker  Install Docker Engine and the Compose plugin on Ubuntu.
  --seed            Seed demo user/admin data after applying the schema.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

generate_hex() {
  openssl rand -hex "$1"
}

public_ip() {
  curl -fsS https://api.ipify.org 2>/dev/null || true
}

create_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  local ip
  ip="$(public_ip)"
  if [[ -z "$ip" ]]; then
    ip="YOUR_SERVER_IP"
  fi

  cat > "$ENV_FILE" <<EOF
APP_DOMAIN=:80
PUBLIC_WEB_ORIGIN=http://${ip}
NEXT_PUBLIC_API_GATEWAY_URL=

POSTGRES_USER=videoai
POSTGRES_PASSWORD=$(generate_hex 24)
POSTGRES_DB=videoai

NEXTAUTH_SECRET=$(generate_hex 32)
AI_CONFIG_ENCRYPTION_KEY=$(generate_hex 32)

GEMINI_API_KEY=
OPENAI_API_KEY=
EOF

  echo "Created $ENV_FILE with generated local secrets."
  echo "For a real domain, edit APP_DOMAIN and PUBLIC_WEB_ORIGIN before running this script again."
}

install_docker_ubuntu() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  if [[ ! -r /etc/os-release ]]; then
    echo "Cannot detect OS. Install Docker manually, then rerun without --install-docker." >&2
    exit 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    echo "Automatic Docker install supports Ubuntu only. Install Docker manually, then rerun." >&2
    exit 1
  fi

  $SUDO apt-get update
  $SUDO apt-get install -y ca-certificates curl openssl
  $SUDO install -m 0755 -d /etc/apt/keyrings
  $SUDO curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  $SUDO chmod a+r /etc/apt/keyrings/docker.asc

  cat <<EOF | $SUDO tee /etc/apt/sources.list.d/docker.sources >/dev/null
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

  $SUDO apt-get update
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  $SUDO systemctl enable --now docker
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Rerun with --install-docker or install Docker manually." >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose plugin is not available. Rerun with --install-docker or install it manually." >&2
    exit 1
  fi
}

if [[ "$INSTALL_DOCKER" -eq 1 ]]; then
  install_docker_ubuntu
fi

create_env_file
require_docker

cd "$DEPLOY_DIR"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
if [[ -n "$SUDO" ]]; then
  COMPOSE=($SUDO "${COMPOSE[@]}")
fi

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d postgres redis
"${COMPOSE[@]}" run --rm api npm run db:push

if [[ "$RUN_SEED" -eq 1 ]]; then
  "${COMPOSE[@]}" run --rm api npm run db:seed
fi

"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps

echo
echo "VideoAI deploy complete."
echo "Open the PUBLIC_WEB_ORIGIN configured in $ENV_FILE."
