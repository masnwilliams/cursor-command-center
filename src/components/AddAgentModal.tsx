"use client";

import { useState, useEffect, useRef } from "react";
import { useAgents } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface AddAgentModalProps {
  gridAgentIds: Set<string>;
  onAdd: (agentId: string) => void;
  onLaunchNew: () => void;
  onClose: () => void;
}

export function AddAgentModal({
  gridAgentIds,
  onAdd,
  onLaunchNew,
  onClose,
}: AddAgentModalProps) {
  const { data } = useAgents();
  const [filter, setFilter] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

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
    setHighlightIdx(0);
  }, [filter]);

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

  function scrollToIdx(idx: number) {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-item]");
    items[idx]?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(highlightIdx + 1, agents.length - 1);
      setHighlightIdx(next);
      scrollToIdx(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(highlightIdx - 1, 0);
      setHighlightIdx(next);
      scrollToIdx(next);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (agents[highlightIdx]) onAdd(agents[highlightIdx].id);
      return;
    }
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
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
          >
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
            onKeyDown={handleKeyDown}
          />
        </div>

        <div ref={listRef} className="max-h-[50dvh] overflow-y-auto">
          {agents.length === 0 && (
            <p className="py-6 text-center text-xs text-zinc-600 font-mono">
              {data ? "no agents to add" : "loading..."}
            </p>
          )}
          {agents.map((agent, i) => (
            <button
              data-item
              key={agent.id}
              onClick={() => onAdd(agent.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-zinc-900 transition-colors ${
                i === highlightIdx ? "bg-zinc-800/80" : "hover:bg-zinc-800/80"
              }`}
            >
              <StatusBadge status={agent.status} />
              <span className="text-xs text-zinc-200 truncate flex-1 min-w-0">
                {agent.name || agent.id}
              </span>
              <span className="text-[10px] text-zinc-600 truncate max-w-[140px]">
                {repoName(agent)}
              </span>
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
