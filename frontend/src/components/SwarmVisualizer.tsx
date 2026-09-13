/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import { useState } from "react";

export type SwarmAgentStatus = "idle" | "active" | "validating" | "completed" | "standby";

export interface AgentNode {
  id: string;
  /** Matches the agent `name` reported by /api/swarm, used to bind live telemetry. */
  sourceName: string;
  name: string;
  role: string;
  icon: string;
  scope: string;
  tools: string[];
  status: SwarmAgentStatus;
  summary: string;
  tokens: number;
  color: string;
  glowColor: string;
  borderColor: string;
}

/** Per-agent telemetry as reported by the swarm API. */
export interface SwarmAgentTelemetry {
  name: string;
  status: string;
  tokens: number;
}

interface SwarmVisualizerProps {
  /** Index of the in-flight stage. Use -1 so that no stage renders as reached. */
  currentStage?: number;
  isExecuting?: boolean;
  /** "idle" | "running" | "completed" -- drives fallback status for unmapped agents. */
  swarmStatus?: string;
  agentTelemetry?: SwarmAgentTelemetry[];
}

/** Presentation for each agent status. Keeps the badge honest after a reset. */
const STATUS_BADGE: Record<SwarmAgentStatus, { label: string; className: string }> = {
  idle: { label: "○ Idle", className: "text-slate-400" },
  standby: { label: "○ Standby", className: "text-slate-400" },
  active: { label: "● Running", className: "text-blue-600" },
  validating: { label: "◐ Validating", className: "text-amber-600" },
  completed: { label: "✓ Done", className: "text-emerald-600" },
};

function normalizeStatus(raw: string | undefined, fallback: SwarmAgentStatus): SwarmAgentStatus {
  switch (raw) {
    case "idle":
    case "pending":
      return "idle";
    case "active":
    case "running":
      return "active";
    case "validating":
      return "validating";
    case "completed":
      return "completed";
    case "standby":
      return "standby";
    default:
      return fallback;
  }
}

export default function SwarmVisualizer({
  currentStage = -1,
  isExecuting = false,
  swarmStatus = "idle",
  agentTelemetry = [],
}: SwarmVisualizerProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("iac");

  // Agents the API does not report on (the explainer runs outside the dispatch
  // loop) inherit the overall swarm status rather than a stale "completed".
  const fallbackStatus: SwarmAgentStatus =
    swarmStatus === "running" ? "active" : swarmStatus === "completed" ? "completed" : "idle";

  const telemetryByName = new Map(agentTelemetry.map((a) => [a.name, a]));

  /** Binds live telemetry onto a static agent definition. */
  function withTelemetry<T extends { sourceName: string; status: SwarmAgentStatus; tokens: number }>(agent: T): T {
    const live = telemetryByName.get(agent.sourceName);
    if (!live) {
      return { ...agent, status: fallbackStatus, tokens: 0 };
    }
    return { ...agent, status: normalizeStatus(live.status, fallbackStatus), tokens: live.tokens };
  }

  const orchestrator = withTelemetry({
    id: "orchestrator",
    sourceName: "Lead Orchestrator",
    name: "Lead Orchestrator",
    role: "Swarm Coordinator & Gatekeeper",
    icon: "👑",
    scope: "/workspace/target-app/ (Full Workspace)",
    tools: ["invoke_subagent", "read_file", "run_gate_checks", "synthesize_report"],
    status: fallbackStatus,
    summary: "Authors immutable shared contracts in types.ts and enforces directory boundaries and deterministic quality gates across all subagents.",
    tokens: 0,
    color: "from-amber-500/20 to-amber-600/10",
    glowColor: "shadow-amber-500/30",
    borderColor: "border-amber-500/50",
  });

  const agents: AgentNode[] = ([
    {
      id: "iac",
      sourceName: "Terraform IaC Engineer",
      name: "Terraform IaC Engineer",
      role: "Cloud Infrastructure Architect",
      icon: "🏗️",
      scope: "/workspace/target-app/infra/terraform/",
      tools: ["terraform init", "terraform plan", "terraform validate", "write_file"],
      status: fallbackStatus,
      summary: "Generates Cloud Run v2 services, VPC connectors, IAM bindings, and Cloud Storage resources in main.tf, variables.tf, and outputs.tf.",
      tokens: 0,
      color: "from-orange-500/20 to-orange-600/10",
      glowColor: "shadow-orange-500/30",
      borderColor: "border-orange-500/50",
    },
    {
      id: "backend",
      sourceName: "Backend Implementer",
      name: "Backend Implementer",
      role: "Server API & Logic Developer",
      icon: "⚙️",
      scope: "/workspace/target-app/server/",
      tools: ["write_file", "npm run type-check", "node"],
      status: fallbackStatus,
      summary: "Implements REST endpoints and data models adhering strictly to shared/types.ts schemas.",
      tokens: 0,
      color: "from-sky-500/20 to-sky-600/10",
      glowColor: "shadow-sky-500/30",
      borderColor: "border-sky-500/50",
    },
    {
      id: "frontend",
      sourceName: "Frontend Implementer",
      name: "Frontend Implementer",
      role: "UI & State Specialist",
      icon: "🎨",
      scope: "/workspace/target-app/client/",
      tools: ["write_file", "npm run build", "tailwind"],
      status: fallbackStatus,
      summary: "Develops responsive glassmorphic UI components and client data hooks.",
      tokens: 0,
      color: "from-pink-500/20 to-pink-600/10",
      glowColor: "shadow-pink-500/30",
      borderColor: "border-pink-500/50",
    },
    {
      id: "test",
      sourceName: "Test Engineer",
      name: "Test Engineer",
      role: "HTTP Smoke & Quality Verifier",
      icon: "🧪",
      scope: "/workspace/target-app/tests/",
      tools: ["bash tests/smoke.sh", "write_file"],
      status: isExecuting ? "validating" : fallbackStatus,
      summary: "Authors integration test specifications against target endpoints to ensure complete compliance.",
      tokens: 0,
      color: "from-emerald-500/20 to-emerald-600/10",
      glowColor: "shadow-emerald-500/30",
      borderColor: "border-emerald-500/50",
    },
    {
      id: "security",
      sourceName: "Security Checker",
      name: "Security Checker",
      role: "Policy & Vulnerability Auditor",
      icon: "🛡️",
      scope: "Cross-cutting Global Workspace",
      tools: ["trivy", "secret_scanner", "iam_checker"],
      status: fallbackStatus,
      summary: "Audits Terraform resource definitions for exposed secrets, open ingress (0.0.0.0/0), and excessive IAM permissions.",
      tokens: 0,
      color: "from-red-500/20 to-red-600/10",
      glowColor: "shadow-red-500/30",
      borderColor: "border-red-500/50",
    },
    {
      id: "explainer",
      sourceName: "Transparency Explainer",
      name: "Transparency Explainer",
      role: "Telemetry & Audit Synthesizer",
      icon: "📝",
      scope: "/app/storage/artifacts/",
      tools: ["generate_changelist", "gcs_upload"],
      status: fallbackStatus,
      summary: "Generates execution manifests, stage-by-stage token metrics, and syncs deliverables to Google Cloud Storage.",
      tokens: 0,
      color: "from-purple-500/20 to-purple-600/10",
      glowColor: "shadow-purple-500/30",
      borderColor: "border-purple-500/50",
    },
  ] as AgentNode[]).map(withTelemetry);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const lifecycleStages = [
    { num: "0", name: "Discovery", desc: "Scan /workspace" },
    { num: "1", name: "Contract", desc: "types.ts Schema" },
    { num: "2", name: "Subagents", desc: "Parallel Dispatch" },
    { num: "3", name: "Gate Check", desc: "terraform validate" },
    { num: "4", name: "Security", desc: "IAM & Secret Audit" },
    { num: "5", name: "Delivery", desc: "Sync to GCS" },
  ];

  return (
    <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm backdrop-blur-md space-y-6">
      {/* Visualizer Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 text-xl shadow-2xs">
            🕸️
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Antigravity Multi-Agent Swarm Topology</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                Cloud Run Sandbox
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive visual map of agent communications, directory scopes, and deterministic gate enforcement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 shadow-2xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>gVisor microVM Sandbox</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-blue-700 font-mono font-semibold shadow-2xs">
            agy (UID: 1001)
          </span>
        </div>
      </div>

      {/* Stage Flow Bar */}
      <div className="space-y-2">
        <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Swarm Execution Pipeline</span>
        <div className="grid grid-cols-6 gap-2 text-center">
          {lifecycleStages.map((stage, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border transition ${
                idx === currentStage
                  ? "bg-blue-50 border-blue-400 text-blue-900 shadow-xs font-semibold"
                  : idx < currentStage
                  ? "bg-emerald-50/70 border-emerald-300 text-emerald-800"
                  : "bg-slate-50/80 border-slate-200 text-slate-400"
              }`}
            >
              <div className="text-[11px] font-mono font-bold">{stage.num}. {stage.name}</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{stage.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Swarm Network Map */}
      <div className="relative bg-slate-50/70 rounded-2xl border border-slate-200 p-8 overflow-hidden min-h-[380px] flex flex-col items-center justify-center">
        {/* Subtle Background Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

        {/* Central Hub: Lead Orchestrator */}
        <div className="relative z-10 flex flex-col items-center mb-10 group">
          <div className="relative">
            {/* Pulsing Aura */}
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-400 to-blue-400 rounded-3xl blur-md opacity-30 group-hover:opacity-60 transition duration-500 animate-pulse"></div>
            <div className="relative w-28 h-28 rounded-2xl bg-white border-2 border-amber-400 shadow-md flex flex-col items-center justify-center text-center p-2.5">
              <span className="text-3xl mb-1">{orchestrator.icon}</span>
              <span className="text-xs font-bold text-slate-900 leading-tight">Lead Orchestrator</span>
              <span className="text-[8px] text-amber-800 font-mono font-bold mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                MASTER
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-600 font-mono mt-2.5 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
            Immutable Contract: /shared/types.ts
          </span>
        </div>

        {/* Radial Subagent Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 w-full">
          {agents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 flex flex-col items-center text-center relative group ${
                  isSelected
                    ? "bg-white border-blue-500 shadow-md ring-2 ring-blue-100 scale-105"
                    : "bg-white/95 border-slate-200 hover:border-blue-300 hover:shadow-xs"
                }`}
              >
                {/* Active pulse ring */}
                {agent.status === "active" && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
                  </span>
                )}

                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl mb-2.5 group-hover:scale-110 transition">
                  {agent.icon}
                </div>

                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{agent.name}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{agent.role}</p>

                <div className="mt-3 pt-2 border-t border-slate-100 w-full flex items-center justify-between text-[10px]">
                  <span className={`font-mono font-semibold ${STATUS_BADGE[agent.status].className}`}>
                    {STATUS_BADGE[agent.status].label}
                  </span>
                  <span className="font-mono text-slate-400">{agent.tokens.toLocaleString()}t</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Agent Inspector Detail Drawer */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{selectedAgent.icon}</span>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>{selectedAgent.name}</span>
                <span className="text-[11px] text-slate-500 font-normal">({selectedAgent.role})</span>
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-slate-500">Directory Boundary:</span>
            <code className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 font-semibold">
              {selectedAgent.scope}
            </code>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {selectedAgent.summary}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="text-slate-500 font-semibold text-[10px] uppercase">Permitted Toolchain:</span>
          {selectedAgent.tools.map((tool, i) => (
            <code key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 text-[10px] font-mono font-medium">
              {tool}
            </code>
          ))}
          <span className="ml-auto text-slate-500 font-mono text-[11px]">
            Tokens: <strong className="text-emerald-600 font-bold">{selectedAgent.tokens.toLocaleString()}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
