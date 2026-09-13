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
# shellcheck source=scripts/gcp-common.sh
. "$SCRIPT_DIR/scripts/gcp-common.sh"
load_env_file "$SCRIPT_DIR/.env"

# Configuration. Resolution order: CLI argument > environment / .env > gcloud.
# There is deliberately no hardcoded project fallback; defaulting to someone
# else's project ID is never the helpful behaviour.
PROJECT_ID="${1:-${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${2:-${GCP_REGION:-us-east4}}"
INSTANCE_NAME="${INSTANCE_NAME:-antigravity-console-instance}"
REPO_NAME="${REPO_NAME:-antigravity-runners}"
# Override BUCKET_NAME to co-locate the workspace volume with the instance
# region; the default name is the Terraform-managed bucket, which may live in a
# different region than $REGION.
BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-antigravity-artifacts}"
# The swarm calls Vertex AI, which the default compute SA is not granted.
# This SA is created by Terraform and holds roles/aiplatform.user.
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-antigravity-swarm-sa@${PROJECT_ID}.iam.gserviceaccount.com}"
# Instance footprint. Set explicitly rather than relying on the gcloud
# defaults: those gave 2 GiB, which silently contradicted the 4 GiB documented
# in docs/CLOUD_RUN_GUIDE.md and configured in terraform/main.tf. These are the
# smallest values that comfortably run the example — size up for real
# workloads after measuring.
INSTANCE_CPU="${INSTANCE_CPU:-2}"
INSTANCE_MEMORY="${INSTANCE_MEMORY:-4Gi}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Error: no Google Cloud project resolved." >&2
  echo "Set one of the following:" >&2
  echo "  * GCP_PROJECT in .env        (cp .env.template .env)" >&2
  echo "  * the first argument         ./deploy-instance.sh <PROJECT_ID> [REGION]" >&2
  echo "  * your active gcloud config  gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

echo "===================================================================="
echo " 🚀 Deploying Antigravity Console as a Dedicated Cloud Run Instance"
echo " Project:  $PROJECT_ID"
echo " Region:   $REGION"
echo " Instance: $INSTANCE_NAME"
echo " Bucket:   gs://$BUCKET_NAME (Mounted to /workspace)"
echo " Sandbox:  Cloud Run Sandbox Launcher ENABLED (--sandbox-launcher)"
echo " Size:     $INSTANCE_CPU vCPU / $INSTANCE_MEMORY"
echo "===================================================================="

# 1. Enable Required GCP APIs
echo "--> Verifying Google Cloud APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    storage.googleapis.com \
    aiplatform.googleapis.com \
    --project="$PROJECT_ID"

# 2. Verify or create the runtime service account.
# The instance runs as this identity. Creating it here keeps this script
# self-contained: it must work on a brand-new project, without anyone having
# run the Terraform path first.
SA_EMAIL="$SERVICE_ACCOUNT"
SA_ID="${SA_EMAIL%%@*}"
echo "--> Checking runtime service account $SA_ID..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating service account $SA_ID..."
  gcloud iam service-accounts create "$SA_ID" \
      --display-name="Antigravity Swarm Runner" \
      --project="$PROJECT_ID"
  # Service account creation is eventually consistent; a binding applied too
  # soon is rejected because the principal does not resolve yet.
  echo "    Waiting for the service account to propagate..."
  for _ in $(seq 1 30); do
    if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

echo "--> Granting project-level roles to $SA_ID..."
for role in roles/aiplatform.user roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:$SA_EMAIL" \
      --role="$role" \
      --condition=None \
      --quiet >/dev/null
done

# 3. Verify or create Cloud Storage Bucket for persistent workspace volume
echo "--> Checking Cloud Storage workspace bucket..."
if ! gcloud storage buckets describe "gs://$BUCKET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating bucket gs://$BUCKET_NAME in $REGION..."
  gcloud storage buckets create "gs://$BUCKET_NAME" \
      --location="$REGION" \
      --project="$PROJECT_ID" \
      --uniform-bucket-level-access
fi

# Grant bucket access BEFORE the instance ever runs as this identity.
# Order matters: if the instance adopts the service account before the account
# can read the bucket, the gcsfuse mount fails, the container exits, and Cloud
# Run answers with a 404 that looks like a routing fault rather than a
# permissions one.
echo "--> Granting bucket access to $SA_ID..."
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.objectAdmin" \
    --project="$PROJECT_ID" >/dev/null

# 4. Verify Artifact Registry repository
REPO_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"
echo "--> Checking Artifact Registry repository $REPO_NAME..."
gcloud artifacts repositories describe "$REPO_NAME" \
    --location="$REGION" \
    --project="$PROJECT_ID" >/dev/null 2>&1 || \
gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Antigravity runners" \
    --project="$PROJECT_ID"

# 5. Build and Push Console Image using Cloud Build.
# Rebuilding is the default on purpose. This script deploys a publicly reachable
# endpoint, so silently reusing a stale `:latest` is the more dangerous failure:
# the deploy reports success while shipping none of your changes. Opt out
# explicitly with SKIP_BUILD=true when you only want to flip instance settings.
if [ "${SKIP_BUILD:-false}" = "true" ] && gcloud artifacts docker images describe "$REPO_URI/frontend:latest" >/dev/null 2>&1; then
  echo "--> SKIP_BUILD=true; reusing existing image: $REPO_URI/frontend:latest"
  echo "    WARNING: any local source changes are NOT included in this deploy."
else
  ensure_cloud_build_permissions "$PROJECT_ID"
  echo "--> Building and pushing Antigravity Console container image..."
  gcloud builds submit . \
      --config=cloudbuild.frontend.yaml \
      --substitutions="_IMAGE=$REPO_URI/frontend:latest" \
      --project="$PROJECT_ID"
fi

# 6. Resolve the session signing secret and the console credentials.
# Never hardcode either: a committed secret is a public secret, and anyone
# could forge an admin session -- or simply log in -- against every deployment
# that kept the default. Hex is used rather than base64 so the values cannot
# contain characters that would confuse gcloud's comma/equals-delimited
# --set-env-vars parsing.
# Note: the update path below does not touch env vars unless asked, so an
# existing instance keeps the secret it was created with and sessions survive
# redeploys.
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -hex 32)}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  ADMIN_PASSWORD_SOURCE="configured"
else
  ADMIN_PASSWORD="$(openssl rand -hex 12)"
  ADMIN_PASSWORD_SOURCE="generated"
fi
# Set below if an existing instance turns out to predate ADMIN_PASSWORD.
ADMIN_CREDS_BACKFILLED=false

# 7. Deploy or Update Cloud Run Instance with Sandbox Launcher and GCS Volume
echo "--> Deploying Cloud Run Instance ($INSTANCE_NAME)..."
if EXISTING_SPEC=$(gcloud beta run instances describe "$INSTANCE_NAME" --region="$REGION" --project="$PROJECT_ID" --format=json 2>/dev/null); then
  INSTANCE_ACTION="updated"
  echo "Updating existing Cloud Run Instance..."
  # --update-env-vars is additive: it rewrites only the keys it is given and
  # leaves the rest (including NEXTAUTH_SECRET) alone. Credentials are only
  # rewritten when they were set explicitly, so a plain redeploy never
  # silently changes the password an operator is already using.
  #
  # The exception is an instance that predates ADMIN_PASSWORD entirely. The
  # application disables password sign-in when the variable is missing, so
  # pushing the new image onto such an instance without backfilling a value
  # would lock out anyone who has not configured OAuth. Matching on the raw
  # JSON avoids depending on where in the resource schema env vars live.
  UPDATE_ENV_ARGS=()
  if [ "$ADMIN_PASSWORD_SOURCE" = "configured" ]; then
    echo "    Applying the configured ADMIN_USERNAME / ADMIN_PASSWORD."
    UPDATE_ENV_ARGS+=(--update-env-vars="ADMIN_USERNAME=$ADMIN_USERNAME,ADMIN_PASSWORD=$ADMIN_PASSWORD")
  elif ! printf '%s' "$EXISTING_SPEC" | grep -q "ADMIN_PASSWORD"; then
    echo "    This instance has no ADMIN_PASSWORD set (it predates the setting)."
    echo "    Backfilling a generated one so password sign-in keeps working."
    ADMIN_CREDS_BACKFILLED=true
    UPDATE_ENV_ARGS+=(--update-env-vars="ADMIN_USERNAME=$ADMIN_USERNAME,ADMIN_PASSWORD=$ADMIN_PASSWORD")
  fi
  gcloud beta run instances update "$INSTANCE_NAME" \
      --image="$REPO_URI/frontend:latest" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --service-account="$SERVICE_ACCOUNT" \
      --cpu="$INSTANCE_CPU" \
      --memory="$INSTANCE_MEMORY" \
      --sandbox-launcher \
      ${UPDATE_ENV_ARGS[@]+"${UPDATE_ENV_ARGS[@]}"}
else
  INSTANCE_ACTION="created"
  echo "Creating new singleton Cloud Run Instance..."
  echo "    Generated a fresh NEXTAUTH_SECRET for this instance."
  gcloud beta run instances create "$INSTANCE_NAME" \
      --image="$REPO_URI/frontend:latest" \
      --port=3000 \
      --public \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --service-account="$SERVICE_ACCOUNT" \
      --cpu="$INSTANCE_CPU" \
      --memory="$INSTANCE_MEMORY" \
      --sandbox-launcher \
      --add-volume="type=cloud-storage,bucket=$BUCKET_NAME,mount-path=/workspace,mount-options=uid=1001;gid=1001;file-mode=0777;dir-mode=0777" \
      --set-env-vars="GCP_PROJECT=$PROJECT_ID,GCP_REGION=$REGION,TARGET_APP_DIR=/workspace/target-app,WORKSPACE_DIR=/workspace,CONTROL_PLANE_DIR=/app/control-plane,STORAGE_DIR=/workspace/storage,NEXTAUTH_SECRET=$NEXTAUTH_SECRET,ADMIN_USERNAME=$ADMIN_USERNAME,ADMIN_PASSWORD=$ADMIN_PASSWORD,AUTH_TRUST_HOST=true"
fi

echo ""
echo "===================================================================="
echo " ✅ Cloud Run Instance Deployment Complete!"
echo " Instance Details:"
gcloud beta run instances describe "$INSTANCE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="table(name,status.conditions[0].status)"
# NOTE: instances expose status.urls (a LIST); status.url is always empty here.
INSTANCE_URL=$(gcloud beta run instances describe "$INSTANCE_NAME" \
    --region="$REGION" --project="$PROJECT_ID" --format='value(urls)')
echo " Instance URL: $INSTANCE_URL"
if [ "$INSTANCE_ACTION" = "created" ] || [ "$ADMIN_PASSWORD_SOURCE" = "configured" ] || [ "$ADMIN_CREDS_BACKFILLED" = "true" ]; then
  echo " Credentials:  $ADMIN_USERNAME / $ADMIN_PASSWORD"
  if [ "$ADMIN_PASSWORD_SOURCE" = "generated" ]; then
    echo ""
    echo " ^ This password was generated for this instance and is NOT stored"
    echo "   anywhere else. Save it now, or set ADMIN_PASSWORD in .env to pin"
    echo "   a value of your own."
  fi
else
  # The update path leaves env vars alone, so the instance still has whatever
  # credentials it was created with. Printing the value generated above would
  # be wrong.
  echo " Credentials:  unchanged (this instance keeps the credentials it was"
  echo "               created with). To rotate them, set ADMIN_PASSWORD and"
  echo "               re-run this script."
fi
echo "===================================================================="
