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

variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID"
}

variable "region" {
  type        = string
  description = "Google Cloud region for deployment. Cloud Run instances and sandboxes are a Tech Preview with limited regional capacity; us-east4 is known to work."
  default     = "us-east4"
}

variable "nextauth_secret" {
  type        = string
  description = <<-EOT
    NextAuth session signing secret (min 32 chars). Intentionally has no
    default: a committed secret is a public secret and would let anyone forge
    an admin session. Generate one with `openssl rand -hex 32` and pass it via
    TF_VAR_nextauth_secret or a tfvars file that is not committed.
  EOT
  sensitive   = true

  validation {
    condition     = length(var.nextauth_secret) >= 32
    error_message = "nextauth_secret must be at least 32 characters."
  }
}

variable "admin_username" {
  type        = string
  description = "Username for the built-in credentials provider."
  default     = "admin"
}

variable "admin_password" {
  type        = string
  description = <<-EOT
    Password for the built-in credentials provider. Intentionally has no
    default: this console is served on a public endpoint, so a password
    published in the repository would be a documented way in rather than a
    credential. Generate one with `openssl rand -hex 12` and pass it via
    TF_VAR_admin_password or a tfvars file that is not committed.
  EOT
  sensitive   = true

  validation {
    condition     = length(var.admin_password) >= 12
    error_message = "admin_password must be at least 12 characters."
  }
}

variable "google_client_id" {
  type        = string
  description = "Optional Google OAuth Client ID for SSO"
  default     = ""
}

variable "google_client_secret" {
  type        = string
  description = "Optional Google OAuth Client Secret for SSO"
  default     = ""
  sensitive   = true
}
