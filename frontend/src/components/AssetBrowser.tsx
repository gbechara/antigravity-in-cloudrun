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

interface AssetNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: AssetNode[];
}

export default function AssetBrowser() {
  const [activeAsset, setActiveAsset] = useState<string>("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const fetchAssets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/assets");
      if (res.ok) {
        const json = await res.json();
        setAssets(json.assets || []);
      }
    } catch (err) {
      if (!silent) console.error("Failed to load asset tree", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSelectFile = async (filePath: string) => {
    setActiveAsset(filePath);
    try {
      const res = await fetch(`/api/assets?file=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const json = await res.json();
        setFileContent(json.content);
      } else {
        setFileContent(null);
      }
    } catch (e) {
      setFileContent(null);
    }
  };

  const handleResetAssets = async () => {
    if (!confirm("Reset generated assets? This will empty /workspace/target-app so you can observe new files created.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/assets", { method: "DELETE" });
      if (res.ok) {
        setAssets([]);
        setFileContent(null);
        setActiveAsset("");
        setResetFeedback("Assets reset to 0. Run swarm to see files created live!");
        setTimeout(() => setResetFeedback(null), 4000);
        window.dispatchEvent(new Event("swarm-reset"));
      }
    } catch (err) {
      console.error("Reset assets failed", err);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    // Live background polling so newly generated assets pop in automatically
    const pollInterval = setInterval(() => {
      fetchAssets(true);
    }, 2500);

    const handleResetEvent = () => {
      fetchAssets(true);
      setFileContent(null);
      setActiveAsset("");
    };
    window.addEventListener("swarm-reset", handleResetEvent);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("swarm-reset", handleResetEvent);
    };
  }, []);

  const countFiles = (nodes: AssetNode[]): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.type === "file") count++;
      if (node.children) count += countFiles(node.children);
    }
    return count;
  };

  const totalFiles = countFiles(assets);

  const renderNode = (node: AssetNode, depth: number = 0) => {
    if (node.type === "folder") {
      const hasChildren = node.children && node.children.length > 0;
      return (
        <div key={node.path} className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-800 font-semibold py-0.5 select-none">
            <span className="text-amber-500 text-xs">📁</span>
            <span className="font-mono text-[11px]">{node.name}</span>
            {!hasChildren && <span className="text-[10px] text-slate-400 font-normal italic">(empty)</span>}
          </div>
          {hasChildren && (
            <div className="pl-3 border-l border-slate-200 ml-1.5 space-y-1">
              {node.children!.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = activeAsset === node.path;
    return (
      <div
        key={node.path}
        onClick={() => handleSelectFile(node.path)}
        className={`cursor-pointer px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
          isSelected
            ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs"
            : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
        }`}
      >
        <span className="text-blue-600 text-xs shrink-0">📄</span>
        <span className="font-mono truncate text-[11px]">{node.name}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full text-xs bg-white/70">
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white/95">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">Generated Assets</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-mono font-medium">
            {totalFiles} {totalFiles === 1 ? "file" : "files"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchAssets()}
            disabled={loading}
            title="Refresh filesystem now"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
          >
            {loading ? "..." : "↻"}
          </button>
          <button
            onClick={handleResetAssets}
            disabled={resetting}
            title="Reset generated assets in /workspace/target-app"
            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-medium text-rose-700 transition flex items-center gap-1 shadow-2xs"
          >
            <span>🗑️</span>
            <span>{resetting ? "Clearing..." : "Reset Assets"}</span>
          </button>
        </div>
      </div>

      {resetFeedback && (
        <div className="mx-3 mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 font-medium flex items-center gap-1.5 shadow-2xs">
          <span>✨</span>
          <span>{resetFeedback}</span>
        </div>
      )}

      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {totalFiles === 0 && assets.length === 0 && (
          <div className="p-5 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
            <p className="text-xs font-medium text-slate-600">No generated files yet.</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Launch the swarm from <strong>How to Use / Guide</strong> or run in terminal:
            </p>
            <code className="block bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-blue-700 font-mono text-[11px] shadow-2xs">
              swarm run &quot;Build API&quot;
            </code>
          </div>
        )}

        {assets.map((node) => renderNode(node))}

        {fileContent && (
          <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-mono text-blue-700 font-semibold truncate max-w-[200px]">{activeAsset}</span>
              <button onClick={() => setFileContent(null)} className="hover:text-slate-900 text-xs px-1">✕</button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 font-mono text-[10px] overflow-x-auto max-h-56 leading-relaxed shadow-sm">
              {fileContent}
            </pre>
          </div>
        )}
      </div>

      <div className="p-3.5 border-t border-slate-200 bg-slate-50/90 text-[11px] text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700">Quick Sandbox CLI:</p>
        <code className="block bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-blue-700 font-mono shadow-2xs">
          swarm run &quot;Build API&quot;
        </code>
        <code className="block bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-emerald-700 font-mono shadow-2xs">
          swarm validate
        </code>
        <code className="block bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-rose-700 font-mono shadow-2xs">
          swarm reset
        </code>
      </div>
    </div>
  );
}
