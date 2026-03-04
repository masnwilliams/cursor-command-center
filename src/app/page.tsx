"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import {
  getApiKey,
  getGithubToken,
  getGrid,
  addToGrid,
  removeFromGrid,
  replaceInGrid,
  getSoundEnabled,
  setSoundEnabled,
} from "@/lib/storage";
import {
  playCompletionSound,
  unlockAudio,
  ensureAudioUnlockListener,
  showCompletionNotification,
  requestNotificationPermission,
  hasPendingSound,
  clearPendingSound,
} from "@/lib/sounds";
import {
  useAgents,
  useReviewRequests,
  usePrStatus,
  launchAgent,
  stopAgent,
  markPrReady,
} from "@/lib/api";
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
import { DiffBar } from "@/components/DiffBar";
import { StatusBadge } from "@/components/StatusBadge";
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
  const [reviewSelectedIndex, setReviewSelectedIndex] = useState(-1);
  const [mergeTarget, setMergeTarget] = useState<{
    prUrl: string;
    agentName: string;
  } | null>(null);
  const [reviewerTarget, setReviewerTarget] = useState<{
    prUrl: string;
    agentName: string;
  } | null>(null);
  const [showDiffBar, setShowDiffBar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingLaunches, setPendingLaunches] = useState<
    Map<string, PendingLaunch>
  >(new Map());
  const [soundOn, setSoundOn] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingBlink, setPendingBlink] = useState(false);
  const prevStatuses = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!getApiKey() || !getGithubToken()) {
      router.push("/setup");
      return;
    }
    setGrid(getGrid());
    setSoundOn(getSoundEnabled());
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setMounted(true);
    ensureAudioUnlockListener();
    requestNotificationPermission();
    const clearBlink = () => setPendingBlink(false);
    window.addEventListener("click", clearBlink, true);
    window.addEventListener("touchstart", clearBlink, true);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("click", clearBlink, true);
      window.removeEventListener("touchstart", clearBlink, true);
    };
  }, [router]);

  const { data: agentsData } = useAgents();
  const { data: reviewData } = useReviewRequests();
  const reviewPrs = reviewData?.prs ?? [];

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

  useEffect(() => {
    if (!mounted) return;
    const gridIds = new Set(grid.map((g) => g.agentId));
    let finishedAgent: Agent | null = null;

    for (const [id, agent] of agentMap) {
      if (!gridIds.has(id)) continue;
      const prev = prevStatuses.current.get(id);
      if (
        prev &&
        (prev === "RUNNING" || prev === "CREATING") &&
        agent.status === "FINISHED"
      ) {
        finishedAgent = agent;
      }
    }

    const next = new Map<string, string>();
    for (const [id, agent] of agentMap) {
      if (gridIds.has(id)) next.set(id, agent.status);
    }
    prevStatuses.current = next;

    if (finishedAgent && soundOn) {
      playCompletionSound().then(() => {
        if (hasPendingSound()) setPendingBlink(true);
      });
      showCompletionNotification(finishedAgent.name || finishedAgent.id);
    }
  });

  const openReviewUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const item of grid) {
      const a = agentMap.get(item.agentId);
      if (a?.source.prUrl) urls.add(a.source.prUrl);
    }
    return urls;
  }, [grid, agentMap]);

  const pendingReviewPrs = useMemo(
    () => reviewPrs.filter((pr) => !openReviewUrls.has(pr.url)),
    [reviewPrs, openReviewUrls],
  );

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

  function renderPaneItem(item: GridItem, forceFocused?: boolean) {
    const agent = agentMap.get(item.agentId);
    if (!agent) {
      return (
        <div
          key={item.agentId}
          className="flex flex-1 items-center justify-center border-r border-b border-zinc-800 text-[10px] text-zinc-600 font-mono"
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
        focused={forceFocused ?? focusedId === agent.id}
        onFocus={forceFocused ? () => {} : () => setFocusedId(agent.id)}
        onClose={() => handleRemove(agent.id)}
        conversation={pendingConvo}
      />
    );
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
  const { data: focusedPrStatus } = usePrStatus(focusedAgent?.target.prUrl);
  const sorted = useMemo(
    () => [...grid].sort((a, b) => a.order - b.order),
    [grid],
  );

  useEffect(() => {
    if (!isMobile || !mounted || sorted.length === 0) return;
    if (!focusedId || !sorted.some((s) => s.agentId === focusedId)) {
      setFocusedId(sorted[0].agentId);
    }
  }, [isMobile, mounted, sorted, focusedId]);

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
      const hasChanges =
        focusedAgent.target.prUrl ||
        focusedAgent.linesAdded != null ||
        focusedAgent.filesChanged != null;
      if (hasChanges) {
        cmds.push({
          id: "diff",
          label: showDiffBar ? "hide diff" : "view diff",
          section: "focused pane",
          action: () => setShowDiffBar((v) => !v),
        });
      }
      if (focusedAgent.target.prUrl) {
        cmds.push({
          id: "open-pr",
          label: "open pr in browser",
          section: "focused pane",
          action: () => window.open(focusedAgent.target.prUrl!, "_blank"),
        });
        if (focusedPrStatus?.status === "draft") {
          cmds.push({
            id: "mark-ready",
            label: "mark pr ready for review",
            section: "focused pane",
            action: () => markPrReady(focusedAgent.target.prUrl!),
          });
        }
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
      id: "toggle-sound",
      label: soundOn ? "mute completion sound" : "unmute completion sound",
      section: "app",
      action: () => {
        unlockAudio();
        clearPendingSound();
        setPendingBlink(false);
        const next = !soundOn;
        setSoundOn(next);
        setSoundEnabled(next);
        if (next) playCompletionSound();
      },
    });

    cmds.push({
      id: "settings",
      label: "settings",
      section: "app",
      action: () => router.push("/setup"),
    });

    return cmds;
  }, [focusedAgent, focusedId, focusedPrStatus, sorted, agentMap, showDiffBar, soundOn]);

  useEffect(() => {
    if (showAdd || showLaunch || showReviewInput || mergeTarget || reviewerTarget) {
      setFocusedId(null);
      setShowDiffBar(false);
    }
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
        if (showDiffBar) {
          setShowDiffBar(false);
          return;
        }
        setFocusedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showPalette, showAdd, showLaunch, showReviewInput, showDiffBar]);

  if (!mounted) return null;

  const gridAgentIds = new Set(grid.map((g) => g.agentId));
  const paneCount = sorted.length;

  if (paneCount === 0) {
    return (
      <div className="h-full bg-zinc-950 flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 sm:px-2 py-2 sm:py-1 bg-zinc-900/60">
          <span className="text-xs sm:text-[10px] text-zinc-500 font-mono">
            cursor-agents
          </span>
          <div className="flex items-center gap-4 sm:gap-3">
            <button
              onClick={() => setShowReviewInput(true)}
              className="text-xs sm:text-[10px] text-zinc-500 hover:text-zinc-200 font-mono flex items-center gap-1"
            >
              {pendingReviewPrs.length > 0 ? (
                <>
                  <span className="text-amber-400">{pendingReviewPrs.length}</span>
                  <span>review{pendingReviewPrs.length !== 1 ? "s" : ""}</span>
                </>
              ) : (
                <span>0 reviews</span>
              )}
            </button>
            <button
              onClick={() => setShowPalette(true)}
              className="text-xs sm:text-[10px] text-zinc-500 hover:text-zinc-200 font-mono py-1 sm:py-0"
            >
              {isMobile ? "menu" : "[⌘K]"}
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-xs text-zinc-600 font-mono">no panes</p>
            <button
              onClick={() => setShowPalette(true)}
              className="text-sm sm:text-xs text-zinc-500 hover:text-zinc-200 font-mono border border-zinc-800 px-5 sm:px-4 py-3 sm:py-2 hover:border-zinc-600 transition-colors"
            >
              {isMobile ? "open command palette" : "⌘K open command palette"}
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
    const filteredPrs = reviewPrUrl.trim()
      ? pendingReviewPrs.filter(
          (pr) =>
            pr.title.toLowerCase().includes(reviewPrUrl.toLowerCase()) ||
            pr.repo.toLowerCase().includes(reviewPrUrl.toLowerCase()) ||
            pr.url.includes(reviewPrUrl),
        )
      : pendingReviewPrs;

    function handleReviewKeyDown(e: React.KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setReviewSelectedIndex((i) =>
          i < filteredPrs.length - 1 ? i + 1 : i,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setReviewSelectedIndex((i) => (i > 0 ? i - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (reviewSelectedIndex >= 0 && filteredPrs[reviewSelectedIndex]) {
          launchReview(filteredPrs[reviewSelectedIndex].url);
        } else if (reviewPrUrl.trim()) {
          launchReview(reviewPrUrl.trim());
        }
      } else if (e.key === "Escape") {
        setShowReviewInput(false);
        setReviewPrUrl("");
        setReviewSelectedIndex(-1);
      }
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
        onClick={() => {
          setShowReviewInput(false);
          setReviewPrUrl("");
          setReviewSelectedIndex(-1);
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg border border-zinc-800 bg-zinc-950 flex flex-col max-h-[80vh] safe-area-bottom"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-3 sm:py-2 bg-zinc-900/60 shrink-0">
            <span className="text-sm sm:text-xs text-zinc-300 font-mono">review pr</span>
            <span className="text-xs sm:text-[10px] text-zinc-600 font-mono ml-auto">
              [esc]
            </span>
          </div>
          <div className="px-3 py-3 border-b border-zinc-800 shrink-0">
            <input
              type="text"
              value={reviewPrUrl}
              onChange={(e) => {
                setReviewPrUrl(e.target.value);
                setReviewSelectedIndex(-1);
              }}
              onKeyDown={handleReviewKeyDown}
              placeholder="paste pr url or filter, hit enter"
              autoFocus
              className="w-full bg-transparent text-sm sm:text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
            />
          </div>
          {filteredPrs.length > 0 && (
            <div className="overflow-y-auto">
              <div className="px-3 py-1.5">
                <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
                  requesting your review
                </span>
              </div>
              {filteredPrs.map((pr, i) => (
                <div
                  key={pr.url}
                  onMouseEnter={() => setReviewSelectedIndex(i)}
                  className={`w-full flex items-center px-3 py-3 sm:py-2 font-mono gap-2 ${
                    i === reviewSelectedIndex
                      ? "bg-zinc-800"
                      : "hover:bg-zinc-900"
                  }`}
                >
                  <button
                    onClick={() => launchReview(pr.url)}
                    className="flex-1 text-left flex flex-col gap-0.5 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-zinc-100 truncate">
                        {pr.title}
                      </span>
                      <span className="text-[10px] text-zinc-600 shrink-0">
                        #{pr.number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>{pr.repo}</span>
                      <span>·</span>
                      <span>{pr.author}</span>
                    </div>
                  </button>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 shrink-0"
                    title="open in github"
                  >
                    [open]
                  </a>
                </div>
              ))}
            </div>
          )}
          {filteredPrs.length === 0 && pendingReviewPrs.length === 0 && (
            <div className="px-3 py-4 text-center">
              <span className="text-[10px] text-zinc-600 font-mono">
                no pending review requests
              </span>
            </div>
          )}
          {filteredPrs.length === 0 && pendingReviewPrs.length > 0 && (
            <div className="px-3 py-4 text-center">
              <span className="text-[10px] text-zinc-600 font-mono">
                no matches
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 sm:px-2 py-2 sm:py-0.5 bg-zinc-900/60 shrink-0">
        <span className="text-xs sm:text-[10px] text-zinc-500 font-mono">
          cursor-agents — {paneCount} pane{paneCount !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-4 sm:gap-3">
          <button
            onClick={() => setShowReviewInput(true)}
            className="text-xs sm:text-[10px] text-zinc-500 hover:text-zinc-200 font-mono flex items-center gap-1"
          >
            {pendingReviewPrs.length > 0 ? (
              <>
                <span className="text-amber-400">{pendingReviewPrs.length}</span>
                <span>review{pendingReviewPrs.length !== 1 ? "s" : ""}</span>
              </>
            ) : (
              <span>0 reviews</span>
            )}
          </button>
          <button
            onClick={() => {
              unlockAudio();
              clearPendingSound();
              setPendingBlink(false);
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) playCompletionSound();
            }}
            className={`text-xs sm:text-[10px] font-mono ${
              pendingBlink
                ? "text-amber-400 animate-pulse"
                : soundOn
                  ? "text-zinc-500 hover:text-zinc-200"
                  : "text-zinc-700 hover:text-zinc-400"
            }`}
            title={
              pendingBlink
                ? "agent finished! tap to play sound"
                : soundOn
                  ? "notifications on (click to mute)"
                  : "notifications muted (click to unmute)"
            }
          >
            <span className={soundOn ? "" : "line-through"}>♪</span>
          </button>
          <button
            onClick={() => setShowPalette(true)}
            className="text-xs sm:text-[10px] text-zinc-500 hover:text-zinc-200 font-mono py-1 sm:py-0"
          >
            {isMobile ? "menu" : "[⌘K]"}
          </button>
        </div>
      </div>

      {isMobile ? (
        <>
          {/* Mobile: single pane view */}
          <div className="flex-1 flex flex-col min-h-0">
            {(() => {
              const activeItem = sorted.find((s) => s.agentId === focusedId);
              if (activeItem) return renderPaneItem(activeItem, true);
              return null;
            })()}
          </div>

          {showDiffBar && focusedAgent && (
            <DiffBar
              agent={focusedAgent}
              expanded={showDiffBar}
              onToggle={() => setShowDiffBar((v) => !v)}
              onClose={() => setShowDiffBar(false)}
            />
          )}

          {/* Mobile: bottom tab bar */}
          <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm safe-area-bottom">
            <div className="flex items-stretch overflow-x-auto scrollbar-hide">
              {sorted.map((item) => {
                const agent = agentMap.get(item.agentId);
                if (!agent) return null;
                const isActive = focusedId === item.agentId;
                return (
                  <button
                    key={item.agentId}
                    onClick={() => setFocusedId(item.agentId)}
                    className={`flex items-center gap-2 px-3 py-3 font-mono text-[11px] whitespace-nowrap border-r border-zinc-800/50 min-w-0 shrink-0 transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-zinc-100 border-t-2 border-t-blue-500/80"
                        : "text-zinc-500 active:bg-zinc-800/50 border-t-2 border-t-transparent"
                    }`}
                  >
                    <StatusBadge status={agent.status} />
                    <span className="truncate max-w-[100px]">
                      {agent.name || agent.id.slice(0, 8)}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setShowPalette(true)}
                className="flex items-center justify-center px-5 py-3 text-zinc-600 active:text-zinc-200 font-mono text-lg shrink-0 border-t-2 border-t-transparent"
              >
                +
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Desktop: pane grid */}
          <div
            className={`flex-1 grid ${gridCols(paneCount)} auto-rows-fr min-h-0 overflow-hidden`}
          >
            {sorted.map((item) => renderPaneItem(item))}
          </div>

          {showDiffBar && focusedAgent && (
            <DiffBar
              agent={focusedAgent}
              expanded={showDiffBar}
              onToggle={() => setShowDiffBar((v) => !v)}
              onClose={() => setShowDiffBar(false)}
            />
          )}
        </>
      )}

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
