# Google Cloud Run Sizing & Sandbox Guide

This guide details how Google Cloud Run's execution environment is configured for Antigravity Swarms.

---

## 1. Cloud Run Sandbox: Gen 1 (gVisor) vs. Gen 2 (MicroVM)

Google Cloud Run provides two execution environments:

### Gen 1 (Default gVisor Sandbox)
* Uses **gVisor** (`runsc`), a user-space kernel that intercepts system calls.
* Excellent security isolation for standard web services.
* **Limitations for Agent Swarms**:
  * Heavy disk I/O (e.g. `node_modules` with thousands of small files, `terraform init`) experiences syscall emulation overhead.
  * `/dev/shm` (shared memory) size is constrained.

### Gen 2 (Recommended: MicroVM Sandbox)
* Uses hardware-assisted virtualization (lightweight Linux microVMs).
* Provides full Linux kernel compatibility and fast direct NVMe disk I/O.
* **Advantages for Agent Swarms**:
  * **Fast Compilations**: TypeScript builds and Terraform provider initializations run significantly faster.
  * **Process Concurrency**: Supports parallel subagent subprocesses and ptrace capabilities without hitching.

**Conclusion**: Always deploy the swarm container with `--execution-environment=gen2`.

---

## 2. Resource Sizing

Because the Lead Orchestrator dispatches subagents that concurrently run TypeScript compilers and Terraform validation, compute allocation must accommodate peak bursts. The container deliberately ships **no headless browser**: verification is `curl`-based, which keeps both the image and the running footprint small.

The figures below are sized for **this example** — the smallest container that still demonstrates the pattern — not as a general recommendation. Deploy small, watch CPU and memory across a few representative runs, and raise the limits against what you actually measure for your own workload.

* **vCPU**: **2 vCPUs** is enough for this example (4 for large full-stack codebases).
* **Memory**: **4 GiB** RAM (8 GiB for large codebases).
* **CPU Boost**: Enabled (`--cpu-boost`). Allocates additional CPU capacity during container startup and dependency hydration.
* **Task Timeout**: Set to **30–60 minutes** (`--task-timeout=3600`) for Cloud Run Jobs executing extensive multi-agent feature iterations.

> These figures are well below what a browser-based suite would need. A single
> headless Chromium comfortably wants a GiB or more on its own, and a test
> runner starting several in parallel was the reason earlier revisions of this
> guide called for 4 vCPU and 16 GiB. The dominant cost now is `npm install`
> and `terraform init`, not rendering. If you reintroduce browser testing,
> raise these numbers again.

---

## 3. Ephemeral Jobs vs. Persistent Services

* **Cloud Run Jobs (Batch Runner)**:
  * Best for CI/CD triggered feature builds, scheduled refactors, or nightly security audits.
  * Container runs to completion and deallocates. Cost is billed strictly per second of execution.
* **Cloud Run Services (Web Console & PTY)**:
  * Best for the Next.js Web Terminal, allowing engineers to connect interactively over WebSockets to inspect files and run manual diagnostics.

---

## 4. Cloud Run Instances: Continuous Execution & Cleanup Best Practices

### Tech Preview Status & GCP Console Visibility
* **Tech Preview Feature (`gcloud beta run instances`)**: We use the Tech Preview of **Cloud Run Instances** to run stateful, long-lived AI agent containers.
* **Not Shown in GCP Console Web UI**: Because this feature is currently in Tech Preview, **Cloud Run Instances do not appear in the standard GCP Cloud Run Console web UI** (`console.cloud.google.com/run`). All management, status checks, URL lookups, and deletions must be performed via the `gcloud` CLI:
  ```bash
  # Retrieve the instance HTTPS URL
  gcloud beta run instances describe antigravity-console-instance \
    --region=us-east4 \
    --project=YOUR_GCP_PROJECT_ID \
    --format='value(urls)'
  ```

### The Architectural Difference: Scale-to-Zero vs. Singleton Runtime
* **Cloud Run Services** scale down to 0 instances when idle, incurring **\$0** in compute charges when not receiving requests.
* **Cloud Run Instances** (`gcloud beta run instances`) are **continuous singleton runtimes**. They run continuously 24/7 with allocated vCPU and RAM until explicitly deleted or stopped.

### Important Reminder: Delete Your Instance After Testing!

> [!WARNING]
> **Always delete your Cloud Run Instance after testing!**
> Because Cloud Run Instances do not appear in the standard GCP Console UI and do not autoscale to zero, leaving an instance running in the background after testing will incur continuous 24/7 compute charges.

Since the instance mounts its workspace to Google Cloud Storage (`gs://...` at `/workspace`), **all generated code, Terraform files, and test logs remain safely preserved**. Deleting the instance does not destroy any project data.

### Deletion & Re-creation Workflow:
```bash
# 1. Delete the instance immediately after completing your tests
gcloud beta run instances delete antigravity-console-instance \
  --region=us-east4 \
  --project=YOUR_GCP_PROJECT_ID \
  --quiet

# 2. Verify that 0 instances are running
gcloud beta run instances list --project=YOUR_GCP_PROJECT_ID

# 3. Re-create the instance in ~15 seconds when starting your next session
./deploy-instance.sh YOUR_GCP_PROJECT_ID us-east4
```
