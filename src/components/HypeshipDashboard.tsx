"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getHypeshipGrid,
  addToHypeshipGrid,
  removeFromHypeshipGrid,
  getHypeshipEnvJwt,
  setHypeshipEnvJwt,
  clearHypeshipEnvAuth,
  clearHypeshipAuth,
  activateHypeshipEnv,
  HYPESHIP_URLS,
} from "@/lib/storage";
import type { HypeshipEnv } from "@/lib/storage";
import HypeshipAgentPane from "@/components/HypeshipAgentPane";
import { HypeshipAddAgentModal } from "@/components/HypeshipAddAgentModal";
import { HypeshipNewChatModal } from "@/components/HypeshipNewChatModal";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import {
  testHypeshipConnection,
  useHypeshipAgents,
  sendHypeshipPrompt,
  fetchPrFiles,
  stopHypeshipAgent,
  useReviewRequests,
} from "@/lib/api";
import { ConfirmMergeModal } from "@/components/ConfirmMergeModal";
import { AddReviewerModal } from "@/components/AddReviewerModal";
import { buildHypeshipPrReviewPrompt } from "@/lib/prompts";
import type {
  HypeshipAgentStatus,
  HypeshipAgentSummary,
  ReviewRequestPR,
} from "@/lib/types";

type SetupState = "idle" | "testing" | "success" | "error";

const STATUS_COLORS: Record<HypeshipAgentStatus, string> = {
  creating: "bg-amber-400",
  running: "bg-blue-400",
  finished: "bg-emerald-400",
  error: "bg-red-400",
};

const STATUS_PULSE: Record<HypeshipAgentStatus, boolean> = {
  creating: true,
  running: true,
  finished: false,
  error: false,
};

function StatusDot({ status }: { status: HypeshipAgentStatus }) {
  const color = STATUS_COLORS[status] ?? "bg-zinc-400";
  const pulse = STATUS_PULSE[status] ?? false;
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

// ── Setup ──

function SetupView({ env, onConnected }: { env: HypeshipEnv; onConnected: () => void }) {
  const [jwt, setJwt] = useState("");
  const [state, setState] = useState<SetupState>("idle");
  const [msg, setMsg] = useState("");

  const apiUrl = HYPESHIP_URLS[env];

  useEffect(() => {
    const existingJwt = getHypeshipEnvJwt(env);
    if (existingJwt) setJwt(existingJwt);
  }, [env]);

  useEffect(() => {
    if (!jwt.trim()) {
      setState("idle");
      setMsg("");
      return;
    }
    setState("testing");
    const timer = setTimeout(async () => {
      setHypeshipEnvJwt(env, jwt.trim());
      activateHypeshipEnv(env);
      try {
        const health = await testHypeshipConnection();
        if (health.ok) {
          setState("success");
          setMsg("connected");
        } else {
          setState("error");
          setMsg("healthz returned ok=false");
        }
      } catch (e) {
        setState("error");
        setMsg(e instanceof Error ? e.message : "connection failed");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [env, jwt]);

  function handleContinue() {
    if (state !== "success") return;
    setHypeshipEnvJwt(env, jwt.trim());
    activateHypeshipEnv(env);
    onConnected();
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && state === "success") {
        e.preventDefault();
        handleContinue();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function stateIcon(s: SetupState) {
    switch (s) {
      case "testing":
        return <span className="text-[10px] text-zinc-500 font-mono shrink-0">...</span>;
      case "success":
        return <span className="text-[10px] text-emerald-400 font-mono shrink-0">✓</span>;
      case "error":
        return <span className="text-[10px] text-red-400 font-mono shrink-0">✕</span>;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-md border border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">hypeship setup</span>
          <span className="text-[10px] text-zinc-600 font-mono">{env}</span>
        </div>
        <div className="px-3 py-3 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-600 font-mono">{apiUrl}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono">
              jwt token — HS256 signed with your HYPESHIP_JWT_SECRET
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={jwt}
                onChange={(e) => setJwt(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
              {stateIcon(state)}
            </div>
            {state === "success" && (
              <p className="text-[10px] text-emerald-400/70 font-mono">{msg}</p>
            )}
            {state === "error" && (
              <p className="text-[10px] text-red-400/70 font-mono">{msg}</p>
            )}
          </div>
        </div>
        <div className="border-t border-zinc-800 px-3 py-2 flex justify-end">
          <button
            onClick={handleContinue}
            disabled={state !== "success"}
            className="bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            continue ↵
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panes View ──

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function PanesView({
  env,
  onLogout,
}: {
  env: HypeshipEnv;
  onLogout: () => void;
}) {
  const router = useRouter();
  const basePath = env === "staging" ? "/staging" : "";
  const [grid, setGrid] = useState(() => getHypeshipGrid(env));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewPrUrl, setReviewPrUrl] = useState("");
  const [reviewSelectedIndex, setReviewSelectedIndex] = useState(-1);
  const [mergeTarget, setMergeTarget] = useState<{ prUrl: string; agentName: string } | null>(null);
  const [reviewerTarget, setReviewerTarget] = useState<{ prUrl: string; agentName: string } | null>(null);
  const [launchingReview, setLaunchingReview] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setMounted(true);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { data: agentsData } = useHypeshipAgents();
  const agents = agentsData?.agents ?? [];
  const agentMap = useMemo(() => {
    const m = new Map<string, HypeshipAgentSummary>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const { data: reviewData } = useReviewRequests();
  const reviewPrs = reviewData?.prs ?? [];

  const refreshGrid = useCallback(() => setGrid(getHypeshipGrid(env)), [env]);
  const sorted = useMemo(() => [...grid].sort((a, b) => a.order - b.order), [grid]);
  const paneCount = sorted.length;
  const gridAgentIds = useMemo(() => new Set(grid.map((g) => g.agentId)), [grid]);

  function handleAdd(agentId: string) {
    addToHypeshipGrid(agentId, env);
    refreshGrid();
    setShowAddModal(false);
    setFocusedId(agentId);
  }

  function handleRemove(agentId: string) {
    removeFromHypeshipGrid(agentId, env);
    if (focusedId === agentId) setFocusedId(null);
    refreshGrid();
  }

  function handleNewChatCreated(agentId: string) {
    addToHypeshipGrid(agentId, env);
    refreshGrid();
    setShowNewChat(false);
    setFocusedId(agentId);
  }

  async function launchReview(pr: ReviewRequestPR) {
    setLaunchingReview(pr.url);
    setShowReviewInput(false);
    setReviewPrUrl("");
    setReviewSelectedIndex(-1);
    try {
      let files;
      try {
        const resp = await fetchPrFiles(pr.url);
        files = resp.files;
      } catch {
        // proceed without files
      }
      const prompt = buildHypeshipPrReviewPrompt({
        prUrl: pr.url,
        repo: pr.repo,
        files,
      });
      const resp = await sendHypeshipPrompt({ message: prompt });
      if (resp.agent_id) {
        addToHypeshipGrid(resp.agent_id, env);
        refreshGrid();
        setFocusedId(resp.agent_id);
      }
    } catch {
      // silently fail
    } finally {
      setLaunchingReview(null);
    }
  }

  async function launchReviewByUrl(prUrl: string) {
    setShowReviewInput(false);
    setReviewPrUrl("");
    setReviewSelectedIndex(-1);
    try {
      const prompt = buildHypeshipPrReviewPrompt({ prUrl });
      const resp = await sendHypeshipPrompt({ message: prompt });
      if (resp.agent_id) {
        addToHypeshipGrid(resp.agent_id, env);
        refreshGrid();
        setFocusedId(resp.agent_id);
      }
    } catch {
      // silently fail
    }
  }

  const focusedAgent = focusedId ? agentMap.get(focusedId) : null;

  // Auto-focus first pane on mobile
  useEffect(() => {
    if (!isMobile || !mounted || sorted.length === 0) return;
    if (!focusedId || !sorted.some((s) => s.agentId === focusedId)) {
      setFocusedId(sorted[0].agentId);
    }
  }, [isMobile, mounted, sorted, focusedId]);

  // Clear focus when modals open
  useEffect(() => {
    if (showAddModal || showNewChat || showReviewInput || mergeTarget || reviewerTarget) {
      setFocusedId(null);
    }
  }, [showAddModal, showNewChat, showReviewInput, mergeTarget, reviewerTarget]);

  const commands = useMemo(() => {
    const cmds: Command[] = [];

    cmds.push({
      id: "new-chat",
      label: "new chat",
      section: "agents",
      action: () => setShowNewChat(true),
    });
    cmds.push({
      id: "add-agent",
      label: "add agent to grid",
      section: "agents",
      action: () => setShowAddModal(true),
    });
    cmds.push({
      id: "review",
      label: "review pr",
      section: "agents",
      action: () => setShowReviewInput(true),
    });

    if (focusedAgent) {
      const isActive = focusedAgent.status === "creating" || focusedAgent.status === "running";
      if (isActive) {
        cmds.push({
          id: "stop",
          label: `stop ${focusedAgent.preview?.slice(0, 30) || focusedAgent.id.slice(0, 12)}`,
          section: "focused pane",
          action: () => stopHypeshipAgent(focusedAgent.id),
        });
      }
      cmds.push({
        id: "close",
        label: "close pane",
        section: "focused pane",
        action: () => handleRemove(focusedAgent.id),
      });
    }

    sorted.forEach((item) => {
      const a = agentMap.get(item.agentId);
      if (!a || a.id === focusedId) return;
      cmds.push({
        id: `focus-${a.id}`,
        label: `focus ${a.preview?.slice(0, 40) || a.id.slice(0, 12)}`,
        section: "panes",
        action: () => setFocusedId(a.id),
      });
    });

    cmds.push({
      id: "secrets",
      label: "secrets",
      section: "app",
      action: () => router.push(`${basePath}/secrets`),
    });
    cmds.push({
      id: "settings",
      label: "settings",
      section: "app",
      action: () => router.push(`${basePath}/settings`),
    });
    cmds.push({
      id: "cursor",
      label: "open cursor agents",
      section: "app",
      action: () => router.push("/cursor"),
    });
    cmds.push({
      id: "disconnect",
      label: "disconnect",
      section: "app",
      action: onLogout,
    });

    return cmds;
  }, [focusedAgent, focusedId, sorted, agentMap, onLogout, router, basePath]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowPalette((v) => !v);
        setShowAddModal(false);
        setShowNewChat(false);
        setShowReviewInput(false);
        setMergeTarget(null);
        setReviewerTarget(null);
        return;
      }
      if (e.key === "Escape") {
        if (showPalette) { setShowPalette(false); return; }
        if (showReviewInput) { setShowReviewInput(false); setReviewPrUrl(""); return; }
        if (showAddModal || showNewChat) return;
        if (!isMobile) setFocusedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showPalette, showAddModal, showNewChat, showReviewInput, isMobile]);

  if (!mounted) return null;

  function renderReviewInput() {
    const filteredPrs = reviewPrUrl.trim()
      ? reviewPrs.filter(
          (pr) =>
            pr.title.toLowerCase().includes(reviewPrUrl.toLowerCase()) ||
            pr.repo.toLowerCase().includes(reviewPrUrl.toLowerCase()) ||
            pr.url.includes(reviewPrUrl),
        )
      : reviewPrs;

    function handleReviewKeyDown(e: React.KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setReviewSelectedIndex((i) => (i < filteredPrs.length - 1 ? i + 1 : i));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setReviewSelectedIndex((i) => (i > 0 ? i - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (reviewSelectedIndex >= 0 && filteredPrs[reviewSelectedIndex]) {
          launchReview(filteredPrs[reviewSelectedIndex]);
        } else if (reviewPrUrl.trim()) {
          launchReviewByUrl(reviewPrUrl.trim());
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
        onClick={() => { setShowReviewInput(false); setReviewPrUrl(""); setReviewSelectedIndex(-1); }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg border border-zinc-800 bg-zinc-950 flex flex-col max-h-[80vh] safe-area-bottom"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-3 sm:py-2 bg-zinc-900/60 shrink-0">
            <span className="text-sm sm:text-xs text-zinc-300 font-mono">review pr</span>
            <span className="text-xs sm:text-[10px] text-zinc-600 font-mono ml-auto">[esc]</span>
          </div>
          <div className="px-3 py-3 border-b border-zinc-800 shrink-0">
            <input
              type="text"
              value={reviewPrUrl}
              onChange={(e) => { setReviewPrUrl(e.target.value); setReviewSelectedIndex(-1); }}
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
                    i === reviewSelectedIndex ? "bg-zinc-800" : "hover:bg-zinc-900"
                  }`}
                >
                  <button
                    onClick={() => launchReview(pr)}
                    className="flex-1 text-left flex flex-col gap-0.5 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-zinc-100 truncate">{pr.title}</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">#{pr.number}</span>
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
          {filteredPrs.length === 0 && reviewPrs.length === 0 && (
            <div className="px-3 py-4 text-center">
              <span className="text-[10px] text-zinc-600 font-mono">no pending review requests</span>
            </div>
          )}
          {filteredPrs.length === 0 && reviewPrs.length > 0 && (
            <div className="px-3 py-4 text-center">
              <span className="text-[10px] text-zinc-600 font-mono">no matches</span>
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
        <div className="flex items-center gap-3 min-w-0">
          <span className={`${isMobile ? "text-xs" : "text-[10px]"} text-zinc-500 font-mono shrink-0`}>
            hypeship — {paneCount} pane{paneCount !== 1 ? "s" : ""}
          </span>
          {env === "staging" && (
            <span className="text-[10px] text-amber-400 font-mono border border-amber-400/30 px-1.5 py-0.5 shrink-0">staging</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.push(`${basePath}/secrets`)}
            className={`text-zinc-500 hover:text-zinc-200 font-mono ${isMobile ? "text-xs" : "text-[10px]"}`}
          >
            secrets
          </button>
          <button
            onClick={() => router.push(`${basePath}/settings`)}
            className={`text-zinc-500 hover:text-zinc-200 font-mono ${isMobile ? "text-xs" : "text-[10px]"}`}
          >
            settings
          </button>
          <button
            onClick={() => setShowReviewInput(true)}
            className={`text-zinc-500 hover:text-zinc-200 font-mono ${isMobile ? "text-xs" : "text-[10px]"} flex items-center gap-1`}
          >
            {reviewPrs.length > 0 ? (
              <>
                <span className="text-amber-400">{reviewPrs.length}</span>
                <span>review{reviewPrs.length !== 1 ? "s" : ""}</span>
              </>
            ) : (
              <span>0 reviews</span>
            )}
          </button>
          <button
            onClick={() => setShowPalette(true)}
            className={`text-zinc-500 hover:text-zinc-200 active:text-zinc-100 font-mono ${isMobile ? "text-xs py-1 px-2" : "text-[10px]"}`}
          >
            {isMobile ? "menu" : "[⌘K]"}
          </button>
        </div>
      </div>

      {/* Pane grid */}
      {paneCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className={`${isMobile ? "text-sm" : "text-xs"} text-zinc-600 font-mono`}>no panes open</p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => setShowNewChat(true)}
                className={`text-blue-400 hover:text-blue-300 active:text-blue-200 font-mono border border-zinc-800 hover:border-zinc-600 transition-colors ${isMobile ? "text-sm px-6 py-3" : "text-xs px-4 py-2"}`}
              >
                new chat
              </button>
              <button
                onClick={() => setShowPalette(true)}
                className={`text-zinc-500 hover:text-zinc-200 active:text-zinc-100 font-mono transition-colors ${isMobile ? "text-xs py-1" : "text-[10px]"}`}
              >
                {isMobile ? "or open menu" : "or ⌘K"}
              </button>
            </div>
          </div>
        </div>
      ) : isMobile ? (
        <>
          {/* Mobile: single pane view */}
          <div className="flex-1 flex flex-col min-h-0">
            {(() => {
              const activeItem = sorted.find((s) => s.agentId === focusedId);
              if (activeItem) return (
                <HypeshipAgentPane
                  key={activeItem.agentId}
                  agentId={activeItem.agentId}
                  focused={true}
                  isMobile={true}
                  onFocus={() => {}}
                  onClose={() => handleRemove(activeItem.agentId)}
                />
              );
              return null;
            })()}
          </div>

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
                    <StatusDot status={agent.status} />
                    <span className="truncate max-w-[100px]">
                      {agent.preview || agent.id.slice(0, 8)}
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
        <div className={`flex-1 grid ${gridCols(paneCount)} auto-rows-fr min-h-0 overflow-hidden`}>
          {sorted.map((item) => (
            <HypeshipAgentPane
              key={item.agentId}
              agentId={item.agentId}
              focused={focusedId === item.agentId}
              onFocus={() => setFocusedId(item.agentId)}
              onClose={() => handleRemove(item.agentId)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showPalette && (
        <CommandPalette commands={commands} onClose={() => setShowPalette(false)} />
      )}
      {showAddModal && (
        <HypeshipAddAgentModal
          gridAgentIds={gridAgentIds}
          onAdd={handleAdd}
          onNewChat={() => { setShowAddModal(false); setShowNewChat(true); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showNewChat && (
        <HypeshipNewChatModal
          onCreated={handleNewChatCreated}
          onClose={() => setShowNewChat(false)}
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

// ── Root ──

export default function HypeshipDashboard({ env = "production" as HypeshipEnv }: { env?: HypeshipEnv }) {
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const jwt = getHypeshipEnvJwt(env);
    if (jwt) {
      activateHypeshipEnv(env);
      setConnected(true);
    }
    setChecked(true);
  }, [env]);

  if (!checked) return null;

  if (!connected) {
    return <SetupView env={env} onConnected={() => setConnected(true)} />;
  }

  return (
    <PanesView
      env={env}
      onLogout={() => {
        clearHypeshipEnvAuth(env);
        clearHypeshipAuth();
        setConnected(false);
      }}
    />
  );
}
