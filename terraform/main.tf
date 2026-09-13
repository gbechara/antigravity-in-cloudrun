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

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Artifact Registry for Container Images
resource "google_artifact_registry_repository" "runners" {
  location      = var.region
  repository_id = "antigravity-runners"
  description   = "Docker repository for Antigravity Swarm and Console containers"
  format        = "DOCKER"
}

# 2. Service Account with Workload Identity (ADC)
resource "google_service_account" "swarm_runner" {
  account_id   = "antigravity-swarm-sa"
  display_name = "Antigravity Swarm Service Account"
}

# Grant Vertex AI access for Gemini models
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.swarm_runner.email}"
}

# Grant Cloud Logging access
resource "google_project_iam_member" "logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.swarm_runner.email}"
}

# 3. Cloud Storage Bucket for Persistent Reports and Artifacts
resource "google_storage_bucket" "artifacts" {
  name                        = "${var.project_id}-antigravity-artifacts"
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

resource "google_storage_bucket_iam_member" "artifacts_admin" {
  bucket = google_storage_bucket.artifacts.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.swarm_runner.email}"
}

# 4. Cloud Run Job: Ephemeral Antigravity Swarm Runner (Batch)
resource "google_cloud_run_v2_job" "swarm_runner" {
  name     = "antigravity-swarm-runner"
  location = var.region

  template {
    template {
      service_account       = google_service_account.swarm_runner.email
      execution_environment = "EXECUTION_ENVIRONMENT_GEN2"
      timeout               = "3600s"

      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.runners.repository_id}/backend:latest"
        args  = ["--mode=cli"]

        # Sized for compilers and terraform, not for browsers. This was
        # 4 vCPU / 16Gi when the quality gate ran parallel headless Chromium
        # instances; curl-based verification removed that floor. Raise it again
        # if you reintroduce browser testing or target a very large codebase.
        resources {
          limits = {
            cpu    = "2000m"
            memory = "4Gi"
          }
        }

        env {
          name  = "GCP_PROJECT"
          value = var.project_id
        }
        env {
          name  = "GCP_REGION"
          value = var.region
        }
        env {
          name  = "ARTIFACT_BUCKET"
          value = google_storage_bucket.artifacts.name
        }
      }
    }
  }
}

# 5. Cloud Run Service: Next.js Console & Web Terminal (Interactive)
resource "google_cloud_run_v2_service" "console_ui" {
  name     = "antigravity-console-ui"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account       = google_service_account.swarm_runner.email
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.runners.repository_id}/frontend:latest"

      resources {
        limits = {
          cpu    = "2000m"
          memory = "4Gi"
        }
        startup_cpu_boost = true
      }

      ports {
        container_port = 3000
      }

      env {
        name  = "NEXTAUTH_SECRET"
        value = var.nextauth_secret
      }
      env {
        name  = "ADMIN_USERNAME"
        value = var.admin_username
      }
      env {
        name  = "ADMIN_PASSWORD"
        value = var.admin_password
      }
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }
      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "ARTIFACT_BUCKET"
        value = google_storage_bucket.artifacts.name
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "GOOGLE_CLIENT_SECRET"
        value = var.google_client_secret
      }
    }
  }
}

# Allow unauthenticated access to the Web Console (protected internally by NextAuth)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = google_cloud_run_v2_service.console_ui.project
  location = google_cloud_run_v2_service.console_ui.location
  name     = google_cloud_run_v2_service.console_ui.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
