# Antigravity Swarms in Google Cloud Run

[![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Cloud%20Run%20Gen2-blue)](https://cloud.google.com/run)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Backend-Google%20Antigravity%20SDK-green)](https://ai.google.dev/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-purple)](https://www.terraform.io/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Reference implementation for running **modular, multi-agent AI engineering swarms** using the **Google Antigravity (`agy`) SDK** and **Agent Skills** inside **remote Google Cloud Run sandboxes**.

This architecture includes a secured **Next.js Web Console** equipped with **OAuth + Credentials authentication** and an interactive **Linux Web Terminal** (`xterm.js` + `node-pty`) to live-inspect generated Terraform infrastructure, test artifacts, and codebase diffs.

---

## Architecture Overview

```
                      [ Client & Ingestion Layer ]
                        │                     │
                (Browser → console)      (Automated: Scheduler/CLI)
                        ▼                     ▼
             ┌─────────────────────┐   ┌───────────────────────────┐
             │ Cloud Run Instance  │   │      Cloud Run Job        │
             │   Next.js Console   │──▶│ Antigravity Swarm Runner  │
             │  (OAuth + Web PTY)  │   │ (Multi-Agent Coordinator) │
             └──────────┬──────────┘   └─────────────┬─────────────┘
                        │                            │
           (Path A: runs in-instance)  (Path B: dispatch batch job)
                        │                            ▼
                        │              ┌───────────────────────────┐
                        │              │   Lead Orchestrator       │
                        │              │   (orchestrator.md)       │
                        │              └─────────────┬─────────────┘
                        │                            │
                        │              (Parallel Asynchronous Dispatch)
                        │                            ▼
                        │             ┌─────────────────────────────┐
                        │             │   Concurrent Subagents      │
                        │             │ • Backend Implementer       │
                        │             │ • Frontend Implementer      │
                        │             │ • Test Engineer (curl)      │
                        │             │ • Terraform IaC Engineer    │
                        │             └──────────────┬──────────────┘
                        │                            │
                        │             (Zero-Token Terminal Verification)
                        │                            ▼
                        │             ┌─────────────────────────────┐
                        │             │  Deterministic Quality Gate │
                        │             │ • tsc / type-check          │
                        │             │ • bash tests/smoke.sh (curl)│
                        │             │ • terraform validate        │
                        │             └──────────────┬──────────────┘
                        │                            │
                        ▼                            ▼
            ┌────────────────────────────────────────────────────────┐
            │       Output Plane (/workspace/target-app)             │
            │  ├── shared/types.ts    (Read-Only Data Contract)      │
            │  ├── server/            (Backend Subagent Scope)       │
            │  ├── client/            (Frontend Subagent Scope)      │
            │  ├── tests/              (Test Engineer Scope)          │
            │  └── infra/terraform/   (Terraform IaC Scope)          │
            └────────────────────────────────────────────────────────┘
```

---

## Key Pillars from the Antigravity Swarm Pattern

1. **Control Plane vs. Output Plane Separation**:
   * **Control Plane (`control-plane/`)**: The swarm's *instructions* — `orchestrator.md`, the modular subagent contracts, and the agent skills. This is the input the harness reads to decide which subagents to dispatch and which directory subtree each one is allowed to write to. It lands at `/app/control-plane` in both images, and the harness only ever reads from it: it is an input, not a workspace. Keeps prompt engineering out of customer repositories.
   * **Both images carry it, because either one can start a run.** The backend image runs the swarm headless (`python3 /app/src/main.py`). The console image ships the same `swarm-src/` harness plus the `swarm` CLI on `PATH`, so a run can be launched straight from the web terminal without a backend service deployed at all. Both resolve the same `CONTROL_PLANE_DIR=/app/control-plane`, which is why `swarm-src/config.py` needs no per-image branching.
   * **Output Plane (`/workspace/target-app/`)**: The active workspace where code and Terraform are authored, compiled, and tested.
2. **Strict Sub-Tree Scoping**:
   * Each subagent is locked to its directory subtree (Backend $\to$ `/server/`, Frontend $\to$ `/client/`, Tests $\to$ `/tests/`, Terraform $\to$ `/infra/terraform/`).
   * Eliminates race conditions and merge collisions during parallel execution.
3. **Asymmetric Verification Pipeline**:
   * **Deterministic Gates First (Zero Token Cost)**: Before any LLM auditor is invoked, the container runs `npm run type-check`, the `curl` smoke suite (`tests/smoke.sh`), and `terraform validate` directly in the terminal.
   * **Targeted Semantic Checkers**: Security auditing and transparency explainers only run after deterministic tests achieve a 100% pass rate.
4. **Cloud Run Gen 2 MicroVM Sandbox**:
   * Uses Cloud Run Execution Environment Gen 2 (`--execution-environment=gen2`) for full Linux system call compatibility and fast NVMe disk I/O.
   * The image deliberately ships **no headless browser**. Verification is `curl`-based, which keeps the container small and leaves CPU and memory for the agents rather than for Chromium.

---

## Directory Structure

```
antigravity-in-cloudrun/
├── README.md                      # Repository documentation & guide
├── LICENSE                        # Apache License 2.0
├── .env.template                  # Documented environment variables (copy to .env)
│
├── control-plane/                 # SHARED — the swarm's instructions. Baked into BOTH images.
│   ├── orchestrator.md            # Master Orchestrator Playbook (Stages 0-5)
│   ├── agents/                    # Subagent contracts (.md)
│   │   ├── backend_implementer.md
│   │   ├── frontend_implementer.md
│   │   ├── test_engineer.md
│   │   ├── iac_engineer.md        # Terraform IaC Subagent
│   │   ├── security_checker.md
│   │   └── transparency_explainer.md
│   └── skills/                    # Domain Skills (Agent Skills Spec)
│       └── terraform_validator/
│           └── SKILL.md
│
├── swarm-src/                     # SHARED — the Antigravity SDK harness. Baked into BOTH images.
│   ├── main.py                    # FastAPI API server & job runner CLI
│   ├── config.py                  # Environment & Vertex AI configuration
│   └── hooks.py                   # Lifecycle hooks for token tracking & audit logs
│
├── backend/                       # Headless swarm service image
│   ├── Dockerfile                 # Minimal Cloud Run container (curl + Terraform, no browser)
│   └── requirements.txt           # Python dependencies (google-antigravity, fastapi)
│
├── frontend/                      # Next.js Web Console & Linux Terminal image
│   ├── Dockerfile                 # Multi-stage build with node-pty; also copies the shared dirs
│   ├── package.json               # Next.js 14, NextAuth, xterm.js, node-pty, ws
│   ├── server.js                  # Custom server with WebSocket Linux PTY gateway
│   ├── bin/swarm                  # CLI that launches a swarm run from inside the console
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Dashboard view
│       │   ├── login/page.tsx     # OAuth + Credentials Login
│       │   ├── terminal/page.tsx  # Linux Web Terminal view
│       │   └── api/               # swarm, swarm/reset, assets, assets/reset, auth
│       ├── components/            # ConsoleDashboard, SwarmVisualizer, WebTerminal,
│       │                          # AgentExecutionPanel, AssetBrowser, HowToUsePanel
│       └── lib/auth.ts            # NextAuth credential options
│
├── docs/
│   ├── ARCHITECTURE.md            # Deep dive into multi-agent swarms
│   ├── CLOUD_RUN_GUIDE.md         # Sandbox Gen 1 vs Gen 2, sizing & IAM
│   └── OAUTH_SETUP.md             # Google OAuth 2.0 / SSO configuration guide
│
├── scripts/
│   ├── gcp-common.sh              # Shared gcloud helpers
│   ├── load-env.sh                # .env loader used by the deploy scripts
│   └── patch_agent_contracts.py   # Rewrites agent contract write scopes
│
├── vanilla-dashboard/             # Glassmorphic Vanilla CSS/JS Dashboard (Zero Build Step)
│   ├── index.html                 # App shell with ambient glow orbs & stage stepper
│   ├── styles.css                 # Vanilla CSS glassmorphic design system
│   ├── app.js                     # Vanilla JS terminal emulator & swarm dispatcher
│   └── README.md                  # Quickstart guide (open directly in browser)
│
├── terraform/                     # Infrastructure as Code to deploy on GCP
│   ├── main.tf                    # Cloud Run Service, Cloud Run Job, IAM, Artifact Registry
│   ├── variables.tf
│   ├── outputs.tf
│   ├── versions.tf
│   └── terraform.tfvars.template
│
├── deploy.sh                      # Deploys the Cloud Run *service*
├── deploy-instance.sh             # Deploys a Cloud Run *instance* (Gen 2 MicroVM + sandbox launcher)
├── run-local.sh                   # Runs the console image locally under Docker
├── cloudbuild.backend.yaml        # Build context is the repo root (see note below)
└── cloudbuild.frontend.yaml       # Build context is the repo root (see note below)
```

> **Why `control-plane/` and `swarm-src/` sit at the repository root**
>
> Both are build inputs to **both** images, so neither can live inside `backend/`
> or `frontend/`. Both Cloud Build configs therefore use the **repository root**
> as the Docker build context rather than a per-service subdirectory, and each
> Dockerfile copies the two shared directories in by path. That keeps a single
> source of truth: edit an agent contract once and both images pick it up on the
> next build, with no syncing step and no way for the two to drift apart.

---

## Authentication & Access

The Web Terminal UI is protected by **NextAuth.js** with dual authentication options:

1. **Built-in Admin Credentials (Ready Out-of-the-Box):**
   * **Username**: `ADMIN_USERNAME`, defaulting to `admin`
   * **Password**: `ADMIN_PASSWORD`. There is no default. Leave it unset and the deploy scripts generate one per deployment and print it once in their closing summary; set it in `.env` to pin a value of your own.
   * **Role**: `admin-role`

   > There is deliberately no shipped password. The console is served on a public endpoint, so a password published in this repository would be a documented way in rather than a credential. If `ADMIN_PASSWORD` is unset in production the application disables password sign-in altogether instead of falling back to a default, leaving Google OAuth as the only route in.
2. **Google Cloud OAuth 2.0 / SSO:**
   * Supported via Google Cloud Identity and Google Accounts.
   * Requires provisioning an **OAuth 2.0 Web Client ID** in Google Cloud Console and supplying `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
   * For the step-by-step setup guide (consent screen, redirect URIs, and troubleshooting), see **[docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md)**.

---

## Quickstart

### 1. Configuration

Every script reads its settings from a `.env` file at the repository root. Start
from the documented template:

```bash
cp .env.template .env
# then edit .env and set at minimum GCP_PROJECT
```

`.env` is gitignored and must never be committed. `.env.template` is the tracked
copy and documents every supported variable, so keep real values out of it.

Settings resolve strongest-first:

| Source | Example |
| --- | --- |
| Command-line argument | `./deploy-instance.sh my-project us-east4` |
| Exported shell variable | `BUCKET_NAME=other ./deploy-instance.sh` |
| `.env` file | `GCP_PROJECT=my-project` |
| Built-in default | `GCP_REGION` falls back to `us-east4` |

If no project is resolved from any of these, the scripts fall back to your
active `gcloud config` and abort with an error if that is unset too. There is no
hardcoded project default.

For Terraform, do the same with its own template:

```bash
cd terraform
cp terraform.tfvars.template terraform.tfvars
# set project_id and nextauth_secret (openssl rand -hex 32)
```

> **Secrets:** `NEXTAUTH_SECRET` signs session cookies. Leave it blank in `.env`
> and the deploy scripts generate a fresh one per deployment. Never commit a
> real value — a published signing key lets anyone forge an admin session
> without needing the password.

### 2. Local Development

**Run the Backend Swarm Runner:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python src/main.py --mode=cli --target-dir=../workspace/target-app
```

**Run the Next.js Terminal Console:**
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

### 3. Deploy as a Dedicated Cloud Run Instance (Recommended for Personal Swarms)

Deploy as a persistent, singleton **Cloud Run Instance** with **Cloud Run Sandbox** launcher and persistent Cloud Storage volume mount:
```bash
chmod +x deploy-instance.sh
./deploy-instance.sh YOUR_GCP_PROJECT_ID us-east4
```

> [!NOTE]
> **Tech Preview & GCP Console Visibility:**
> Cloud Run Instances (`gcloud beta run instances`) are currently in **Tech Preview** and **do NOT appear in the standard GCP Cloud Run Console web UI**. You manage their lifecycle and retrieve their live HTTPS URL exclusively via the CLI:
> ```bash
> # Get the instance HTTPS URL
> gcloud beta run instances describe antigravity-console-instance \
>   --region=us-east4 \
>   --project=YOUR_GCP_PROJECT_ID \
>   --format='value(urls)'
> ```
> **Reminder:** Because the instance is not visible on the standard Cloud Run Console dashboard and runs continuously 24/7 (no auto-scaling to zero), **always remember to delete the instance via CLI after completing your tests** (see [Resource Cleanup & Cost Management](#resource-cleanup--cost-management) below).

### 4. Deploy as a Multi-Tenant Cloud Run Service & Batch Job

Deploy using the full multi-tier script (Service + Batch Job):
```bash
chmod +x deploy.sh
./deploy.sh YOUR_GCP_PROJECT_ID us-east4
```

Or deploy using Terraform:
```bash
cd terraform
terraform init
terraform apply -var="project_id=YOUR_GCP_PROJECT_ID"
```

---

## Troubleshooting

### Cloud Build fails with a 403 on its own source tarball

```
ERROR: (gcloud.builds.submit) INVALID_ARGUMENT: could not resolve source:
Error 403: <project-number>-compute@developer.gserviceaccount.com does not have
storage.objects.get access to the Google Cloud Storage object ...
```

Cloud Build runs as the **Compute Engine default service account**. Most projects
never notice, because that account is granted Editor automatically when the
project is created. Organizations that enforce
`constraints/iam.automaticIamGrantsForDefaultServiceAccounts` turn that grant
off, so on a new project the account has no roles at all and the build is
rejected before it starts.

The message names Cloud Storage, which sends you looking at bucket permissions,
but the fix is an IAM role on the build identity. The deploy scripts detect and
repair this automatically. If you lack permission to set IAM policy, ask an
administrator to run:

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_GCP_PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"
```

### The instance deploys, then serves 404

Usually the container exited at startup because the Cloud Storage FUSE mount
failed, and Cloud Run has nothing to route to. The common cause is the runtime
service account lacking `roles/storage.objectAdmin` on the workspace bucket.

Order matters: grant bucket access **before** the instance runs as that
identity. `deploy-instance.sh` does this in the correct order; if you switch the
service account by hand, grant the bucket binding first. Confirm with:

```bash
gcloud beta run instances logs read antigravity-console-instance \
  --region=us-east4 --project=YOUR_GCP_PROJECT_ID
```

### `Capacity exhausted` when creating the instance

Cloud Run instances and sandboxes are a Tech Preview with limited regional
capacity. `us-central1` has returned this error while `us-east4` succeeded. Set
`GCP_REGION` in `.env` to try another region.

---

## Resource Cleanup & Cost Management

> [!WARNING]
> **Reminder: Always Delete Your Cloud Run Instance After Testing!**
> Because Cloud Run Instances are a **Tech Preview** feature that **does not appear in the standard GCP Console UI**, it is easy to forget that an instance is running in the background. Unlike standard Cloud Run Services that scale down to 0 instances ($0 idle compute cost), a **Cloud Run Instance** is an active, continuous singleton compute runtime that bills 24/7 for allocated vCPU and RAM until explicitly stopped or deleted.

### 1. Delete the Dedicated Cloud Run Instance (Recommended After Testing)

Because all generated code, Terraform plans, and agent artifacts are stored on a persistent Google Cloud Storage volume (`gs://YOUR_PROJECT_ID-antigravity-artifacts` mounted to `/workspace`), deleting the instance **does NOT lose any work or code**:

```bash
# Delete the singleton instance after completing your tests
gcloud beta run instances delete antigravity-console-instance \
  --region=us-east4 \
  --project=YOUR_GCP_PROJECT_ID \
  --quiet
```

**Verify that the instance has been completely removed:**
```bash
gcloud beta run instances list --project=YOUR_GCP_PROJECT_ID
# Output should show: Listed 0 items.
```

Whenever you want to start a new prototyping session, re-running `./deploy-instance.sh YOUR_GCP_PROJECT_ID us-east4` re-attaches to your existing Cloud Storage bucket and launches the console in **~15 seconds**.

### 2. Complete Environment Teardown

If you deployed the multi-tenant Cloud Run Service, Job, or Artifact Registry images and want to tear down all cloud resources:

```bash
# Delete Cloud Run Service (if deployed)
gcloud run services delete antigravity-console \
  --region=us-east4 \
  --project=YOUR_GCP_PROJECT_ID \
  --quiet

# Delete Cloud Run Job (if deployed)
gcloud run jobs delete antigravity-swarm-runner \
  --region=us-east4 \
  --project=YOUR_GCP_PROJECT_ID \
  --quiet

# Delete Artifact Registry repository (optional)
gcloud artifacts repositories delete antigravity-runners \
  --location=us-east4 \
  --project=YOUR_GCP_PROJECT_ID \
  --quiet

# Delete Cloud Storage artifacts bucket (Warning: permanently removes generated code)
# gcloud storage rm -r gs://YOUR_GCP_PROJECT_ID-antigravity-artifacts
```

If deployed via Terraform:
```bash
cd terraform
terraform destroy -var="project_id=YOUR_GCP_PROJECT_ID"
```

---

## References & Credits

* Based on the architectural blueprint by Gabriel Bechara:  
  [Mastering Agent Swarms: How to Build Modular Multi-Agent Systems in Google Antigravity](https://medium.com/google-cloud/mastering-agent-swarms-how-to-build-modular-multi-agent-systems-in-google-antigravity-f35ddf34cbb9)
* [Introducing Cloud Run instances](https://cloud.google.com/blog/products/serverless/introducing-cloud-run-instances) (Google Cloud Blog)
* [Safely run AI-generated code in Cloud Run sandboxes](https://cloud.google.com/blog/topics/developers-practitioners/google-cloud-run-sandboxes-are-in-public-preview) (Google Cloud Blog)
* [Google Antigravity SDK Specification](https://ai.google.dev/)
* [Agent Skills Specification](https://agentskills.io/)

---

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
