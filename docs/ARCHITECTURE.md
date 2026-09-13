# Architecture Deep Dive: Antigravity Swarms in Remote Containers

This document explains the technical architecture for orchestrating autonomous multi-agent engineering swarms in a remote container environment.

---

## 1. The Multi-Agent Swarm Paradigm

Single-prompt coding assistants suffer from:
* **Context Bloat**: Verbose terminal stdout, compiler errors, and package downloads fill the token window.
* **Reasoning Drift**: Models lose strict adherence to architectural contracts across multi-tier applications.
* **Confirmation Bias**: An agent that wrote buggy code struggles to objectively find its own flaws during verification.

The **Antigravity Swarm Pattern** solves this by decoupling feature delivery into discrete, specialized subagents coordinated through an asymmetric pipeline.

---

## 2. The Three Architectural Pillars

### Pillar 1: Control Plane vs. Output Plane Separation
The orchestrator specifications, subagent contracts, and reusable agent skills live in `/app/control-plane`. This directory is mounted **Read-Only** inside the container.

The target code lives in `/workspace/target-app`. This ensures prompt templates, orchestration meta-instructions, and agent configuration files are completely decoupled from customer code repositories.

### Pillar 2: Strict Sub-Tree File Scoping
When multiple subagents write code in parallel, race conditions and merge conflicts can break the codebase. To prevent this, the orchestrator enforces rigid write boundaries:
* **Backend Subagent**: Write access locked to `/workspace/target-app/server/`
* **Frontend Subagent**: Write access locked to `/workspace/target-app/client/`
* **Test Engineer**: Write access locked to `/workspace/target-app/tests/`
* **Terraform Engineer**: Write access locked to `/workspace/target-app/infra/terraform/`
* **Shared Types**: Read-only contract at `/workspace/target-app/shared/types.ts`

### Pillar 3: Asymmetric Verification Pipeline
Pairing every coder with a 1:1 LLM reviewer causes token inflation and circular arguments. Instead:
1. **Deterministic Quality Gate (0 LLM Tokens)**:
   * The container terminal runs `npm run type-check`, the `curl` smoke suite (`tests/smoke.sh`), and `terraform validate`.
   * If any command exits with a non-zero code, the raw terminal stderr is passed directly back to the responsible subagent.
   * Zero LLM tokens are spent on auditor models while syntax, type, or regression errors exist.
2. **Targeted Semantic Checkers**:
   * Once deterministic tests pass 100%, specialized LLMs evaluate security boundaries (rate limits, CRLF injection, privilege escalation) and generate the Transparency Report.

---

## 3. Subagent Execution Topology

```
                       [ Lead Orchestrator ]
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
[ Backend Implementer ] [ Frontend Implementer ] [ Test Engineer ]
 (writes /server)        (writes /client)         (writes /tests)
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                 [ Deterministic Quality Gate ]
        (npm run type-check && bash tests/smoke.sh)
                                │
                        ┌───────┴───────┐
                        │               │
                     (Pass)          (Fail)
                        │               │
                        │               └──► [ Bounce back to Subagent ]
                        ▼
           [ Adversarial Security Checker ]
                        │
                        ▼
           [ Transparency Explainer & PR ]
```

---

## 4. Workload Identity & Cloud Security

The container runs using **Application Default Credentials (ADC)** linked to a Google Cloud Service Account.
* Model calls route to **Vertex AI** via private Google network backbone.
* No API keys or long-lived service account tokens are baked into container images or saved to disk.
