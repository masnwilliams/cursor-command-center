"use client";

import { useState, useEffect } from "react";
import { useAgents } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface AddAgentModalProps {
  gridAgentIds: Set<string>;
  onAdd: (agentId: string) => void;
  onLaunchNew: () => void;
  onClose: () => void;
}

export function AddAgentModal({ gridAgentIds, onAdd, onLaunchNew, onClose }: AddAgentModalProps) {
  const { data } = useAgents();
  const [filter, setFilter] = useState("");

  const agents = (data?.agents ?? []).filter((a) => {
    if (gridAgentIds.has(a.id)) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.source.repository?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function repoName(agent: Agent): string {
    const url = agent.source.repository ?? "";
    return url.replace(/^(https?:\/\/)?github\.com\//, "");
  }

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
          <span className="text-xs text-zinc-300 font-mono">add pane</span>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs font-mono">
            [esc]
          </button>
        </div>

        <div className="px-3 py-2 border-b border-zinc-800">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter..."
            autoFocus
            className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
          />
        </div>

        <div className="max-h-[50dvh] overflow-y-auto">
          {agents.length === 0 && (
            <p className="py-6 text-center text-xs text-zinc-600 font-mono">
              {data ? "no agents to add" : "loading..."}
            </p>
          )}
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onAdd(agent.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/80 border-b border-zinc-900 transition-colors"
            >
              <StatusBadge status={agent.status} />
              <span className="text-xs text-zinc-200 truncate flex-1 min-w-0">{agent.name || agent.id}</span>
              <span className="text-[10px] text-zinc-600 truncate max-w-[140px]">{repoName(agent)}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2">
          <button
            onClick={onLaunchNew}
            className="w-full text-xs text-zinc-400 hover:text-zinc-100 font-mono py-1 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            [+launch new agent]
          </button>
        </div>
      </div>
    </div>
  );
}
