"use client";

import { useState, useEffect, useRef } from "react";
import { useHypeshipAgents } from "@/lib/api";
import type { HypeshipAgentStatus } from "@/lib/types";

const STATUS_COLORS: Record<HypeshipAgentStatus, string> = {
  pending: "bg-amber-400",
  running: "bg-blue-400",
  finished: "bg-emerald-400",
  stopped: "bg-zinc-400",
  error: "bg-red-400",
};

function StatusDot({ status }: { status: HypeshipAgentStatus }) {
  const color = STATUS_COLORS[status] ?? "bg-zinc-400";
  const pulse = status === "pending" || status === "running";
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface HypeshipAddAgentModalProps {
  gridAgentIds: Set<string>;
  onAdd: (agentId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function HypeshipAddAgentModal({
  gridAgentIds,
  onAdd,
  onNewChat,
  onClose,
}: HypeshipAddAgentModalProps) {
  const { data } = useHypeshipAgents();
  const [filter, setFilter] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const agents = (data?.agents ?? []).filter((a) => {
    if (gridAgentIds.has(a.id)) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      a.preview?.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.source?.toLowerCase().includes(q)
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
          <span className="text-xs text-zinc-300 font-mono">
            add agent to grid
          </span>
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
            <div
              key={agent.id}
              data-item
              className={`w-full flex items-center gap-2 px-3 py-2 border-b border-zinc-900 transition-colors cursor-pointer ${
                i === highlightIdx ? "bg-zinc-800/80" : "hover:bg-zinc-800/80"
              }`}
              onClick={() => onAdd(agent.id)}
            >
              <StatusDot status={agent.status} />
              <span className="text-xs text-zinc-200 truncate flex-1 min-w-0 font-mono">
                {agent.preview || agent.id.slice(0, 16)}
              </span>
              <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                {agent.source}
              </span>
              <span className="text-[10px] text-zinc-700 font-mono shrink-0">
                {timeAgo(agent.updated_at)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2">
          <button
            onClick={onNewChat}
            className="w-full text-xs text-zinc-400 hover:text-zinc-100 font-mono py-1 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            [+new chat]
          </button>
        </div>
      </div>
    </div>
  );
}
