"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiKey, getGrid, addToGrid, removeFromGrid } from "@/lib/storage";
import { useAgents, launchAgent, stopAgent, deleteAgent } from "@/lib/api";
import type { Agent, GridItem } from "@/lib/types";
import { Pane } from "@/components/Pane";
import { AddAgentModal } from "@/components/AddAgentModal";
import { LaunchModal } from "@/components/LaunchModal";
import { PR_REVIEW_PROMPT } from "@/lib/prompts";

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function gridRows(count: number, cols: number): string {
  const rows = Math.ceil(count / cols);
  if (rows <= 1) return "";
  return `grid-rows-${rows}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewPrUrl, setReviewPrUrl] = useState("");
  const [reviewLaunching, setReviewLaunching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!getApiKey()) {
      router.push("/setup");
      return;
    }
    setGrid(getGrid());
    setMounted(true);
  }, [router]);

  const { data: agentsData } = useAgents();

  const agentMap = new Map<string, Agent>();
  agentsData?.agents?.forEach((a) => agentMap.set(a.id, a));

  const refreshGrid = useCallback(() => setGrid(getGrid()), []);

  function handleAdd(agentId: string) {
    addToGrid(agentId);
    refreshGrid();
    setShowAdd(false);
  }

  function handleRemove(agentId: string) {
    removeFromGrid(agentId);
    if (focusedId === agentId) setFocusedId(null);
    refreshGrid();
  }

  async function handleDelete(agentId: string) {
    removeFromGrid(agentId);
    if (focusedId === agentId) setFocusedId(null);
    refreshGrid();
    await deleteAgent(agentId);
  }

  function handleLaunched(agent: Agent) {
    addToGrid(agent.id);
    refreshGrid();
    setShowLaunch(false);
    setShowAdd(false);
    setFocusedId(agent.id);
  }

  async function launchReview(prUrl: string) {
    setReviewLaunching(true);
    try {
      const agent = await launchAgent({
        prompt: { text: `Review this PR: ${prUrl}\n\n${PR_REVIEW_PROMPT}` },
        model: "claude-4.6-opus-high-thinking",
        source: { prUrl },
        target: { autoBranch: false },
      });
      setShowReviewInput(false);
      setReviewPrUrl("");
      setReviewLaunching(false);
      handleLaunched(agent);
    } catch {
      setReviewLaunching(false);
    }
  }

  useEffect(() => {
    if (showAdd || showLaunch || showReviewInput) setFocusedId(null);
  }, [showAdd, showLaunch, showReviewInput]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+E — review PR quick-launch
      if (e.key === "e" && mod) {
        e.preventDefault();
        setShowAdd(false);
        setShowLaunch(false);
        setShowReviewInput(true);
        return;
      }

      // Cmd+K — launch new agent
      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowAdd(false);
        setShowLaunch(true);
        return;
      }

      // Cmd+Shift+A — add existing agent
      if (e.key === "a" && mod && e.shiftKey) {
        e.preventDefault();
        setShowLaunch(false);
        setShowAdd(true);
        return;
      }

      // Cmd+Shift+, — settings/key
      if ((e.key === "," || e.key === "<") && mod && e.shiftKey) {
        e.preventDefault();
        router.push("/setup");
        return;
      }

      // Cmd+Shift+O — open PR for focused pane
      if (e.key === "o" && mod && e.shiftKey) {
        e.preventDefault();
        if (focusedId) {
          const agent = agentMap.get(focusedId);
          if (agent?.target.prUrl) window.open(agent.target.prUrl, "_blank");
        }
        return;
      }

      // Cmd+Shift+Backspace — stop focused agent
      if (e.key === "Backspace" && mod && e.shiftKey) {
        e.preventDefault();
        if (focusedId) stopAgent(focusedId);
        return;
      }

      // Cmd+Shift+D — delete focused agent
      if (e.key === "d" && mod && e.shiftKey) {
        e.preventDefault();
        if (focusedId) handleDelete(focusedId);
        return;
      }

      // Cmd+Shift+X — close focused pane
      if (e.key === "x" && mod && e.shiftKey) {
        e.preventDefault();
        if (focusedId) handleRemove(focusedId);
        return;
      }

      // Cmd+Shift+1-9 — focus pane by number
      if (mod && e.shiftKey && e.code >= "Digit1" && e.code <= "Digit9") {
        e.preventDefault();
        const idx = parseInt(e.code.slice(5)) - 1;
        const currentGrid = getGrid().sort((a, b) => a.order - b.order);
        if (idx < currentGrid.length) {
          setFocusedId(currentGrid[idx].agentId);
        }
        return;
      }

      // Esc — unfocus pane / close modals
      if (e.key === "Escape") {
        if (showReviewInput) {
          setShowReviewInput(false);
          setReviewPrUrl("");
          return;
        }
        if (showAdd || showLaunch) return;
        setFocusedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focusedId, showAdd, showLaunch, showReviewInput]);

  if (!mounted) return null;

  const sorted = [...grid].sort((a, b) => a.order - b.order);
  const gridAgentIds = new Set(grid.map((g) => g.agentId));
  const paneCount = sorted.length;

  if (paneCount === 0) {
    return (
      <div className="h-dvh bg-zinc-950 flex flex-col">
        {/* Minimal bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 bg-zinc-900/60">
          <span className="text-[10px] text-zinc-500 font-mono">
            cursor-agents
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReviewInput(true)}
              className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
            >
              [⌘E review]
            </button>
            <button
              onClick={() => setShowLaunch(true)}
              className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
            >
              [⌘K new]
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
            >
              [⌘⇧A add]
            </button>
            <button
              onClick={() => router.push("/setup")}
              className="text-[10px] text-zinc-600 hover:text-zinc-300 font-mono"
            >
              [⌘⇧, key]
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-xs text-zinc-600 font-mono">no panes</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReviewInput(true)}
                className="text-xs text-zinc-500 hover:text-zinc-200 font-mono border border-zinc-800 px-3 py-1.5 hover:border-zinc-600 transition-colors"
              >
                ⌘E review PR
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="text-xs text-zinc-500 hover:text-zinc-200 font-mono border border-zinc-800 px-3 py-1.5 hover:border-zinc-600 transition-colors"
              >
                ⌘⇧A add existing
              </button>
              <button
                onClick={() => setShowLaunch(true)}
                className="text-xs text-zinc-500 hover:text-zinc-200 font-mono border border-zinc-800 px-3 py-1.5 hover:border-zinc-600 transition-colors"
              >
                ⌘K launch new
              </button>
            </div>
          </div>
        </div>
        {showAdd && (
          <AddAgentModal
            gridAgentIds={gridAgentIds}
            onAdd={handleAdd}
            onLaunchNew={() => {
              setShowAdd(false);
              setShowLaunch(true);
            }}
            onClose={() => setShowAdd(false)}
          />
        )}
        {showLaunch && (
          <LaunchModal
            onClose={() => setShowLaunch(false)}
            onLaunched={handleLaunched}
          />
        )}
        {showReviewInput && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => {
              if (!reviewLaunching) {
                setShowReviewInput(false);
                setReviewPrUrl("");
              }
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md border border-zinc-800 bg-zinc-950"
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
                <span className="text-xs text-zinc-300 font-mono">
                  review pr
                </span>
                <span className="text-[10px] text-zinc-600 font-mono ml-auto">
                  {reviewLaunching ? "launching..." : "[esc]"}
                </span>
              </div>
              <div className="px-3 py-3">
                <input
                  type="url"
                  value={reviewPrUrl}
                  onChange={(e) => setReviewPrUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      reviewPrUrl.trim() &&
                      !reviewLaunching
                    )
                      launchReview(reviewPrUrl.trim());
                    if (e.key === "Escape" && !reviewLaunching) {
                      setShowReviewInput(false);
                      setReviewPrUrl("");
                    }
                  }}
                  placeholder="paste pr url, hit enter"
                  autoFocus
                  disabled={reviewLaunching}
                  className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-dvh bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-0.5 bg-zinc-900/60 shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono">
          cursor-agents — {paneCount} pane{paneCount !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReviewInput(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
          >
            [⌘E review]
          </button>
          <button
            onClick={() => setShowLaunch(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
          >
            [⌘K new]
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
          >
            [⌘⇧A add]
          </button>
          {focusedId && (
            <>
              <button
                onClick={() => stopAgent(focusedId)}
                className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
              >
                [⌘⇧⌫ stop]
              </button>
              <button
                onClick={() => handleRemove(focusedId)}
                className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
              >
                [⌘⇧X close]
              </button>
              <button
                onClick={() => handleDelete(focusedId)}
                className="text-[10px] text-red-500/70 hover:text-red-400 font-mono"
              >
                [⌘⇧D delete]
              </button>
            </>
          )}
          <button
            onClick={() => router.push("/setup")}
            className="text-[10px] text-zinc-600 hover:text-zinc-300 font-mono"
          >
            [⌘⇧, key]
          </button>
        </div>
      </div>

      {/* Pane grid */}
      <div
        className={`flex-1 grid ${gridCols(paneCount)} auto-rows-fr min-h-0 overflow-hidden`}
      >
        {sorted.map((item) => {
          const agent = agentMap.get(item.agentId);
          if (!agent) {
            return (
              <div
                key={item.agentId}
                className="flex items-center justify-center border-r border-b border-zinc-800 text-[10px] text-zinc-600 font-mono"
              >
                <button
                  onClick={() => handleRemove(item.agentId)}
                  className="hover:text-zinc-300"
                >
                  {item.agentId.slice(0, 12)}… [remove]
                </button>
              </div>
            );
          }
          return (
            <Pane
              key={agent.id}
              agent={agent}
              focused={focusedId === agent.id}
              onFocus={() => setFocusedId(agent.id)}
              onClose={() => handleRemove(agent.id)}
              onDelete={() => handleDelete(agent.id)}
            />
          );
        })}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddAgentModal
          gridAgentIds={gridAgentIds}
          onAdd={handleAdd}
          onLaunchNew={() => {
            setShowAdd(false);
            setShowLaunch(true);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showLaunch && (
        <LaunchModal
          onClose={() => setShowLaunch(false)}
          onLaunched={handleLaunched}
        />
      )}
      {showReviewInput && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            if (!reviewLaunching) {
              setShowReviewInput(false);
              setReviewPrUrl("");
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-zinc-800 bg-zinc-950"
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
              <span className="text-xs text-zinc-300 font-mono">review pr</span>
              <span className="text-[10px] text-zinc-600 font-mono ml-auto">
                {reviewLaunching ? "launching..." : "[esc]"}
              </span>
            </div>
            <div className="px-3 py-3">
              <input
                type="url"
                value={reviewPrUrl}
                onChange={(e) => setReviewPrUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    reviewPrUrl.trim() &&
                    !reviewLaunching
                  )
                    launchReview(reviewPrUrl.trim());
                  if (e.key === "Escape" && !reviewLaunching) {
                    setShowReviewInput(false);
                    setReviewPrUrl("");
                  }
                }}
                placeholder="paste pr url, hit enter"
                autoFocus
                disabled={reviewLaunching}
                className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
