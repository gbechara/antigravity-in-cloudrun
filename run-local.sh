#!/usr/bin/env bash
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load local configuration if present. See .env.template for every supported
# variable. Precedence: CLI argument > exported shell variable > .env > default.
# shellcheck source=scripts/load-env.sh
. "$SCRIPT_DIR/scripts/load-env.sh"
load_env_file "$SCRIPT_DIR/.env"

IMAGE_NAME="${IMAGE_NAME:-agy-console-local}"
CONTAINER_NAME="${CONTAINER_NAME:-agy-console-dev}"
PORT="${PORT:-3000}"
HOST_FQDN="${HOST_FQDN:-localhost}"
# No hardcoded project fallback; fall back to the active gcloud config instead.
PROJECT_ID="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-us-east4}"

# Console credentials. Resolved here rather than inline at the docker run call
# so that the value printed in the summary below is guaranteed to be the same
# one the container received. The image runs Next.js in production mode, where
# the app refuses to fall back to any built-in password, so this must be set.
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  ADMIN_PASSWORD_SOURCE="configured"
else
  ADMIN_PASSWORD="$(openssl rand -hex 12)"
  ADMIN_PASSWORD_SOURCE="generated"
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Error: no Google Cloud project resolved." >&2
  echo "Set GCP_PROJECT in .env (cp .env.template .env) or run:" >&2
  echo "  gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

usage() {
  cat <<HELP
Antigravity Console - Local Development Runner

Usage: ./run-local.sh [COMMAND]

Commands:
  start     Build Docker image and start container on port ${PORT}
  stop      Stop and remove the local container
  restart   Stop, rebuild, and restart container
  logs      Follow container logs in real time
  status    Check container status and HTTP health
  exec      Open an interactive bash shell inside the running container
HELP
}

cmd_status() {
  echo "==> Checking container status..."
  if docker ps --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container '${CONTAINER_NAME}' is RUNNING."
    echo "Container Details:"
    docker ps --filter "name=^/${CONTAINER_NAME}$" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "==> Probing HTTP endpoint on port ${PORT}..."
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/login" --max-time 3 | grep -qE "200|307|308"; then
      echo "✅ Health check PASSED: Service is responding on http://localhost:${PORT}"
      echo "🔗 Workstation URL: http://${HOST_FQDN}:${PORT}"
    else
      echo "⚠️ Health check: Port ${PORT} open, but unexpected HTTP response."
    fi
  else
    if docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "⚠️ Container '${CONTAINER_NAME}' exists but is STOPPED."
    else
      echo "ℹ️ Container '${CONTAINER_NAME}' is not running."
    fi
  fi
}

cmd_stop() {
  echo "==> Stopping container '${CONTAINER_NAME}'..."
  if docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop -t 2 "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    echo "✅ Container '${CONTAINER_NAME}' stopped and removed."
  else
    echo "ℹ️ Container '${CONTAINER_NAME}' was not running."
  fi
}

cmd_start() {
  echo "============================================================"
  echo " Starting Antigravity Console in Local Sandbox Mode"
  echo "============================================================"

  # Stop any stale container
  cmd_stop

  echo "==> Building Docker image '${IMAGE_NAME}' from repo root context..."
  docker build -f "${SCRIPT_DIR}/frontend/Dockerfile" -t "${IMAGE_NAME}" "${SCRIPT_DIR}"

  GCLOUD_VOL=()
  if [ -d "${HOME}/.config/gcloud" ]; then
    echo "==> Syncing host gcloud & ADC credentials for container user..."
    rm -rf /tmp/agy-gcloud-config
    mkdir -p /tmp/agy-gcloud-config
    cp -r "${HOME}/.config/gcloud/"* /tmp/agy-gcloud-config/ 2>/dev/null || true
    chmod -R 777 /tmp/agy-gcloud-config 2>/dev/null || true
    GCLOUD_VOL=(-v "/tmp/agy-gcloud-config:/home/agy/.config/gcloud")
  fi

  echo "==> Launching container '${CONTAINER_NAME}' on port ${PORT}..."
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -p "${PORT}:3000" \
    -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -hex 32)}" \
    -e AUTH_TRUST_HOST="true" \
    -e GCP_PROJECT="${PROJECT_ID}" \
    -e GCP_REGION="${REGION}" \
    -e WORKSPACE_DIR="/workspace" \
    -e TARGET_APP_DIR="/workspace/target-app" \
    -e CONTROL_PLANE_DIR="/app/control-plane" \
    -e STORAGE_DIR="/app/storage" \
    -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
    -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
    -e ADMIN_USERNAME="${ADMIN_USERNAME}" \
    -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
    "${GCLOUD_VOL[@]}" \
    "${IMAGE_NAME}"

  echo "==> Waiting for Antigravity Console to become healthy on port ${PORT}..."
  MAX_RETRIES=30
  RETRY=0
  READY=false

  while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/login" --max-time 2 | grep -qE "200|307|308"; then
      READY=true
      break
    fi
    sleep 1
    RETRY=$((RETRY + 1))
    echo -n "."
  done
  echo ""

  if [ "$READY" = true ]; then
    echo "============================================================"
    echo " 🎉 Antigravity Console is LIVE locally!"
    echo "============================================================"
    echo " 🌐 Localhost URL:    http://localhost:${PORT}"
    echo " 💻 Workstation URL:  http://${HOST_FQDN}:${PORT}"
    echo " 🔑 Credentials:      ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}"
    if [ "$ADMIN_PASSWORD_SOURCE" = "generated" ]; then
      echo "                      (generated for this run; set ADMIN_PASSWORD"
      echo "                       in .env to keep it stable across restarts)"
    fi
    echo ""
    echo " Useful Commands:"
    echo "   View logs:        ./run-local.sh logs"
    echo "   Inspect status:   ./run-local.sh status"
    echo "   Container shell:  ./run-local.sh exec"
    echo "   Stop container:   ./run-local.sh stop"
    echo "============================================================"
  else
    echo "❌ Server did not respond within ${MAX_RETRIES} seconds."
    echo "Container logs:"
    docker logs --tail 40 "${CONTAINER_NAME}"
    exit 1
  fi
}

cmd_logs() {
  docker logs -f "${CONTAINER_NAME}"
}

cmd_exec() {
  docker exec -it "${CONTAINER_NAME}" /bin/bash
}

# Main routing
case "${1:-}" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_stop
    cmd_start
    ;;
  status)
    cmd_status
    ;;
  logs)
    cmd_logs
    ;;
  exec)
    cmd_exec
    ;;
  *)
    usage
    exit 1
    ;;
esac
