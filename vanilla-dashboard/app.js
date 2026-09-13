/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Antigravity Swarm • Cloud Run Console (Vanilla ES6+ JS)
 */

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initTerminal();
  initAssetViewer();
  initSwarmDispatcher();
  initLogStream();
});

/* ==========================================================================
   1. NAVIGATION TABS CONTROLLER
   ========================================================================== */
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const activePane = document.getElementById(`tab-${targetTab}`);
      if (activePane) activePane.classList.add("active");

      // Auto-focus terminal input when switching to terminal tab
      if (targetTab === "terminal") {
        setTimeout(() => document.getElementById("termInput")?.focus(), 50);
      }
    });
  });
}

/* ==========================================================================
   2. INTERACTIVE LINUX WEB TERMINAL EMULATOR
   ========================================================================== */
function initTerminal() {
  const termBody = document.getElementById("terminalOutput");
  const termInput = document.getElementById("termInput");
  const clearBtn = document.getElementById("clearTermBtn");
  const restartBtn = document.getElementById("restartTermBtn");
  const shortcutChips = document.querySelectorAll(".shortcut-chip");

  let commandHistory = [];
  let historyIndex = -1;

  function appendLine(content, className = "term-line") {
    const line = document.createElement("div");
    line.className = className;
    line.innerHTML = content;
    termBody.appendChild(line);
    termBody.scrollTop = termBody.scrollHeight;
  }

  function executeCommand(cmdStr) {
    const rawCmd = cmdStr.trim();
    if (!rawCmd) return;

    commandHistory.push(rawCmd);
    historyIndex = commandHistory.length;

    // Echo input command line
    appendLine(
      `<span class="prompt-user">agy@cloudrun</span>:<span class="prompt-path">~/target-app</span><span class="prompt-sym">$</span> <span class="term-cmd">${rawCmd}</span>`
    );

    const parts = rawCmd.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (command) {
      case "help":
        appendLine(`<span class="term-yellow">Available Commands:</span>`);
        appendLine(`  <span class="term-cyan">ls [-la]</span>                     List target-app directory contents`);
        appendLine(`  <span class="term-cyan">cat &lt;file&gt;</span>                  Inspect file contents (e.g. cat infra/terraform/main.tf)`);
        appendLine(`  <span class="term-cyan">terraform validate</span>           Execute Stage 3 deterministic Terraform check`);
        appendLine(`  <span class="term-cyan">bash tests/smoke.sh</span>         Execute curl-based HTTP smoke tests`);
        appendLine(`  <span class="term-cyan">npm run type-check</span>           Execute TypeScript compiler check`);
        appendLine(`  <span class="term-cyan">status</span>                       Display active swarm orchestration state`);
        appendLine(`  <span class="term-cyan">run / dispatch</span>               Trigger Antigravity swarm execution cycle`);
        appendLine(`  <span class="term-cyan">pwd / whoami</span>                 Display user session identity`);
        appendLine(`  <span class="term-cyan">clear</span>                        Clear terminal window`);
        break;

      case "clear":
        termBody.innerHTML = "";
        break;

      case "whoami":
        appendLine(`agy (UID: 1001, GID: 1001) [Non-root Container Process]`);
        break;

      case "pwd":
        appendLine(`/workspace/target-app`);
        break;

      case "ls":
        if (args.includes("-l") || args.includes("-la")) {
          appendLine(`total 48`);
          appendLine(`drwxr-xr-x 6 agy agy 4096 Sep 11 08:00 <span class="term-cyan">.</span>`);
          appendLine(`drwxr-xr-x 3 agy agy 4096 Sep 11 07:30 <span class="term-cyan">..</span>`);
          appendLine(`drwxr-xr-x 2 agy agy 4096 Sep 11 07:55 <span class="term-cyan">client/</span>        [Frontend Write Scope]`);
          appendLine(`drwxr-xr-x 2 agy agy 4096 Sep 11 07:55 <span class="term-cyan">server/</span>        [Backend Write Scope]`);
          appendLine(`drwxr-xr-x 2 agy agy 4096 Sep 11 07:55 <span class="term-cyan">shared/</span>        [Read-Only Data Contract]`);
          appendLine(`drwxr-xr-x 3 agy agy 4096 Sep 11 07:56 <span class="term-cyan">tests/</span>         [Test Engineer Scope]`);
          appendLine(`drwxr-xr-x 2 agy agy 4096 Sep 11 07:56 <span class="term-cyan">infra/terraform/</span> [Terraform IaC Scope]`);
          appendLine(`-rw-r--r-- 1 agy agy  742 Sep 11 07:50 package.json`);
          appendLine(`-rw-r--r-- 1 agy agy  512 Sep 11 07:50 tsconfig.json`);
        } else {
          appendLine(`<span class="term-cyan">client/  server/  shared/  tests/  infra/  package.json  tsconfig.json</span>`);
        }
        break;

      case "status":
        appendLine(`<span class="term-cyan">Lead Orchestrator Status:</span> <span class="term-green">ACTIVE (Stage 3 Gate)</span>`);
        appendLine(`Active Subagents: 6 | Sandbox Mode: Cloud Run Gen2 MicroVM`);
        appendLine(`Memory Usage: 0.9 GiB / 4 GiB | Verification: curl (no browser)`);
        break;

      case "cat":
        if (!args) {
          appendLine(`<span class="term-red">cat: missing file operand</span>`);
        } else if (args.includes("main.tf")) {
          appendLine(fileContents["main.tf"].replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        } else if (args.includes("types.ts")) {
          appendLine(fileContents["types.ts"].replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        } else if (args.includes("routes.ts")) {
          appendLine(fileContents["routes.ts"].replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        } else {
          appendLine(`<span class="term-green"># Displaying content of ${args}</span>\n// [Asset loaded into memory]`);
        }
        break;

      case "terraform":
        if (args.includes("validate")) {
          appendLine(`<span class="term-cyan">Running: terraform init -backend=false && terraform validate</span>`);
          setTimeout(() => {
            appendLine(`<span class="term-green">Success! The configuration is valid.</span>`);
            appendLine(`0 errors, 0 warnings. (TFLint passed)`);
          }, 300);
        } else {
          appendLine(`Terraform v1.9.5 (Google Cloud Provider v5.30)`);
        }
        break;

      case "npx":
        if (args.includes("smoke")) {
          appendLine(`<span class="term-cyan">Running: BASE_URL=http://localhost:3000 bash tests/smoke.sh</span>`);
          setTimeout(() => {
            appendLine(`Running 3 tests using 2 workers`);
            appendLine(`  <span class="term-green">✓</span> GET  /api/invites            200`);
            appendLine(`  <span class="term-green">✓</span> POST /api/invites            201`);
            appendLine(`  <span class="term-green">✓</span> POST /api/invites (duplicate) 409`);
            appendLine(`<span class="term-green">  3 passed (2.4s)</span>`);
          }, 600);
        } else {
          appendLine(`npx command executed.`);
        }
        break;

      case "npm":
        if (args.includes("type-check")) {
          appendLine(`<span class="term-cyan">Running: tsc --noEmit</span>`);
          setTimeout(() => {
            appendLine(`<span class="term-green">✓ TypeScript check passed with 0 errors.</span>`);
          }, 300);
        } else {
          appendLine(`npm v10.8.2`);
        }
        break;

      case "run":
      case "dispatch":
        triggerSwarmExecution();
        break;

      default:
        appendLine(`<span class="term-red">bash: ${command}: command not found. Type 'help' for available commands.</span>`);
        break;
    }
  }

  // Handle Input Keypresses
  termInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const cmd = termInput.value;
      termInput.value = "";
      executeCommand(cmd);
    } else if (e.key === "ArrowUp") {
      if (historyIndex > 0) {
        historyIndex--;
        termInput.value = commandHistory[historyIndex] || "";
      }
    } else if (e.key === "ArrowDown") {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        termInput.value = commandHistory[historyIndex] || "";
      } else {
        historyIndex = commandHistory.length;
        termInput.value = "";
      }
    }
  });

  clearBtn.addEventListener("click", () => {
    termBody.innerHTML = "";
  });

  restartBtn.addEventListener("click", () => {
    termBody.innerHTML = "";
    appendLine(`Session reset. Reconnected to bash instance under user agy.`);
  });

  shortcutChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cmd = chip.getAttribute("data-cmd");
      executeCommand(cmd);
      termInput.focus();
    });
  });
}

/* ==========================================================================
   3. TERRAFORM & ASSET VIEWER CONTROLLER
   ========================================================================== */
const fileContents = {
  "main.tf": `# Google Cloud Infrastructure generated by Antigravity IaC Engineer
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Cloud Run Gen2 MicroVM Service
resource "google_cloud_run_v2_service" "app_service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = "2000m"
          memory = "4Gi"
        }
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }
}`,

  "variables.tf": `variable "project_id" {
  type        = string
  description = "Target GCP project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Deployment region"
}

variable "service_name" {
  type        = string
  default     = "saas-app-prod"
}

variable "container_image" {
  type        = string
  description = "Container image URI in Artifact Registry"
}`,

  "outputs.tf": `output "service_uri" {
  value       = google_cloud_run_v2_service.app_service.uri
  description = "Deployed Cloud Run endpoint URL"
}`,

  "versions.tf": `terraform {
  required_version = ">= 1.5.0"
}`,

  "types.ts": `// Upfront Shared Contract generated in Stage 1
export interface UserInvitationRequest {
  email: string;
  role: "admin" | "member" | "viewer";
  expiresInDays?: number;
}

export interface UserInvitationResponse {
  invitationId: string;
  token: string;
  email: string;
  role: string;
  expiresAt: string;
}

export interface ApiError {
  error: string;
  statusCode: number;
}`,

  "routes.ts": `import { Router } from "express";
import crypto from "crypto";

export const inviteRouter = Router();

// POST /api/invites - Authored by Backend Implementer
inviteRouter.post("/api/invites", async (req, res) => {
  const { email, role } = req.body;
  
  if (!email || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return res.status(201).json({
    invitationId: crypto.randomUUID(),
    token,
    email,
    role,
    expiresAt,
  });
});`,

  "models.ts": `// Database Migration & Models
export interface InviteRecord {
  id: string;
  email: string;
  tokenHash: string;
  role: string;
  createdAt: Date;
  expiresAt: Date;
}`,

  "smoke.sh": `#!/usr/bin/env bash
# HTTP smoke tests. No browser: curl is already in the image.
# Deliberately no 'set -e' -- a non-2xx response is an assertion, not a crash.
set -u
BASE_URL="\${BASE_URL:-http://localhost:3000}"
FAILS=0

check() {
  local label="$1" expected="$2" method="$3" path="$4"; shift 4
  local code
  code=$(curl -s -o /tmp/body -w '%{http_code}' --max-time 10 \\
           -X "$method" "$BASE_URL$path" "$@")
  if [ "$code" = "$expected" ]; then
    echo "  PASS  $label ($code)"
  else
    echo "  FAIL  $label (expected $expected, got $code)"
    FAILS=$((FAILS + 1))
  fi
}

check "list invites"        200 GET  /api/invites
check "create invite"       201 POST /api/invites \\
      -H 'Content-Type: application/json' \\
      -d '{"email":"engineer@example.com"}'
check "reject duplicate"    409 POST /api/invites \\
      -H 'Content-Type: application/json' \\
      -d '{"email":"engineer@example.com"}'
check "reject bad email"    400 POST /api/invites \\
      -H 'Content-Type: application/json' \\
      -d '{"email":"not-an-email"}'
check "unauthenticated"     401 GET  /api/invites/admin

echo ""
[ "$FAILS" -eq 0 ] && echo "All assertions passed." || echo "$FAILS assertion(s) failed."
exit "$FAILS"`
};

function initAssetViewer() {
  const fileItems = document.querySelectorAll(".file-item");
  const codeBlock = document.getElementById("codeBlock");
  const currentFileName = document.getElementById("currentFileName");
  const copyBtn = document.getElementById("copyCodeBtn");
  const downloadBtn = document.getElementById("downloadCodeBtn");

  function loadFile(fileName) {
    currentFileName.textContent = fileName;
    const content = fileContents[fileName] || "// File content empty or unavailable";
    codeBlock.textContent = content;

    fileItems.forEach((f) => {
      f.classList.toggle("active", f.getAttribute("data-file") === fileName);
    });
  }

  // Load default main.tf
  loadFile("main.tf");

  fileItems.forEach((item) => {
    item.addEventListener("click", () => {
      const fileName = item.getAttribute("data-file");
      loadFile(fileName);
    });
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(codeBlock.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy Code"), 1500);
  });

  downloadBtn.addEventListener("click", () => {
    const fileName = currentFileName.textContent;
    const content = codeBlock.textContent;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/* ==========================================================================
   4. SWARM DISPATCHER & SIMULATION
   ========================================================================== */
function initSwarmDispatcher() {
  const dispatchBtn = document.getElementById("dispatchBtn");
  dispatchBtn.addEventListener("click", () => {
    triggerSwarmExecution();
  });
}

function triggerSwarmExecution() {
  const dispatchBtn = document.getElementById("dispatchBtn");
  const currentStageBadge = document.getElementById("currentStageBadge");
  const tokenCounter = document.getElementById("tokenCount");

  dispatchBtn.disabled = true;
  dispatchBtn.innerHTML = `<span class="btn-icon animate-spin">⏳</span> Executing Swarm...`;

  const stages = [
    { num: 0, name: "Stage 0: Dynamic Discovery", log: "Resolving TARGET_APP_DIR dynamically in container..." },
    { num: 1, name: "Stage 1: Contract Definition", log: "Generated shared data contract at shared/types.ts." },
    { num: 2, name: "Stage 2: Parallel Subagent Dispatch", log: "Dispatched Backend, Frontend, Test, and Terraform subagents concurrently." },
    { num: 3, name: "Stage 3: Deterministic Quality Gate", log: "Executing npm run type-check, bash tests/smoke.sh, and terraform validate..." },
    { num: 4, name: "Stage 4: Security Audit", log: "Adversarial security audit: Rate limiting & CRLF protection verified." },
    { num: 5, name: "Stage 5: Delivery & PR", log: "Swarm Execution Breakdown compiled. Git Pull Request created." },
  ];

  let currentStep = 0;

  const interval = setInterval(() => {
    if (currentStep < stages.length) {
      const stage = stages[currentStep];
      currentStageBadge.textContent = stage.name;
      
      // Update Stepper circles
      for (let i = 0; i <= 5; i++) {
        const stepElem = document.getElementById(`step-${i}`);
        if (!stepElem) continue;
        stepElem.classList.remove("in-progress");
        if (i < currentStep) {
          stepElem.classList.add("completed");
        } else if (i === currentStep) {
          stepElem.classList.add("in-progress");
        } else {
          stepElem.classList.remove("completed");
        }
      }

      addLog("SWARM", stage.log, "badge-info");
      
      // Simulate token consumption jump
      const currentTokens = parseInt(tokenCounter.textContent.replace(/,/g, "")) || 42890;
      tokenCounter.textContent = (currentTokens + Math.floor(Math.random() * 3200 + 1200)).toLocaleString();

      currentStep++;
    } else {
      clearInterval(interval);
      dispatchBtn.disabled = false;
      dispatchBtn.innerHTML = `<span class="btn-icon">⚡</span> Dispatch Swarm`;
      currentStageBadge.textContent = "Swarm Complete (100% Passed)";
      addLog("COMPLETE", "Swarm finished feature delivery. Git commit pushed.", "badge-gate");
    }
  }, 1200);
}

/* ==========================================================================
   5. REAL-TIME AUDIT LOG STREAM
   ========================================================================== */
function initLogStream() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  
  // Initial seed logs
  addLog("HOOK", "Lead Orchestrator initialized with LocalAgentConfig (vertex=True)", "badge-tool");
  addLog("ORCH", "Stage 0 Discovery: target app verified at /workspace/target-app", "badge-info");
  addLog("ORCH", "Stage 1 Contract: shared/types.ts generated", "badge-info");
  addLog("SUBAGENT", "Backend Implementer completed POST /api/invites in /server", "badge-tool");
  addLog("SUBAGENT", "Frontend Implementer completed InviteModal.tsx in /client", "badge-tool");
  addLog("SUBAGENT", "Terraform Engineer generated main.tf, variables.tf, outputs.tf", "badge-tool");
  addLog("GATE", "Deterministic Gate: npm run type-check passed (0 errors)", "badge-gate");
  addLog("GATE", "Deterministic Gate: tests/smoke.sh passed (3 assertions passed in 0.4s)", "badge-gate");
  addLog("GATE", "Deterministic Gate: terraform validate && tflint passed (HCL valid)", "badge-gate");
  addLog("SECURITY", "Adversarial Checker: Rate limiting & CRLF sanitation clean", "badge-sec");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.getAttribute("data-filter");
      filterLogs(filter);
    });
  });
}

function addLog(badgeText, message, badgeClass = "badge-info") {
  const container = document.getElementById("logsContainer");
  if (!container) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");

  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.setAttribute("data-category", badgeClass);

  entry.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-badge ${badgeClass}">${badgeText}</span>
    <span class="log-msg">${message}</span>
  `;

  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function filterLogs(filter) {
  const entries = document.querySelectorAll(".log-entry");
  entries.forEach((entry) => {
    if (filter === "all") {
      entry.style.display = "flex";
    } else if (filter === "tools" && entry.getAttribute("data-category") === "badge-tool") {
      entry.style.display = "flex";
    } else if (filter === "gates" && entry.getAttribute("data-category") === "badge-gate") {
      entry.style.display = "flex";
    } else if (filter === "security" && entry.getAttribute("data-category") === "badge-sec") {
      entry.style.display = "flex";
    } else {
      entry.style.display = "none";
    }
  });
}
