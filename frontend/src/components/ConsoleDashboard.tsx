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
import WebTerminal from "./WebTerminal";
import AssetBrowser from "./AssetBrowser";
import SignOutButton from "./SignOutButton";
import AgentExecutionPanel from "./AgentExecutionPanel";
import HowToUsePanel from "./HowToUsePanel";

interface ConsoleDashboardProps {
  userName: string;
}

export default function ConsoleDashboard({ userName }: ConsoleDashboardProps) {
  const [activeTab, setActiveTab] = useState<"guide" | "terminal" | "agents">("guide");
  const [resetting, setResetting] = useState(false);

  const handleGlobalReset = async () => {
    if (!confirm("Reset Antigravity Swarm and workspace? This will stop running swarms and clean /workspace/target-app.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/swarm/reset", { method: "POST" });
      if (res.ok) {
        window.dispatchEvent(new Event("swarm-reset"));
      }
    } catch (err) {
      console.error("Global reset failed", err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Navigation Header */}
      <header className="px-6 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Antigravity Console</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-full font-mono font-medium">
                  Cloud Run Instance
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1">
                  <span>🛡️</span> Sandbox
                </span>
              </div>
            </div>
          </div>

          {/* Console View Switcher Tabs: How to Use / Guide is First */}
          <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
            <button
              onClick={() => setActiveTab("guide")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "guide"
                  ? "bg-white text-blue-600 shadow-xs border border-slate-200/80 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>📖</span>
              <span>How to Use / Guide</span>
            </button>

            <button
              onClick={() => setActiveTab("terminal")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "terminal"
                  ? "bg-white text-blue-600 shadow-xs border border-slate-200/80 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>💻</span>
              <span>Terminal & Assets</span>
            </button>

            <button
              onClick={() => setActiveTab("agents")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "agents"
                  ? "bg-white text-blue-600 shadow-xs border border-slate-200/80 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>🤖</span>
              <span>Agent Swarm Monitor</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>
          </nav>
        </div>

        {/* Right Header Status & Actions */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <button
            onClick={handleGlobalReset}
            disabled={resetting}
            title="Reset active swarm run and clean workspace"
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100/90 border border-rose-200 text-rose-700 text-xs font-medium transition flex items-center gap-1.5 shadow-2xs"
          >
            <span>🔄</span>
            <span>{resetting ? "Resetting..." : "Reset Swarm"}</span>
          </button>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
            <span className="text-slate-600">User: <strong className="text-slate-900 font-mono">{userName}</strong></span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              admin-role
            </span>
          </div>

          <SignOutButton />
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel: Generated Assets Browser (Visible across all tabs) */}
        <aside className="w-80 border-r border-slate-200 bg-white/85 backdrop-blur-md flex flex-col shrink-0 shadow-xs">
          <AssetBrowser />
        </aside>

        {/* View 1: Terminal & Workspace (Preserved in DOM to retain active bash session) */}
        <div className={activeTab === "terminal" ? "flex-1 flex flex-col p-5 bg-slate-50 min-w-0" : "hidden"}>
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Terminal CWD:</span>
              <code className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-blue-700 font-mono shadow-2xs font-semibold">
                /workspace/target-app
              </code>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("agents")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1"
              >
                <span>View Agent Execution</span> →
              </button>
              <div className="flex items-center gap-2 text-slate-400 font-mono">
                <span>xterm-256color</span>
                <span>•</span>
                <span>bash</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-2xl border border-slate-300/80 shadow-md overflow-hidden bg-slate-950 flex flex-col">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                <span className="ml-2 font-mono text-[11px] text-slate-300">bash — non-root (user: agy)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Cloud Run Gen2 Sandbox</span>
            </div>
            <div className="flex-1 min-h-0">
              <WebTerminal />
            </div>
          </div>
        </div>

        {/* View 2: Agent Swarm Monitor Panel */}
        {activeTab === "agents" && (
          <div className="flex-1 flex min-h-0 bg-slate-50 min-w-0">
            <AgentExecutionPanel />
          </div>
        )}

        {/* View 3: How to Use & Documentation */}
        {activeTab === "guide" && (
          <div className="flex-1 flex min-h-0 bg-slate-50 min-w-0">
            <HowToUsePanel onNavigateToTab={(tab) => setActiveTab(tab)} />
          </div>
        )}
      </div>
    </div>
  );
}
