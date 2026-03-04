"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getHypeshipApiUrl,
  getHypeshipJwt,
  setHypeshipApiUrl,
  setHypeshipJwt,
  clearHypeshipAuth,
} from "@/lib/storage";
import {
  testHypeshipConnection,
  useHypeshipWorkContexts,
  useHypeshipWorkContext,
  createHypeshipWorkContext,
  updateHypeshipWorkContextState,
} from "@/lib/api";
import type {
  HypeshipWorkContext,
  HypeshipWorkContextState,
  HypeshipAgentType,
  HypeshipCreateWorkContextRequest,
} from "@/lib/types";

type SetupState = "idle" | "testing" | "success" | "error";

const STATE_COLORS: Record<HypeshipWorkContextState, string> = {
  launching: "bg-amber-400",
  working: "bg-blue-400",
  archived: "bg-zinc-400",
  gone: "bg-red-400",
};

const STATE_PULSE: Record<HypeshipWorkContextState, boolean> = {
  launching: true,
  working: true,
  archived: false,
  gone: false,
};

const AGENT_LABELS: Record<HypeshipAgentType, string> = {
  cursor_cli: "cursor cli",
  codex_cli: "codex cli",
  cursor_desktop: "cursor desktop",
  claude_code_cli: "claude code cli",
};

function StateDot({ state }: { state: HypeshipWorkContextState }) {
  const color = STATE_COLORS[state] ?? "bg-zinc-400";
  const pulse = STATE_PULSE[state] ?? false;
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

function SetupView({
  onConnected,
}: {
  onConnected: () => void;
}) {
  const [apiUrl, setApiUrl] = useState("");
  const [jwt, setJwt] = useState("");
  const [state, setState] = useState<SetupState>("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const existingUrl = getHypeshipApiUrl();
    const existingJwt = getHypeshipJwt();
    if (existingUrl) setApiUrl(existingUrl);
    if (existingJwt) setJwt(existingJwt);
  }, []);

  useEffect(() => {
    if (!apiUrl.trim() || !jwt.trim()) {
      setState("idle");
      setMsg("");
      return;
    }
    setState("testing");
    const timer = setTimeout(async () => {
      setHypeshipApiUrl(apiUrl.trim());
      setHypeshipJwt(jwt.trim());
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

  function stateIcon(s: SetupState) {
    switch (s) {
      case "testing":
        return (
          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
            ...
          </span>
        );
      case "success":
        return (
          <span className="text-[10px] text-emerald-400 font-mono shrink-0">
            ✓
          </span>
        );
      case "error":
        return (
          <span className="text-[10px] text-red-400 font-mono shrink-0">
            ✕
          </span>
        );
      default:
        return null;
    }
  }

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
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8081"
                autoFocus
                className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
            </div>
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

function LaunchContextModal({
  onClose,
  onLaunch,
}: {
  onClose: () => void;
  onLaunch: (body: HypeshipCreateWorkContextRequest) => void;
}) {
  const [repo, setRepo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [agentType, setAgentType] = useState<HypeshipAgentType>("cursor_cli");
  const [branchName, setBranchName] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const agentTypes: HypeshipAgentType[] = [
    "cursor_cli",
    "codex_cli",
    "cursor_desktop",
    "claude_code_cli",
  ];

  async function handleLaunch() {
    if (!repo.trim() || !prompt.trim()) return;
    setLaunching(true);
    setError("");
    try {
      const body: HypeshipCreateWorkContextRequest = {
        repositories: [repo.trim()],
        agent_type: agentType,
        initial_prompt: prompt.trim(),
      };
      if (branchName.trim()) body.branch_name = branchName.trim();
      onLaunch(body);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "launch failed");
      setLaunching(false);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleLaunch();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">
            launch work context
          </span>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
          >
            [esc]
          </button>
        </div>

        <div className="px-3 py-3 space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-mono">repository</p>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="github.com/org/repo"
              autoFocus
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-mono">agent type</p>
            <div className="flex gap-1 flex-wrap">
              {agentTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setAgentType(t)}
                  className={`px-2 py-1 text-[10px] font-mono border transition-colors ${
                    agentType === t
                      ? "border-blue-500 text-blue-400 bg-blue-500/10"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  {AGENT_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-mono">
              branch name{" "}
              <span className="text-zinc-700">(optional)</span>
            </p>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/my-branch"
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-mono">prompt</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="describe the task..."
              rows={4}
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
            />
          </div>

          {error && (
            <p className="text-[10px] text-red-400/70 font-mono">{error}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 flex justify-between items-center">
          <span className="text-[10px] text-zinc-600 font-mono">⌘↵ launch</span>
          <button
            onClick={handleLaunch}
            disabled={!repo.trim() || !prompt.trim() || launching}
            className="bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {launching ? "launching..." : "launch"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextDetailPanel({
  contextId,
  onClose,
  onArchive,
}: {
  contextId: string;
  onClose: () => void;
  onArchive: (id: string) => void;
}) {
  const { data, error } = useHypeshipWorkContext(contextId);
  const ctx = data?.work_context;

  if (error) {
    return (
      <div className="border border-zinc-800 bg-zinc-950 p-3">
        <p className="text-[10px] text-red-400 font-mono">
          failed to load: {error.message}
        </p>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="border border-zinc-800 bg-zinc-950 p-3">
        <p className="text-[10px] text-zinc-500 font-mono animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <StateDot state={ctx.state} />
          <span className="text-[10px] text-zinc-300 font-mono truncate">
            {ctx.topic || ctx.id.slice(0, 8)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono shrink-0"
        >
          [close]
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-[11px] font-mono">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="text-zinc-600">id</span>
          <span className="text-zinc-400 truncate">{ctx.id}</span>

          <span className="text-zinc-600">state</span>
          <span className="text-zinc-300">{ctx.state}</span>

          <span className="text-zinc-600">agent</span>
          <span className="text-zinc-300">{AGENT_LABELS[ctx.agent_type]}</span>

          <span className="text-zinc-600">repos</span>
          <span className="text-zinc-300 truncate">
            {ctx.repositories.join(", ")}
          </span>

          {ctx.branch_name && (
            <>
              <span className="text-zinc-600">branch</span>
              <span className="text-zinc-300">{ctx.branch_name}</span>
            </>
          )}

          <span className="text-zinc-600">launch mode</span>
          <span className="text-zinc-300">{ctx.launch_mode}</span>

          <span className="text-zinc-600">approval</span>
          <span className="text-zinc-300">{ctx.approval_mode.replace("_", " ")}</span>

          <span className="text-zinc-600">image</span>
          <span className="text-zinc-300 truncate">{ctx.launch_image}</span>

          <span className="text-zinc-600">hypeman</span>
          <span className="text-zinc-300 truncate">{ctx.hypeman_name}</span>

          <span className="text-zinc-600">created</span>
          <span className="text-zinc-300">{timeAgo(ctx.created_at)}</span>

          {ctx.started_at && (
            <>
              <span className="text-zinc-600">started</span>
              <span className="text-zinc-300">{timeAgo(ctx.started_at)}</span>
            </>
          )}

          {ctx.finished_at && (
            <>
              <span className="text-zinc-600">finished</span>
              <span className="text-zinc-300">{timeAgo(ctx.finished_at)}</span>
            </>
          )}

          {ctx.last_heartbeat_at && (
            <>
              <span className="text-zinc-600">heartbeat</span>
              <span className="text-zinc-300">
                {timeAgo(ctx.last_heartbeat_at)}
              </span>
            </>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-zinc-600">prompt</span>
          <div className="text-zinc-300 bg-zinc-900/60 border border-zinc-800 p-2 whitespace-pre-wrap text-[10px]">
            {ctx.initial_prompt}
          </div>
        </div>

        {ctx.summary && (
          <div className="space-y-1">
            <span className="text-zinc-600">summary</span>
            <div className="text-zinc-300 bg-zinc-900/60 border border-zinc-800 p-2 whitespace-pre-wrap text-[10px]">
              {ctx.summary}
            </div>
          </div>
        )}

        {ctx.last_error && (
          <div className="space-y-1">
            <span className="text-red-400">error</span>
            <div className="text-red-300 bg-red-900/10 border border-red-900/30 p-2 whitespace-pre-wrap text-[10px]">
              {ctx.last_error}
            </div>
          </div>
        )}

        {(ctx.shell_ws_url || ctx.desktop_url || ctx.shell_connect_command) && (
          <div className="space-y-1.5">
            <span className="text-zinc-600">connections</span>
            {ctx.shell_connect_command && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-600">shell command</span>
                <div className="text-zinc-300 bg-zinc-900/60 border border-zinc-800 p-2 text-[10px] font-mono break-all select-all">
                  {ctx.shell_connect_command}
                </div>
              </div>
            )}
            {ctx.desktop_url && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-600">desktop</span>
                <a
                  href={ctx.desktop_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-400 hover:text-blue-300 text-[10px] underline truncate"
                >
                  {ctx.desktop_url}
                </a>
              </div>
            )}
            {ctx.shell_ws_url && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-600">shell ws</span>
                <p className="text-zinc-400 text-[10px] break-all select-all">
                  {ctx.shell_ws_url}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {(ctx.state === "launching" || ctx.state === "working") && (
        <div className="border-t border-zinc-800 px-3 py-2 flex justify-end">
          <button
            onClick={() => onArchive(ctx.id)}
            className="px-3 py-1 text-[10px] font-mono border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            archive
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardView({ onLogout }: { onLogout: () => void }) {
  const [showLaunch, setShowLaunch] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const { data, error, isLoading } = useHypeshipWorkContexts(includeArchived);
  const contexts = data?.work_contexts ?? [];

  const handleLaunch = useCallback(
    async (body: HypeshipCreateWorkContextRequest) => {
      setLaunchError("");
      try {
        const result = await createHypeshipWorkContext(body);
        setSelectedId(result.work_context.id);
      } catch (e) {
        setLaunchError(e instanceof Error ? e.message : "launch failed");
      }
    },
    [],
  );

  const handleArchive = useCallback(async (id: string) => {
    try {
      await updateHypeshipWorkContextState(id, { state: "archived" });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showLaunch) setShowLaunch(false);
        else if (selectedId) setSelectedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showLaunch, selectedId]);

  const activeCount = contexts.filter(
    (c) => c.state === "launching" || c.state === "working",
  ).length;

  return (
    <div className="min-h-full bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-300 font-mono">hypeship</span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {contexts.length} context{contexts.length !== 1 ? "s" : ""}
            {activeCount > 0 && (
              <span className="text-blue-400"> · {activeCount} active</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeArchived(!includeArchived)}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              includeArchived
                ? "border-zinc-600 text-zinc-300"
                : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {includeArchived ? "hide archived" : "show archived"}
          </button>
          <button
            onClick={() => setShowLaunch(true)}
            className="text-[10px] font-mono text-blue-400 hover:text-blue-300 px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            [launch]
          </button>
          <button
            onClick={onLogout}
            className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            [disconnect]
          </button>
        </div>
      </div>

      {launchError && (
        <div className="px-3 py-1.5 bg-red-900/20 border-b border-red-900/30">
          <p className="text-[10px] text-red-400 font-mono">{launchError}</p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Context list */}
        <div
          className={`${selectedId ? "w-1/3 border-r border-zinc-800" : "w-full"} overflow-y-auto`}
        >
          {isLoading && contexts.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-[10px] text-zinc-600 font-mono animate-pulse">
                loading work contexts...
              </p>
            </div>
          )}

          {error && (
            <div className="px-3 py-8 text-center">
              <p className="text-[10px] text-red-400 font-mono">
                {error.message}
              </p>
            </div>
          )}

          {!isLoading && contexts.length === 0 && !error && (
            <div className="px-3 py-8 text-center space-y-2">
              <p className="text-[10px] text-zinc-600 font-mono">
                no work contexts yet
              </p>
              <button
                onClick={() => setShowLaunch(true)}
                className="text-[10px] font-mono text-blue-400 hover:text-blue-300"
              >
                launch one →
              </button>
            </div>
          )}

          {contexts.map((ctx) => (
            <button
              key={ctx.id}
              onClick={() => setSelectedId(ctx.id)}
              className={`w-full text-left border-b border-zinc-800/50 px-3 py-2 hover:bg-zinc-900/40 transition-colors ${
                selectedId === ctx.id ? "bg-zinc-900/60" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <StateDot state={ctx.state} />
                <span className="text-[11px] text-zinc-200 font-mono truncate flex-1">
                  {ctx.topic || ctx.id.slice(0, 12)}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                  {timeAgo(ctx.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-[10px] text-zinc-600 font-mono">
                  {AGENT_LABELS[ctx.agent_type]}
                </span>
                <span className="text-[10px] text-zinc-700 font-mono">·</span>
                <span className="text-[10px] text-zinc-600 font-mono truncate">
                  {ctx.repositories[0]}
                </span>
              </div>
              {ctx.summary && (
                <p className="text-[10px] text-zinc-500 font-mono mt-1 ml-4 line-clamp-2">
                  {ctx.summary}
                </p>
              )}
              {ctx.last_error && (
                <p className="text-[10px] text-red-400/60 font-mono mt-1 ml-4 truncate">
                  {ctx.last_error}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="flex-1 overflow-hidden">
            <ContextDetailPanel
              key={selectedId}
              contextId={selectedId}
              onClose={() => setSelectedId(null)}
              onArchive={handleArchive}
            />
          </div>
        )}
      </div>

      {showLaunch && (
        <LaunchContextModal
          onClose={() => setShowLaunch(false)}
          onLaunch={handleLaunch}
        />
      )}
    </div>
  );
}

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
