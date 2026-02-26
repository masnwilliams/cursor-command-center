"use client";

import { useState, useEffect, useRef } from "react";
import { useModels, useRepositories, useBranches, launchAgent } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { SearchSelect } from "./SearchSelect";

interface LaunchModalProps {
  onClose: () => void;
  onLaunched: (agent: Agent) => void;
}

export function LaunchModal({ onClose, onLaunched }: LaunchModalProps) {
  const { data: modelsData } = useModels();
  const { data: reposData } = useRepositories();

  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-4.6-opus-high-thinking");
  const [branchName, setBranchName] = useState("");
  const [autoCreatePr, setAutoCreatePr] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLaunch() {
    if (!prompt.trim()) {
      setError("prompt required");
      return;
    }
    if (!repo) {
      setError("select a repository");
      return;
    }

    setLaunching(true);
    setError(null);

    try {
      const agent = await launchAgent({
        prompt: { text: prompt.trim() },
        model: model || undefined,
        source: { repository: repo, ref: ref || undefined },
        target: {
          autoCreatePr: autoCreatePr || undefined,
          branchName: branchName.trim() || undefined,
        },
      });
      onLaunched(agent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "launch failed");
      setLaunching(false);
    }
  }

  const launchRef = useRef(handleLaunch);
  launchRef.current = handleLaunch;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        launchRef.current();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { data: branchesData } = useBranches(repo || null);

  const repos = reposData?.repositories ?? [];
  const models = modelsData?.models ?? [];
  const branches = branchesData?.branches ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-zinc-800 bg-zinc-950 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">launch agent</span>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs font-mono">
            [esc]
          </button>
        </div>

        <div className="px-3 py-3 space-y-3 max-h-[70dvh] overflow-y-auto">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">repository</label>
            <SearchSelect
              value={repo}
              onChange={setRepo}
              options={repos.map((r) => ({ value: r.repository, label: `${r.owner}/${r.name}` }))}
              placeholder="search repos..."
              loading={!repos.length}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">branch/ref</label>
            <SearchSelect
              value={ref}
              onChange={setRef}
              options={branches.map((b) => ({ value: b, label: b }))}
              placeholder="main"
              loading={!!repo && !branchesData}
              allowCustom
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="what should the agent do?"
              rows={4}
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 resize-none font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">model</label>
            <SearchSelect
              value={model}
              onChange={setModel}
              options={[
                { value: "", label: "auto" },
                ...models.map((m) => ({ value: m, label: m })),
              ]}
              placeholder="auto"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">branch name</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/my-branch"
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreatePr}
              onChange={(e) => setAutoCreatePr(e.target.checked)}
              className="border-zinc-700 bg-zinc-900"
            />
            <span className="text-xs text-zinc-400 font-mono">auto-create pr</span>
          </label>

          {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 font-mono transition-colors"
          >
            cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="flex-1 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-40 font-mono transition-colors"
          >
            {launching ? "launching..." : "launch ⌘↵"}
          </button>
        </div>
      </div>
    </div>
  );
}
