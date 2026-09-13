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

interface HowToUsePanelProps {
  onNavigateToTab?: (tab: "terminal" | "agents" | "guide") => void;
}

export default function HowToUsePanel({ onNavigateToTab }: HowToUsePanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [basicPrompt, setBasicPrompt] = useState(
    "Build an autoscaled Cloud Run microservice with VPC and Firestore"
  );
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  // Only models actually served by Vertex AI in this project/region.
  // Verified with publishers/google/models/<id>:generateContent.
  const modelOptions = [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      badge: "Default • High-Speed",
      desc: "Fast swarm orchestration, low latency, and rapid code iteration",
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      badge: "Deep Reasoning",
      desc: "Complex multi-agent reasoning, architectural planning, and validation",
    },
  ];

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleLaunchBasicSwarm = async () => {
    if (!basicPrompt.trim()) return;
    setLaunching(true);
    setLaunchMessage(null);
    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: basicPrompt.trim(), model: selectedModel }),
      });

      if (res.ok) {
        setLaunchMessage(`Swarm dispatched successfully using ${selectedModel}!`);
        window.dispatchEvent(new Event("swarm-launched"));
      } else {
        setLaunchMessage("Failed to dispatch swarm. Check server logs.");
      }
    } catch (err) {
      console.error("Launch failed", err);
      setLaunchMessage("Error communicating with swarm runner.");
    } finally {
      setLaunching(false);
    }
  };

  const sandboxSteps = [
    {
      step: "01",
      title: "Select Foundation Model & Dispatch Swarm",
      desc: "Choose your foundation model (Gemini 3.8 Flash by default, or Gemini 2.5 Pro for deep architectural design). Click 'Launch Swarm' above, or open the terminal and type:",
      command: "swarm run \"Build an autoscaled Cloud Run microservice with VPC and Firestore\" -m gemini-2.5-flash",
    },
    {
      step: "02",
      title: "Observe Live Multi-Agent Swarm Collaboration",
      desc: "Watch the Lead Orchestrator author the shared contract in 'shared/types.ts', then dispatch specialized subagents in parallel (Terraform IaC, Backend, Frontend, and E2E Tests). Track communication flows and node activity in real time on the visual topology graph.",
      command: "swarm status",
    },
    {
      step: "03",
      title: "Automated & Manual Deterministic Quality Gates (Cloud Run Sandboxes)",
      desc: "Deterministic checks run before any model reviews the output. The two that inspect generated code -- 'terraform validate' and 'npm run type-check' -- execute inside a network-isolated Cloud Run Sandbox ('sandbox do'), so they can read untrusted output but cannot send it anywhere. Steps that must reach the network ('terraform init', 'npm install', and the curl smoke suite) run outside that boundary, because an egress-capable sandbox requires CAP_NET_ADMIN and this container runs as a non-root user. You can trigger validation manually anytime:",
      command: "swarm validate",
    },
    {
      step: "04",
      title: "Inspect, Test & Iterate in the Web Terminal",
      desc: "Browse generated files in the real-time Asset Tree on the left (visible across all console pages). Switch to 'Terminal & Workspace' to run Terraform commands directly in the interactive Linux terminal:",
      command: "cd /workspace/target-app/infra/terraform && terraform plan",
    },
    {
      step: "05",
      title: "Execute Playbooks in Headless Cloud Run Batch Sandboxes",
      desc: "Once you have validated and tested your architecture in the interactive remote sandbox, execute the exact same playbook headlessly via Google Cloud Run Jobs:",
      command: "gcloud run jobs execute antigravity-swarm-runner --region=us-central1 --project=YOUR_PROJECT_ID",
    },
    {
      step: "06",
      title: "Reminder: Delete Cloud Run Instance After Testing (Tech Preview)",
      desc: "Because Cloud Run Instances are in Tech Preview, they do not appear in the standard GCP Console UI and do not scale to zero. Always remember to delete the instance via CLI after completing your tests to avoid continuous compute billing (all files remain preserved in Cloud Storage):",
      command: "gcloud beta run instances delete antigravity-console-instance --region=us-east4 --project=YOUR_PROJECT_ID --quiet",
    },
  ];

  const sandboxCheatSheet = [
    { label: "Run Basic Swarm (Default)", cmd: "swarm run \"<feature prompt>\" -m gemini-2.5-flash" },
    { label: "Run with Deep Reasoning", cmd: "swarm run \"<feature prompt>\" -m gemini-2.5-pro" },
    { label: "List Foundation Models", cmd: "swarm models" },
    { label: "Check Workspace Files", cmd: "swarm status" },
    { label: "Run Quality Gates", cmd: "swarm validate" },
    { label: "Reset Swarm & Workspace", cmd: "swarm reset" },
    { label: "Plan Terraform Resources", cmd: "cd /workspace/target-app/infra/terraform && terraform plan" },
    { label: "Delete Instance (Stop Billing)", cmd: "gcloud beta run instances delete antigravity-console-instance --region=us-east4 --quiet" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 bg-slate-50">
      {/* Header Banner */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm backdrop-blur-md space-y-2">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 text-xl font-bold shadow-2xs">
            🧪
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Develop & Prototype in the Sandbox</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive multi-agent pair programming, live Terraform inspection, and deterministic quality validation.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Swarm Launcher Card */}
      <div className="bg-white/95 border border-blue-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚀</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Launch Swarm in Sandbox</h3>
              <p className="text-xs text-slate-500">
                Select your Gemini foundation model and launch a basic multi-agent execution with one click.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            ● Ready to Dispatch
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Model Selection in a List */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Gemini Foundation Model
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs cursor-pointer appearance-none"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.badge})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                ▼
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              {modelOptions.find((m) => m.id === selectedModel)?.desc}
            </p>
          </div>

          {/* Basic Prompt Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Basic Feature Prompt
            </label>
            <input
              type="text"
              value={basicPrompt}
              onChange={(e) => setBasicPrompt(e.target.value)}
              placeholder="Enter basic prompt for the swarm..."
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Dispatches Lead Orchestrator, Terraform IaC, Backend, Frontend, and Test agents.
            </p>
          </div>
        </div>

        {/* Launch Button & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <button
            onClick={handleLaunchBasicSwarm}
            disabled={launching}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl text-xs transition duration-200 shadow-xs flex items-center gap-2"
          >
            <span>{launching ? "⏳" : "⚡"}</span>
            <span>
              {launching
                ? `Dispatching with ${selectedModel}...`
                : `Launch Basic Swarm (${selectedModel})`}
            </span>
          </button>

          {launchMessage && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                {launchMessage}
              </span>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab("agents")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline flex items-center gap-1"
                >
                  <span>View in Agent Swarm Monitor</span> →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Why Develop in the Sandbox */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>💡</span> Why Prototype in the Sandbox?
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          The <strong>Develop & Prototype in the Sandbox</strong> mode lets you collaborate with the multi-agent swarm in real time. Unlike headless batch jobs, the sandbox provides:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          <div className="p-4 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-blue-600">⚡ Live Shared Filesystem</span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Files created by agents in <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-medium">/workspace/target-app</code> appear instantly in the Asset Browser and are immediately editable in your terminal.
            </p>
          </div>

          <div className="p-4 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-emerald-700">🛡️ Instant Terraform Validation</span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Run <code className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-medium">terraform validate</code> and <code className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-medium">terraform plan</code> directly in the Linux shell to verify syntax and provider schemas.
            </p>
          </div>

          <div className="p-4 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-purple-600">🧠 Foundation Model Choice</span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Easily toggle between <strong>Gemini 3.8 Flash</strong> for next-gen high-speed swarms and <strong>Gemini 2.5 Pro</strong> for deep architectural reasoning.
            </p>
          </div>
        </div>
      </div>

      {/* 5-Step Prototyping Lifecycle */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>🚀</span> Sandbox Prototyping Workflow (Step-by-Step)
        </h3>

        <div className="space-y-3.5">
          {sandboxSteps.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5 hover:border-blue-300 hover:bg-white transition shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center font-mono">
                  {item.step}
                </span>
                <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>

              <div className="flex items-center justify-between bg-slate-900 px-3.5 py-2.5 rounded-lg border border-slate-800 shadow-2xs">
                <code className="text-[11px] text-sky-300 font-mono overflow-x-auto">{item.command}</code>
                <button
                  onClick={() => copyToClipboard(item.command, idx)}
                  className="ml-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white rounded transition shrink-0"
                >
                  {copiedIndex === idx ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sandbox CLI Cheat Sheet */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>⚡</span> Sandbox CLI Cheat Sheet
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sandboxCheatSheet.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-700">{item.label}</span>
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <code className="text-[11px] text-blue-700 font-mono truncate font-medium">{item.cmd}</code>
                <button
                  onClick={() => copyToClipboard(item.cmd, 100 + idx)}
                  className="ml-2 text-[10px] text-slate-500 hover:text-blue-600 font-medium shrink-0"
                >
                  {copiedIndex === 100 + idx ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
