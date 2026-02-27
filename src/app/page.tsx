"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getApiKey, getGrid, addToGrid, removeFromGrid } from "@/lib/storage";
import { useAgents, launchAgent, stopAgent, deleteAgent } from "@/lib/api";
import type { Agent, GridItem } from "@/lib/types";
import { Pane } from "@/components/Pane";
import { AddAgentModal } from "@/components/AddAgentModal";
import { LaunchModal } from "@/components/LaunchModal";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import { PR_REVIEW_PROMPT } from "@/lib/prompts";

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export default function DashboardPage() {
  const router = useRouter();
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
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

  const focusedAgent = focusedId ? agentMap.get(focusedId) : null;
  const sorted = useMemo(
    () => [...grid].sort((a, b) => a.order - b.order),
    [grid],
  );

  const commands = useMemo(() => {
    const cmds: Command[] = [];

    cmds.push({
      id: "launch",
      label: "launch new agent",
      section: "agents",
      action: () => setShowLaunch(true),
    });
    cmds.push({
      id: "add",
      label: "add existing agent to grid",
      section: "agents",
      action: () => setShowAdd(true),
    });
    cmds.push({
      id: "review",
      label: "review pr",
      section: "agents",
      action: () => setShowReviewInput(true),
    });

    if (focusedAgent) {
      const isActive =
        focusedAgent.status === "RUNNING" ||
        focusedAgent.status === "CREATING";

      if (isActive) {
        cmds.push({
          id: "stop",
          label: `stop ${focusedAgent.name || focusedAgent.id}`,
          section: "focused pane",
          action: () => stopAgent(focusedAgent.id),
        });
      }
      cmds.push({
        id: "close",
        label: `close pane (keep agent)`,
        section: "focused pane",
        action: () => handleRemove(focusedAgent.id),
      });
      if (focusedAgent.target.prUrl) {
        cmds.push({
          id: "open-pr",
          label: "open pr in browser",
          section: "focused pane",
          action: () => window.open(focusedAgent.target.prUrl!, "_blank"),
        });
      }
      if (focusedAgent.target.url) {
        cmds.push({
          id: "open-cursor",
          label: "open in cursor",
          section: "focused pane",
          action: () => window.open(focusedAgent.target.url!, "_blank"),
        });
      }
      cmds.push({
        id: "delete",
        label: `delete ${focusedAgent.name || focusedAgent.id}`,
        section: "focused pane",
        destructive: true,
        action: () => handleDelete(focusedAgent.id),
      });
    }

    sorted.forEach((item, i) => {
      const a = agentMap.get(item.agentId);
      if (!a || a.id === focusedId) return;
      cmds.push({
        id: `focus-${a.id}`,
        label: `focus ${a.name || a.id}`,
        section: "panes",
        action: () => setFocusedId(a.id),
      });
    });

    cmds.push({
      id: "settings",
      label: "settings / api key",
      section: "app",
      action: () => router.push("/setup"),
    });

    return cmds;
  }, [focusedAgent, focusedId, sorted, agentMap]);

  useEffect(() => {
    if (showAdd || showLaunch || showReviewInput)
      setFocusedId(null);
  }, [showAdd, showLaunch, showReviewInput]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowPalette((v) => !v);
        setShowAdd(false);
        setShowLaunch(false);
        setShowReviewInput(false);
        return;
      }

      if (e.key === "Escape") {
        if (showPalette) {
          setShowPalette(false);
          return;
        }
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
  }, [showPalette, showAdd, showLaunch, showReviewInput]);

  if (!mounted) return null;

  const gridAgentIds = new Set(grid.map((g) => g.agentId));
  const paneCount = sorted.length;

  if (paneCount === 0) {
    return (
      <div className="h-dvh bg-zinc-950 flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 bg-zinc-900/60">
          <span className="text-[10px] text-zinc-500 font-mono">
            cursor-agents
          </span>
          <button
            onClick={() => setShowPalette(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
          >
            [⌘K]
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-xs text-zinc-600 font-mono">no panes</p>
            <button
              onClick={() => setShowPalette(true)}
              className="text-xs text-zinc-500 hover:text-zinc-200 font-mono border border-zinc-800 px-4 py-2 hover:border-zinc-600 transition-colors"
            >
              ⌘K open command palette
            </button>
          </div>
        </div>
        {showPalette && (
          <CommandPalette
            commands={commands}
            onClose={() => setShowPalette(false)}
          />
        )}
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
        {showReviewInput && renderReviewInput()}
      </div>
    );
  }

  function renderReviewInput() {
    return (
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
    );
  }

  return (
    <div className="h-dvh bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-0.5 bg-zinc-900/60 shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono">
          cursor-agents — {paneCount} pane{paneCount !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowPalette(true)}
          className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
        >
          [⌘K]
        </button>
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
      {showPalette && (
        <CommandPalette
          commands={commands}
          onClose={() => setShowPalette(false)}
        />
      )}
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
      {showReviewInput && renderReviewInput()}
    </div>
  );
}
