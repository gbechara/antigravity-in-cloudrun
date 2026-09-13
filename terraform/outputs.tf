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

output "artifact_registry_url" {
  description = "Docker repository URI"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.runners.repository_id}"
}

output "console_ui_url" {
  description = "Public URL of the Next.js Web Console and Terminal"
  value       = google_cloud_run_v2_service.console_ui.uri
}

output "swarm_runner_job_name" {
  description = "Name of the Cloud Run Job"
  value       = google_cloud_run_v2_job.swarm_runner.name
}

output "artifact_bucket" {
  description = "GCS bucket for swarm artifacts"
  value       = google_storage_bucket.artifacts.name
}

# The matching password is deliberately not an output. It is supplied by the
# operator, who therefore already has it, and emitting it would only copy a
# live credential into CI logs and terminal scrollback.
output "admin_username" {
  description = "Username for the built-in credentials provider"
  value       = var.admin_username
}
