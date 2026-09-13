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

import { useState, useEffect } from "react";
import SwarmVisualizer from "./SwarmVisualizer";

interface Stage {
  id: number;
  name: string;
  status: string;
  description: string;
  duration: string;
}

interface AgentInfo {
  name: string;
  role: string;
  scope: string;
  status: string;
  summary: string;
  tokens: number;
  badge: string;
}

interface SwarmExecutionData {
  id: string;
  status: string;
  taskPrompt: string;
  startedAt: string;
  completedAt: string;
  duration: string;
  model: string;
  tokenUsage: {
    prompt: number;
    candidates: number;
    thinking: number;
    total: number;
  };
  qualityGate: {
    passed: number;
    total: number;
  };
  stages: Stage[];
  agents: AgentInfo[];
  logs: string[];
}

export default function AgentExecutionPanel() {
  const [data, setData] = useState<SwarmExecutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [resetting, setResetting] = useState(false);

  // Only models actually served by Vertex AI in this project/region.
  // Verified with publishers/google/models/<id>:generateContent.
  const modelOptions = [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tag: "Default • High-Speed", desc: "Fast swarm execution, low latency, and rapid code iteration" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tag: "Deep Reasoning", desc: "Complex multi-agent orchestration, architecture design, and formal verification" },
  ];

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/swarm");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch swarm status", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset Antigravity Swarm? This will stop running swarms, clean /workspace/target-app, and reset execution telemetry.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/swarm/reset", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setData(json.execution);
        window.dispatchEvent(new Event("swarm-reset"));
      }
    } catch (err) {
      console.error("Reset failed", err);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    const handleResetEvent = () => fetchStatus();
    window.addEventListener("swarm-reset", handleResetEvent);
    return () => {
      clearInterval(interval);
      window.removeEventListener("swarm-reset", handleResetEvent);
    };
  }, []);

  const handleDispatch = async (promptToUse?: string) => {
    const p = promptToUse || customPrompt;
    if (!p) return;
    setDispatching(true);
    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, model: selectedModel }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.execution);
        setCustomPrompt("");
      }
    } catch (err) {
      console.error("Failed to dispatch swarm", err);
    } finally {
      setDispatching(false);
    }
  };

  const presets = [
    {
      title: "🚀 Cloud Run + Terraform Microservice",
      prompt: "Design and implement an autoscaled Cloud Run microservice with VPC Connector, Firestore database, and Terraform IaC",
    },
    {
      title: "🔒 Private VPC & Cloud Armor Ingress",
      prompt: "Create zero-trust private infrastructure with Cloud Armor WAF, custom IAM bindings, and Terraform configurations",
    },
    {
      title: "⚡ Event-Driven Storage & Pub/Sub Pipeline",
      prompt: "Build an asynchronous event pipeline connecting Cloud Storage triggers to Cloud Run via Pub/Sub topics and dead-letter queues",
    },
  ];

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm bg-slate-50">
        <div className="flex items-center gap-2.5 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          <span className="font-medium text-slate-700">Loading Swarm Execution Monitor...</span>
        </div>
      </div>
    );
  }

  const status = data?.status ?? "idle";
  const isRunning = status === "running";
  // "idle" is the post-reset state: nothing has run, so every metric below must
  // render as empty rather than falling back to a previous or seeded value.
  const isIdle = status === "idle";

  /** Renders an em dash for cleared metrics so a reset reads as empty, not as zero-that-might-be-stale. */
  const metric = (value: string | number | undefined | null): string => {
    if (isIdle) return "—";
    if (value === undefined || value === null || value === "") return "—";
    return typeof value === "number" ? value.toLocaleString() : value;
  };

  // Position in the 6-stage pipeline, derived from real stage status. -1 means
  // no stage has been reached, so the pipeline bar renders entirely unlit.
  const completedStages = data?.stages?.filter((s) => s.status === "completed").length ?? 0;
  const currentStage = isIdle ? -1 : isRunning ? Math.min(completedStages, 5) : completedStages - 1;

  const gate = data?.qualityGate;
  const gateLabel =
    isIdle || !gate || gate.total === 0
      ? "—"
      : `${Math.round((gate.passed / gate.total) * 100)}% Passed (${gate.passed}/${gate.total})`;

  const statusPill = isRunning
    ? { label: "Swarm Executing...", className: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500 animate-ping" }
    : isIdle
    ? { label: "Swarm Idle / Reset", className: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400" }
    : { label: "Swarm Completed", className: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" };

  /** Stage badge styling driven by real stage status rather than an always-green checkmark. */
  const stageBadge = (stage: Stage) => {
    if (stage.status === "completed") {
      return { text: `✓ ${stage.duration || "done"}`, className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
    if (stage.status === "running") {
      return { text: "● running", className: "text-amber-700 bg-amber-50 border-amber-200" };
    }
    return { text: "○ pending", className: "text-slate-500 bg-slate-100 border-slate-200" };
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 bg-slate-50">
      {/* Top Banner: Status & Overview */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 text-xl font-bold shadow-2xs">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900">Antigravity Swarm Orchestration Engine</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 ${statusPill.className}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`}></span>
                  {statusPill.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Execution ID: <code className="text-blue-700 font-mono font-medium">{data?.id}</code> • Model: <span className="text-slate-700 font-medium">{data?.model}</span> • Target: <code className="text-slate-600 font-mono">/workspace/target-app</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-medium text-rose-700 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            >
              <span>🔄</span> {resetting ? "Resetting..." : "Reset Swarm"}
            </button>
            <button
              onClick={fetchStatus}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            >
              <span>↻</span> Refresh Telemetry
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Bar. Every tile clears to an em dash on reset. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider">Execution Time</span>
            <p className={`text-lg font-bold mt-1 ${isIdle ? "text-slate-400" : "text-blue-600"}`}>
              {metric(data?.duration)}
            </p>
          </div>
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider">Total Tokens</span>
            <p className={`text-lg font-bold mt-1 ${isIdle ? "text-slate-400" : "text-emerald-600"}`}>
              {metric(data?.tokenUsage?.total)}
            </p>
          </div>
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider">Thinking / Reasoning</span>
            <p className={`text-lg font-bold mt-1 ${isIdle ? "text-slate-400" : "text-purple-600"}`}>
              {metric(data?.tokenUsage?.thinking)}
            </p>
          </div>
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider">Quality Gate Status</span>
            <p className={`text-lg font-bold mt-1 ${isIdle ? "text-slate-400" : "text-teal-600"}`}>
              {gateLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Swarm Representation */}
      <SwarmVisualizer
        currentStage={currentStage}
        isExecuting={isRunning}
        swarmStatus={status}
        agentTelemetry={data?.agents ?? []}
      />

      {/* Interactive Swarm Dispatcher */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>🎯</span> Dispatch New Swarm Workload
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Provide a prompt to instruct the Lead Orchestrator, or choose a pre-configured architecture recipe below.
          </p>
        </div>

        {/* Model Selector (Latest First) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/90 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-700">Foundation Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-white border border-slate-300 text-blue-700 rounded-lg px-3 py-1.5 text-xs font-mono font-medium focus:outline-none focus:border-blue-500 transition cursor-pointer shadow-2xs"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id} className="bg-white text-slate-900">
                  {m.name} ({m.tag})
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {modelOptions.find((m) => m.id === selectedModel)?.desc}
          </p>
        </div>

        {/* Quick Presets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleDispatch(preset.prompt)}
              disabled={dispatching}
              className="text-left p-4 rounded-xl bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 transition group shadow-2xs"
            >
              <p className="text-xs font-bold text-blue-700 group-hover:text-blue-800 mb-1">{preset.title}</p>
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{preset.prompt}</p>
            </button>
          ))}
        </div>

        {/* Custom Prompt Input */}
        <div className="flex gap-2.5 pt-1">
          <input
            type="text"
            placeholder="e.g. Design an event-driven Cloud Run microservice with VPC Connector, Firestore, and Terraform IaC..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDispatch()}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs transition"
          />
          <button
            onClick={() => handleDispatch()}
            disabled={dispatching || !customPrompt.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl text-xs transition flex items-center gap-2 shadow-xs"
          >
            {dispatching ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Dispatching...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Launch Swarm</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6-Stage Execution Protocol Progress */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>🔄</span> Swarm 6-Stage Lifecycle Protocol
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            How Antigravity coordinates parallel subagents with deterministic gates and zero token waste.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.stages?.map((stage) => {
            const badge = stageBadge(stage);
            return (
              <div
                key={stage.id}
                className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2 hover:border-blue-300 hover:bg-blue-50/20 transition shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{stage.name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold shrink-0 ml-2 ${badge.className}`}>
                    {badge.text}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{stage.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Swarm Subagents Breakdown */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>👥</span> Specialized Swarm Agents
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Each subagent has a designated directory scope, read-only constraints, and specific tool assignments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {data?.agents?.map((agent, i) => (
            <div
              key={i}
              className="p-5 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between space-y-3 hover:border-blue-300 hover:shadow-md transition shadow-2xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{agent.name}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full font-mono font-medium">
                    {agent.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">{agent.role}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-slate-400">Scope:</span>
                  <span className="text-blue-700 font-semibold truncate">{agent.scope}</span>
                </div>
                <p className="text-[11px] text-slate-600 pt-1 leading-relaxed">{agent.summary}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-mono">
                  {agent.status === "completed" ? (
                    <span className="text-emerald-600 font-semibold">✓ Done</span>
                  ) : agent.status === "active" || agent.status === "running" ? (
                    <span className="text-blue-600 font-semibold">● Running</span>
                  ) : (
                    <span className="text-slate-400 font-semibold">○ Idle</span>
                  )}
                </span>
                <span>
                  Tokens:{" "}
                  <strong className={`font-mono font-bold ${agent.tokens > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                    {agent.tokens > 0 ? agent.tokens.toLocaleString() : "—"}
                  </strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Agent Execution Logs */}
      <div className="bg-white/90 border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📜</span> Real-time Swarm Execution Audit Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit trace of agent reasoning, subagent dispatches, and deterministic check outputs.
            </p>
          </div>
          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-medium ${
            isRunning
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-slate-500 bg-slate-100 border-slate-200"
          }`}>
            {isRunning ? "Streaming Active" : isIdle ? "Idle" : "Stream Closed"}
          </span>
        </div>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1.5 max-h-64 overflow-y-auto shadow-inner text-slate-200">
          {data?.logs?.map((log, index) => (
            <div key={index} className="flex gap-2.5">
              <span className="text-slate-500 select-none">{String(index + 1).padStart(2, "0")}</span>
              <span className={
                log.includes("complete") || log.includes("Success") || log.includes("Passed")
                  ? "text-emerald-400"
                  : log.includes("Writing") || log.includes("Creating")
                  ? "text-sky-300"
                  : log.includes("Stage")
                  ? "text-purple-300 font-semibold"
                  : "text-slate-300"
              }>
                {log}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
