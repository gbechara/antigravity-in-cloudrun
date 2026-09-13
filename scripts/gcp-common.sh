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
#
# Shared Google Cloud helpers for the deployment scripts.

# Ensures the identity Cloud Build runs as can actually run a build.
#
# Cloud Build executes as the Compute Engine default service account. Most
# projects get away with ignoring this because that account is granted Editor
# automatically at project creation. Organisations that enforce
#
#     constraints/iam.automaticIamGrantsForDefaultServiceAccounts
#
# switch that automatic grant off, so the account is created with no roles at
# all. The failure this produces is genuinely confusing: the build is rejected
# before it starts with a 403 saying the compute service account cannot read
# the source tarball that `gcloud builds submit` has just uploaded on its
# behalf, which reads like a Cloud Storage problem rather than an IAM one.
#
# roles/cloudbuild.builds.builder is the role Google documents for this: it
# covers reading the uploaded source, writing logs, and pushing to Artifact
# Registry.
#
# Usage: ensure_cloud_build_permissions <project_id>
ensure_cloud_build_permissions() {
  local project_id="$1"
  local project_number compute_sa

  project_number="$(gcloud projects describe "$project_id" --format='value(projectNumber)' 2>/dev/null || true)"
  if [ -z "$project_number" ]; then
    echo "    Warning: could not resolve the project number; skipping the" >&2
    echo "    Cloud Build permission check." >&2
    return 0
  fi
  compute_sa="${project_number}-compute@developer.gserviceaccount.com"

  if gcloud projects get-iam-policy "$project_id" \
        --flatten="bindings[].members" \
        --filter="bindings.members:serviceAccount:${compute_sa} AND bindings.role:roles/cloudbuild.builds.builder" \
        --format="value(bindings.role)" 2>/dev/null | grep -q .; then
    return 0
  fi

  echo "--> Granting Cloud Build permissions to the compute service account..."
  echo "    ($compute_sa has no builder role; this project's organization"
  echo "     disables the automatic grant to default service accounts.)"
  if gcloud projects add-iam-policy-binding "$project_id" \
      --member="serviceAccount:${compute_sa}" \
      --role="roles/cloudbuild.builds.builder" \
      --condition=None \
      --quiet >/dev/null 2>&1; then
    # IAM is eventually consistent and a build submitted immediately after the
    # binding lands is still rejected.
    echo "    Waiting for the binding to propagate..."
    sleep 15
  else
    echo "" >&2
    echo "    Could not add the binding. You probably lack" >&2
    echo "    resourcemanager.projects.setIamPolicy on $project_id." >&2
    echo "    Ask an administrator to run:" >&2
    echo "" >&2
    echo "      gcloud projects add-iam-policy-binding $project_id \\" >&2
    echo "        --member=serviceAccount:${compute_sa} \\" >&2
    echo "        --role=roles/cloudbuild.builds.builder" >&2
    echo "" >&2
  fi
}
