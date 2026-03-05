"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getHypeshipApiUrl,
  getHypeshipJwt,
  setHypeshipApiUrl,
  setHypeshipJwt,
  clearHypeshipAuth,
} from "@/lib/storage";
import {
  testHypeshipConnection,
  useHypeshipAgents,
  sendHypeshipPrompt,
  updateHypeshipWorkContextState,
} from "@/lib/api";
import type {
  HypeshipWorkContextState,
  HypeshipAgentType,
} from "@/lib/types";
import HypeshipPane from "@/components/HypeshipPane";

type SetupState = "idle" | "testing" | "success" | "error";

const STATE_COLORS: Record<HypeshipWorkContextState, string> = {
  launching: "bg-amber-400",
  working: "bg-blue-400",
  archived: "bg-zinc-400",
  gone: "bg-red-400",
};

const AGENT_LABELS: Record<HypeshipAgentType, string> = {
  cursor_cli: "cursor",
  codex_cli: "codex",
  cursor_desktop: "desktop",
  claude_code_cli: "claude",
};

function StateDot({ state }: { state: HypeshipWorkContextState }) {
  const color = STATE_COLORS[state] ?? "bg-zinc-400";
  const pulse = state === "launching" || state === "working";
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
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Setup ──

function SetupView({ onConnected }: { onConnected: () => void }) {
  const [apiUrl, setApiUrl] = useState("");
  const [jwt, setJwt] = useState("");
  const [state, setState] = useState<SetupState>("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const u = getHypeshipApiUrl();
    const j = getHypeshipJwt();
    if (u) setApiUrl(u);
    if (j) setJwt(j);
  }, []);

  useEffect(() => {
    if (!apiUrl.trim() || !jwt.trim()) {
      setState("idle");
      return;
    }
    setState("testing");
    const timer = setTimeout(async () => {
      setHypeshipApiUrl(apiUrl.trim());
      setHypeshipJwt(jwt.trim());
      try {
        const h = await testHypeshipConnection();
        setState(h.ok ? "success" : "error");
        setMsg(h.ok ? "connected" : "healthz returned ok=false");
      } catch (e) {
        setState("error");
        setMsg(e instanceof Error ? e.message : "connection failed");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [apiUrl, jwt]);

  function handleContinue() {
    if (state !== "success") return;
    setHypeshipApiUrl(apiUrl.trim());
    setHypeshipJwt(jwt.trim());
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

  return (
    <div className="min-h-full bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-md border border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">
            hypeship setup
          </span>
        </div>
        <div className="px-3 py-3 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono">
              hypeship api url
            </p>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8081"
              autoFocus
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono">jwt token</p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={jwt}
                onChange={(e) => setJwt(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
              {state === "success" && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  ✓
                </span>
              )}
              {state === "error" && (
                <span className="text-[10px] text-red-400 font-mono">✕</span>
              )}
              {state === "testing" && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  ...
                </span>
              )}
            </div>
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

// ── Prompt Bar ──

function PromptBar({
  onSubmit,
  disabled,
}: {
  onSubmit: (message: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function handleSubmit() {
    const msg = value.trim();
    if (!msg || disabled) return;
    onSubmit(msg);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/40 px-3 py-2 shrink-0">
      <div className="flex gap-2 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="tell hypeship what to do... (press / to focus)"
            rows={1}
            disabled={disabled}
            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 font-mono resize-none disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="px-4 py-2 text-xs font-mono bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          send
        </button>
      </div>
    </div>
  );
}

// ── Agent Sidebar ──

function AgentSidebar({
  agents,
  selectedIds,
  onToggle,
  onArchive,
}: {
  agents: Array<{
    id: string;
    state: HypeshipWorkContextState;
    topic: string;
    repositories: string[];
    agent_type: HypeshipAgentType;
    created_at: string;
    summary: string;
  }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-hidden">
      <div className="px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono">
          agents ({agents.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 && (
          <div className="px-2 py-6 text-center">
            <p className="text-[10px] text-zinc-600 font-mono">
              no agents yet
            </p>
            <p className="text-[9px] text-zinc-700 font-mono mt-1">
              use the prompt bar above
            </p>
          </div>
        )}
        {agents.map((a) => {
          const isOpen = selectedIds.includes(a.id);
          return (
            <div
              key={a.id}
              className={`border-b border-zinc-800/50 transition-colors ${isOpen ? "bg-zinc-900/60" : "hover:bg-zinc-900/30"}`}
            >
              <button
                onClick={() => onToggle(a.id)}
                className="w-full text-left px-2 py-1.5"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <StateDot state={a.state} />
                  <span className="text-[10px] text-zinc-200 font-mono truncate flex-1">
                    {a.topic || a.id.slice(0, 10)}
                  </span>
                  {isOpen && (
                    <span className="text-[8px] text-blue-400 font-mono">
                      open
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-3.5">
                  <span className="text-[9px] text-zinc-600 font-mono">
                    {AGENT_LABELS[a.agent_type]}
                  </span>
                  <span className="text-[9px] text-zinc-700">·</span>
                  <span className="text-[9px] text-zinc-600 font-mono truncate">
                    {a.repositories?.[0]?.split("/").pop() ?? ""}
                  </span>
                  <span className="text-[9px] text-zinc-700">·</span>
                  <span className="text-[9px] text-zinc-700 font-mono">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
              </button>
              {isOpen &&
                (a.state === "launching" || a.state === "working") && (
                  <div className="px-2 pb-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(a.id);
                      }}
                      className="text-[9px] font-mono text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      [archive]
                    </button>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ──

function DashboardView({ onLogout }: { onLogout: () => void }) {
  const [openPanes, setOpenPanes] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [promptDisabled, setPromptDisabled] = useState(false);
  const [promptResponse, setPromptResponse] = useState<string | null>(null);

  const { data: agentsData } = useHypeshipAgents();
  const agents = agentsData?.agents ?? [];

  const handlePrompt = useCallback(
    async (message: string) => {
      setPromptDisabled(true);
      setPromptResponse(null);
      try {
        const resp = await sendHypeshipPrompt({
          message,
          context: { source: "web" },
        });
        setPromptResponse(resp.message);
        if (resp.agent?.id) {
          setOpenPanes((prev) =>
            prev.includes(resp.agent!.id)
              ? prev
              : [...prev, resp.agent!.id],
          );
          setFocusedId(resp.agent!.id);
        }
      } catch (e) {
        setPromptResponse(
          `Error: ${e instanceof Error ? e.message : "failed"}`,
        );
      } finally {
        setPromptDisabled(false);
      }
    },
    [],
  );

  const togglePane = useCallback((id: string) => {
    setOpenPanes((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      return [...prev, id];
    });
    setFocusedId(id);
  }, []);

  const closePane = useCallback((id: string) => {
    setOpenPanes((prev) => prev.filter((p) => p !== id));
    setFocusedId(null);
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    try {
      await updateHypeshipWorkContextState(id, { state: "archived" });
    } catch {}
  }, []);

  const gridCols =
    openPanes.length <= 1
      ? "grid-cols-1"
      : openPanes.length === 2
        ? "grid-cols-2"
        : openPanes.length <= 4
          ? "grid-cols-2"
          : "grid-cols-3";

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300 font-mono">hypeship</span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
        >
          [disconnect]
        </button>
      </div>

      {/* Prompt bar */}
      <PromptBar onSubmit={handlePrompt} disabled={promptDisabled} />

      {/* Prompt response toast */}
      {promptResponse && (
        <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-zinc-300 font-mono truncate flex-1">
            {promptResponse}
          </p>
          <button
            onClick={() => setPromptResponse(null)}
            className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono ml-2 shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Main area: sidebar + panes */}
      <div className="flex-1 flex overflow-hidden">
        <AgentSidebar
          agents={agents}
          selectedIds={openPanes}
          onToggle={togglePane}
          onArchive={handleArchive}
        />

        {/* Pane grid */}
        <div className="flex-1 overflow-hidden">
          {openPanes.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm text-zinc-500 font-mono">
                  no panes open
                </p>
                <p className="text-[11px] text-zinc-600 font-mono">
                  use the prompt bar to spin up an agent, or click one
                  in the sidebar
                </p>
                <p className="text-[10px] text-zinc-700 font-mono">
                  press <span className="text-zinc-500">/</span> to focus
                  the prompt bar
                </p>
              </div>
            </div>
          ) : (
            <div className={`grid ${gridCols} h-full gap-0`}>
              {openPanes.map((id) => (
                <HypeshipPane
                  key={id}
                  agentId={id}
                  onClose={() => closePane(id)}
                  focused={focusedId === id}
                  onFocus={() => setFocusedId(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──

export default function HypeshipPage() {
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const url = getHypeshipApiUrl();
    const jwt = getHypeshipJwt();
    if (url && jwt) setConnected(true);
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!connected) {
    return <SetupView onConnected={() => setConnected(true)} />;
  }

  return (
    <DashboardView
      onLogout={() => {
        clearHypeshipAuth();
        setConnected(false);
      }}
    />
  );
}
