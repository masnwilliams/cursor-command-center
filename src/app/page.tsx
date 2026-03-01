"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import {
  getApiKey,
  getGithubToken,
  getGrid,
  addToGrid,
  removeFromGrid,
  replaceInGrid,
} from "@/lib/storage";
import { useAgents, launchAgent, stopAgent, deleteAgent } from "@/lib/api";
import type {
  Agent,
  GridItem,
  LaunchAgentRequest,
  ConversationResponse,
} from "@/lib/types";
import { Pane } from "@/components/Pane";
import { AddAgentModal } from "@/components/AddAgentModal";
import { LaunchModal } from "@/components/LaunchModal";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import { ConfirmMergeModal } from "@/components/ConfirmMergeModal";
import { AddReviewerModal } from "@/components/AddReviewerModal";
import { PR_REVIEW_PROMPT } from "@/lib/prompts";

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

interface PendingLaunch {
  repoLabel: string;
  prompt: string;
  error?: string;
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
  const [mergeTarget, setMergeTarget] = useState<{
    prUrl: string;
    agentName: string;
  } | null>(null);
  const [reviewerTarget, setReviewerTarget] = useState<{
    prUrl: string;
    agentName: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pendingLaunches, setPendingLaunches] = useState<
    Map<string, PendingLaunch>
  >(new Map());

  useEffect(() => {
    if (!getApiKey() || !getGithubToken()) {
      router.push("/setup");
      return;
    }
    setGrid(getGrid());
    setMounted(true);
  }, [router]);

  const { data: agentsData } = useAgents();

  const agentMap = new Map<string, Agent>();
  agentsData?.agents?.forEach((a) => agentMap.set(a.id, a));

  pendingLaunches.forEach((pending, tempId) => {
    if (!agentMap.has(tempId)) {
      agentMap.set(tempId, {
        id: tempId,
        name: pending.repoLabel || "launching...",
        status: pending.error ? "ERROR" : "CREATING",
        source: { repository: "" },
        target: {
          autoCreatePr: false,
          openAsCursorGithubApp: false,
          skipReviewerRequest: false,
        },
        createdAt: new Date().toISOString(),
      });
    }
  });

  const refreshGrid = useCallback(() => setGrid(getGrid()), []);

  function removePending(id: string) {
    setPendingLaunches((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function handleAdd(agentId: string) {
    addToGrid(agentId);
    refreshGrid();
    setShowAdd(false);
  }

  function handleRemove(agentId: string) {
    removeFromGrid(agentId);
    if (focusedId === agentId) setFocusedId(null);
    removePending(agentId);
    refreshGrid();
  }

  async function handleDelete(agentId: string) {
    removeFromGrid(agentId);
    if (focusedId === agentId) setFocusedId(null);
    refreshGrid();
    if (pendingLaunches.has(agentId)) {
      removePending(agentId);
    } else {
      await deleteAgent(agentId);
    }
  }

  function handleOptimisticLaunch(
    request: LaunchAgentRequest,
    repoLabel: string,
    prompt: string,
  ) {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    addToGrid(tempId);
    refreshGrid();

    setPendingLaunches((prev) => {
      const next = new Map(prev);
      next.set(tempId, { repoLabel, prompt });
      return next;
    });

    setShowLaunch(false);
    setShowAdd(false);
    setShowReviewInput(false);
    setReviewPrUrl("");
    setFocusedId(tempId);

    launchAgent(request)
      .then((agent) => {
        replaceInGrid(tempId, agent.id);
        refreshGrid();
        removePending(tempId);
        setFocusedId((prev) => (prev === tempId ? agent.id : prev));
        mutate("/api/agents?limit=100");
      })
      .catch((err) => {
        setPendingLaunches((prev) => {
          const entry = prev.get(tempId);
          if (!entry) return prev;
          const next = new Map(prev);
          next.set(tempId, {
            ...entry,
            error: err instanceof Error ? err.message : "launch failed",
          });
          return next;
        });
      });
  }

  function launchReview(prUrl: string) {
    handleOptimisticLaunch(
      {
        prompt: { text: `Review this PR: ${prUrl}\n\n${PR_REVIEW_PROMPT}` },
        model: "claude-4.6-opus-high-thinking",
        source: { prUrl },
        target: { autoBranch: false },
      },
      prUrl,
      `Review this PR: ${prUrl}`,
    );
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
      const isPending = pendingLaunches.has(focusedAgent.id);

      if (isActive && !isPending) {
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
        cmds.push({
          id: "add-reviewer",
          label: "add reviewer to pr",
          section: "focused pane",
          action: () =>
            setReviewerTarget({
              prUrl: focusedAgent.target.prUrl!,
              agentName: focusedAgent.name || focusedAgent.id,
            }),
        });
        cmds.push({
          id: "merge-pr",
          label: "merge pr",
          section: "focused pane",
          destructive: true,
          action: () =>
            setMergeTarget({
              prUrl: focusedAgent.target.prUrl!,
              agentName: focusedAgent.name || focusedAgent.id,
            }),
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
      label: "settings",
      section: "app",
      action: () => router.push("/setup"),
    });

    return cmds;
  }, [focusedAgent, focusedId, sorted, agentMap]);

  useEffect(() => {
    if (showAdd || showLaunch || showReviewInput || mergeTarget || reviewerTarget)
      setFocusedId(null);
  }, [showAdd, showLaunch, showReviewInput, mergeTarget, reviewerTarget]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowPalette((v) => !v);
        setShowAdd(false);
        setShowLaunch(false);
        setShowReviewInput(false);
        setMergeTarget(null);
        setReviewerTarget(null);
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
            onLaunch={handleOptimisticLaunch}
          />
        )}
        {showReviewInput && renderReviewInput()}
        {mergeTarget && (
          <ConfirmMergeModal
            prUrl={mergeTarget.prUrl}
            agentName={mergeTarget.agentName}
            onClose={() => setMergeTarget(null)}
            onMerged={() => setMergeTarget(null)}
          />
        )}
        {reviewerTarget && (
          <AddReviewerModal
            prUrl={reviewerTarget.prUrl}
            agentName={reviewerTarget.agentName}
            onClose={() => setReviewerTarget(null)}
          />
        )}
      </div>
    );
  }

  function renderReviewInput() {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={() => {
          setShowReviewInput(false);
          setReviewPrUrl("");
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md border border-zinc-800 bg-zinc-950"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
            <span className="text-xs text-zinc-300 font-mono">review pr</span>
            <span className="text-[10px] text-zinc-600 font-mono ml-auto">
              [esc]
            </span>
          </div>
          <div className="px-3 py-3">
            <input
              type="url"
              value={reviewPrUrl}
              onChange={(e) => setReviewPrUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && reviewPrUrl.trim())
                  launchReview(reviewPrUrl.trim());
                if (e.key === "Escape") {
                  setShowReviewInput(false);
                  setReviewPrUrl("");
                }
              }}
              placeholder="paste pr url, hit enter"
              autoFocus
              className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
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
          const pending = pendingLaunches.get(item.agentId);
          const pendingConvo: ConversationResponse | undefined = pending
            ? {
                id: item.agentId,
                messages: [
                  {
                    id: `${item.agentId}-prompt`,
                    type: "user_message",
                    text: pending.prompt,
                  },
                  ...(pending.error
                    ? [
                        {
                          id: `${item.agentId}-error`,
                          type: "assistant_message" as const,
                          text: `launch failed: ${pending.error}`,
                        },
                      ]
                    : []),
                ],
              }
            : undefined;
          return (
            <Pane
              key={agent.id}
              agent={agent}
              focused={focusedId === agent.id}
              onFocus={() => setFocusedId(agent.id)}
              onClose={() => handleRemove(agent.id)}
              onDelete={() => handleDelete(agent.id)}
              conversation={pendingConvo}
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
          onLaunch={handleOptimisticLaunch}
        />
      )}
      {showReviewInput && renderReviewInput()}
      {mergeTarget && (
        <ConfirmMergeModal
          prUrl={mergeTarget.prUrl}
          agentName={mergeTarget.agentName}
          onClose={() => setMergeTarget(null)}
          onMerged={() => setMergeTarget(null)}
        />
      )}
      {reviewerTarget && (
        <AddReviewerModal
          prUrl={reviewerTarget.prUrl}
          agentName={reviewerTarget.agentName}
          onClose={() => setReviewerTarget(null)}
        />
      )}
    </div>
  );
}
