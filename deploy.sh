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

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load local configuration if present. See .env.template for every supported
# variable. Precedence: CLI argument > exported shell variable > .env > default.
# shellcheck source=scripts/load-env.sh
. "$SCRIPT_DIR/scripts/load-env.sh"
# shellcheck source=scripts/gcp-common.sh
. "$SCRIPT_DIR/scripts/gcp-common.sh"
load_env_file "$SCRIPT_DIR/.env"

# Configuration. Resolution order: CLI argument > environment / .env > gcloud.
PROJECT_ID="${1:-${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${2:-${GCP_REGION:-us-east4}}"
REPO_NAME="${REPO_NAME:-antigravity-runners}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Error: no Google Cloud project resolved." >&2
  echo "Set one of the following:" >&2
  echo "  * GCP_PROJECT in .env        (cp .env.template .env)" >&2
  echo "  * the first argument         ./deploy.sh <PROJECT_ID> [REGION]" >&2
  echo "  * your active gcloud config  gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

echo "=========================================================="
echo " Deploying Antigravity Swarm & Console to Google Cloud Run"
echo " Project: $PROJECT_ID | Region: $REGION"
echo "=========================================================="

# 1. Enable Required GCP APIs
echo "--> Enabling Google Cloud APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    aiplatform.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    --project="$PROJECT_ID"

# 2. Ensure Artifact Registry repository exists
echo "--> Verifying Artifact Registry repository..."
gcloud artifacts repositories describe "$REPO_NAME" \
    --location="$REGION" \
    --project="$PROJECT_ID" >/dev/null 2>&1 || \
gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Antigravity runners" \
    --project="$PROJECT_ID"

REPO_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"

# 3. Build & Push Backend Swarm Container
# Context is the repo root so swarm-src/ and control-plane/ are shared.
ensure_cloud_build_permissions "$PROJECT_ID"
echo "--> Building and pushing Backend Swarm Runner image..."
gcloud builds submit . \
    --config=cloudbuild.backend.yaml \
    --substitutions="_IMAGE=$REPO_URI/backend:latest" \
    --project="$PROJECT_ID"

# 4. Build & Push Frontend Console Container
echo "--> Building and pushing Frontend Console UI image..."
gcloud builds submit . \
    --config=cloudbuild.frontend.yaml \
    --substitutions="_IMAGE=$REPO_URI/frontend:latest" \
    --project="$PROJECT_ID"

# 5. Apply Terraform Infrastructure
#
# nextauth_secret and admin_password have no defaults on purpose, so something
# has to supply them or `terraform apply -auto-approve` will stop and prompt.
# TF_VAR_* is used rather than -var deliberately: it has the LOWEST precedence
# of terraform's input methods, so a terraform.tfvars file (copied from
# terraform.tfvars.template and gitignored) still wins. These are only exported
# when the environment actually provides a value, leaving terraform free to
# read the tfvars file otherwise.
if [ -n "${NEXTAUTH_SECRET:-}" ]; then
  export TF_VAR_nextauth_secret="$NEXTAUTH_SECRET"
fi
if [ -n "${ADMIN_USERNAME:-}" ]; then
  export TF_VAR_admin_username="$ADMIN_USERNAME"
fi
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  export TF_VAR_admin_password="$ADMIN_PASSWORD"
fi

echo "--> Applying Terraform deployment..."
cd terraform
terraform init
terraform apply -auto-approve \
    -var="project_id=$PROJECT_ID" \
    -var="region=$REGION"

# 6. Force Cloud Run to deploy new revisions with latest image digest
echo "--> Deploying new revisions with latest container digests..."
gcloud run services update antigravity-console-ui \
    --image="$REPO_URI/frontend:latest" \
    --region="$REGION" \
    --project="$PROJECT_ID"

gcloud run jobs update antigravity-swarm-runner \
    --image="$REPO_URI/backend:latest" \
    --region="$REGION" \
    --project="$PROJECT_ID"

echo "=========================================================="
echo " Deployment Complete!"
echo " Next.js Console URL: $(terraform output -raw console_ui_url)"
echo " Swarm Job Name:     $(terraform output -raw swarm_runner_job_name)"
echo " Default Login:      $(terraform output -raw admin_username 2>/dev/null || echo admin) / (the admin_password you configured)"
echo "=========================================================="
