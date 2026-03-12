"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getHypeshipApiUrl,
  getHypeshipJwt,
  setHypeshipApiUrl,
  setHypeshipJwt,
  clearHypeshipAuth,
  getHypeshipView,
  setHypeshipView,
  getHypeshipGrid,
  addToHypeshipGrid,
  removeFromHypeshipGrid,
} from "@/lib/storage";
import type { HypeshipView } from "@/lib/storage";
import HypeshipAgentPane from "@/components/HypeshipAgentPane";
import { HypeshipAddAgentModal } from "@/components/HypeshipAddAgentModal";
import { HypeshipNewChatModal } from "@/components/HypeshipNewChatModal";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import {
  testHypeshipConnection,
  useHypeshipWorkers,
  useHypeshipWorker,
  useHypeshipConversation,
  useHypeshipAgents,
  useHypeshipAgent,
  sendHypeshipPrompt,
  sendHypeshipFollowUp,
  sendHypeshipMessage,
  updateHypeshipWorkerState,
  useHypeshipSecrets,
  createHypeshipSecret,
  deleteHypeshipSecret,
  useHypeshipUser,
  useHypeshipIdentities,
  unlinkHypeshipIdentity,
  getHypeshipAuthConfig,
  stopHypeshipAgent,
  resetHypeshipOrchestrator,
  getHypeshipSettingsLink,
} from "@/lib/api";
import {
  getToolDetailBody,
  getToolDetailSummary,
} from "@/lib/hypeshipMessageDetails";
import type {
  HypeshipWorker,
  HypeshipWorkerState,
  HypeshipAgentStatus,
  HypeshipAgentType,
  HypeshipConversationTurn,
  HypeshipPromptResponse,
  HypeshipAuthConfig,
  HypeshipAgentSummary,
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

const WORKER_STATE_COLORS: Record<HypeshipWorkerState, string> = {
  creating: "bg-amber-400",
  running: "bg-blue-400",
  finished: "bg-emerald-400",
  error: "bg-red-400",
};

const WORKER_STATE_PULSE: Record<HypeshipWorkerState, boolean> = {
  creating: true,
  running: true,
  finished: false,
  error: false,
};

const AGENT_LABELS: Record<HypeshipAgentType, string> = {
  codex_cli: "codex cli",
  claude_code_cli: "claude code cli",
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

function WorkerStateDot({ state }: { state: HypeshipWorkerState }) {
  const color = WORKER_STATE_COLORS[state] ?? "bg-zinc-400";
  const pulse = WORKER_STATE_PULSE[state] ?? false;
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

function truncatePreview(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function getCollapsedTurnPreview(turn: HypeshipConversationTurn, max = 60): string | null {
  const content = turn.content?.trim();
  if (!content) return null;

  const isTool = turn.source === "orchestrator:tool" || !!turn.tool_use_id;
  if (!isTool) {
    return truncatePreview(content, max);
  }

  const toolDetail = getToolDetailSummary(turn.detail);
  return truncatePreview(toolDetail ? `${content} ${toolDetail}` : content, max);
}

// ── Setup ──

const HYPESHIP_ENVS = {
  production: "https://hypeship-production.up.railway.app",
  staging: "https://hypeship-staging.up.railway.app",
} as const;
type HypeshipEnv = keyof typeof HYPESHIP_ENVS;

function envFromUrl(url: string | null): HypeshipEnv {
  if (url?.includes("staging")) return "staging";
  return "production";
}

function SetupView({ onConnected }: { onConnected: () => void }) {
  const [env, setEnv] = useState<HypeshipEnv>("production");
  const [jwt, setJwt] = useState("");
  const [state, setState] = useState<SetupState>("idle");
  const [msg, setMsg] = useState("");

  const apiUrl = HYPESHIP_ENVS[env];

  useEffect(() => {
    const existingUrl = getHypeshipApiUrl();
    const existingJwt = getHypeshipJwt();
    if (existingUrl) setEnv(envFromUrl(existingUrl));
    if (existingJwt) setJwt(existingJwt);
  }, []);

  useEffect(() => {
    if (!jwt.trim()) {
      setState("idle");
      setMsg("");
      return;
    }
    setState("testing");
    const timer = setTimeout(async () => {
      setHypeshipApiUrl(apiUrl);
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
    setHypeshipApiUrl(apiUrl);
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
        </div>
        <div className="px-3 py-3 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono">environment</p>
            <div className="flex border border-zinc-800">
              {(Object.keys(HYPESHIP_ENVS) as HypeshipEnv[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`flex-1 px-3 py-1.5 text-xs font-mono transition-colors ${
                    env === e
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
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

// ── Agent Conversation ──

function AgentConversation({
  workerId,
  workerState,
}: {
  workerId: string;
  workerState: HypeshipWorkerState;
}) {
  const isActive = workerState === "creating" || workerState === "running";
  const { data, error } = useHypeshipConversation(workerId, isActive);
  const turns = data?.conversation ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);

  const prevTurnCount = useRef(turns.length);
  useEffect(() => {
    if (turns.length > prevTurnCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTurnCount.current = turns.length;
  }, [turns.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [workerId]);

  async function handleSend() {
    const text = msgInput.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendHypeshipMessage(workerId, text);
      setMsgInput("");
    } catch {
      // keep input for retry
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">
        {error && (
          <div className="px-3 py-2">
            <p className="text-[10px] text-red-400/70 font-mono">{error.message}</p>
          </div>
        )}
        {!error && turns.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-[10px] text-zinc-600 font-mono">
              {isActive ? "waiting for conversation..." : "no conversation history"}
            </p>
          </div>
        )}
        <div className="divide-y divide-zinc-800/30">
          {turns.map((turn, i) => (
            <ConversationBubble key={i} turn={turn} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {isActive && (
        <div className="shrink-0 border-t border-zinc-800 px-2 py-2 flex gap-2 items-end">
          <textarea
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="send a message..."
            rows={1}
            className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!msgInput.trim() || sending}
            className="px-3 py-1.5 text-[10px] font-mono bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? "..." : "↵"}
          </button>
        </div>
      )}
    </div>
  );
}

function ToolIndicatorBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = turn.status === "running";
  const isComplete = turn.status === "complete";
  const isError = turn.status === "error";
  const dotColor = isError
    ? "bg-red-400"
    : isComplete
      ? "bg-emerald-400"
      : "bg-blue-400";
  const statusLabel = isError ? "error" : isComplete ? "done" : "working...";
  const toolDetail = getToolDetailSummary(turn.detail);
  const detailBody = getToolDetailBody(turn.detail);
  const hasDetailBody = detailBody.trim().length > 0;

  return (
    <div className="px-3 py-1.5">
      <button
        onClick={() => hasDetailBody && setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 hover:bg-zinc-900/30 transition-colors rounded px-1 py-0.5 -mx-1"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className="text-[10px] text-emerald-400 font-mono">⚡ {turn.content}</span>
        {toolDetail && <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[300px]">{toolDetail}</span>}
        <span className="text-[10px] text-zinc-600 font-mono">{statusLabel}</span>
        {turn.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">{timeAgo(turn.timestamp)}</span>
        )}
        {hasDetailBody && (
          <span className="text-[10px] text-zinc-700 font-mono">{expanded ? "▼" : "▶"}</span>
        )}
      </button>
      {expanded && hasDetailBody && (
        <div className="ml-5 mt-1 border-l border-zinc-800/60 pl-3 max-h-[260px] overflow-y-auto">
          <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words">
            {detailBody}
          </pre>
        </div>
      )}
    </div>
  );
}

function ThinkingBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const [expanded, setExpanded] = useState(false);
  const preview = turn.content?.slice(0, 80) || "thinking...";
  return (
    <div className="px-3 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 hover:bg-zinc-900/30 transition-colors rounded px-1 py-0.5 -mx-1"
      >
        <span className="text-[10px] text-violet-400/60 font-mono">~</span>
        <span className="text-[10px] text-zinc-600 font-mono italic truncate">
          {expanded ? "thinking" : preview}
        </span>
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 mt-1 border-l border-violet-900/30 pl-3 max-h-[300px] overflow-y-auto">
          <div className="text-[10px] text-zinc-600 font-mono whitespace-pre-wrap italic">
            {turn.content}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const source = turn.source || "";
  const isUser = turn.role === "user";
  const isSystem = source === "system";
  const isTool = source === "orchestrator:tool" || !!turn.tool_use_id;
  const isThinking = source.endsWith(":thinking");
  const isWorker = source.startsWith("worker:") && !isThinking;
  const workerID = isWorker ? source.slice(7) : "";

  if (isThinking) {
    return <ThinkingBubble turn={turn} />;
  }

  if (isTool) {
    return <ToolIndicatorBubble turn={turn} />;
  }

  if (isSystem) {
    return (
      <div className="px-3 py-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">*</span>
          <span className="text-[10px] text-zinc-600 font-mono">{turn.content}</span>
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">
            {timeAgo(turn.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  const prefix = isUser ? ">" : "$";
  const label = isUser
    ? "user"
    : isWorker
      ? `worker ${workerID.slice(0, 12)}`
      : "orchestrator";
  const color = isUser
    ? "text-blue-400"
    : isWorker
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <div className={`px-3 py-2 ${isUser ? "bg-zinc-900/30" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-mono ${color}`}>{prefix}</span>
        <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">
          {timeAgo(turn.timestamp)}
        </span>
      </div>
      <div className="ml-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
      </div>
    </div>
  );
}

// ── Worker Group (collapsible sub-agent) ──

interface TurnGroup {
  type: "message" | "worker";
  workerId?: string;
  turns: HypeshipConversationTurn[];
}

function groupTurnsByWorker(turns: HypeshipConversationTurn[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  for (const turn of turns) {
    const wid = turn.worker_id;
    if (wid) {
      const last = groups[groups.length - 1];
      if (last && last.type === "worker" && last.workerId === wid) {
        last.turns.push(turn);
      } else {
        groups.push({ type: "worker", workerId: wid, turns: [turn] });
      }
    } else {
      groups.push({ type: "message", turns: [turn] });
    }
  }
  return groups;
}

// ── Sub-agent grouping within a worker ──

interface SubAgentTurnGroup {
  type: "turn" | "subagent";
  turns: HypeshipConversationTurn[];
}

function isSubAgentToolCall(turn: HypeshipConversationTurn): boolean {
  if (!turn.tool_use_id || turn.content !== "Agent") return false;
  try {
    const d = typeof turn.detail === "string" ? JSON.parse(turn.detail) : turn.detail;
    return !!(d as Record<string, unknown>)?.subagent_type;
  } catch {
    return false;
  }
}

function groupWorkerTurnsBySubAgent(turns: HypeshipConversationTurn[]): SubAgentTurnGroup[] {
  const agentToolIds = new Set<string>();
  const childMap = new Map<string, HypeshipConversationTurn[]>();

  for (const turn of turns) {
    if (isSubAgentToolCall(turn) && turn.tool_use_id) {
      agentToolIds.add(turn.tool_use_id);
      childMap.set(turn.tool_use_id, []);
    }
  }

  if (agentToolIds.size === 0) {
    return turns.map((t) => ({ type: "turn" as const, turns: [t] }));
  }

  for (const turn of turns) {
    if (turn.parent_tool_use_id && childMap.has(turn.parent_tool_use_id)) {
      childMap.get(turn.parent_tool_use_id)!.push(turn);
    }
  }

  const groups: SubAgentTurnGroup[] = [];
  for (const turn of turns) {
    if (isSubAgentToolCall(turn) && turn.tool_use_id) {
      const children = childMap.get(turn.tool_use_id) || [];
      groups.push({ type: "subagent", turns: [turn, ...children] });
    } else if (turn.parent_tool_use_id && agentToolIds.has(turn.parent_tool_use_id)) {
      continue;
    } else {
      groups.push({ type: "turn", turns: [turn] });
    }
  }

  return groups;
}

function SubAgentGroup({ turns }: { turns: HypeshipConversationTurn[] }) {
  const [expanded, setExpanded] = useState(false);

  const agentCall = turns[0];
  const childTurns = turns.slice(1);

  let description = "sub-agent";
  let subagentType = "Agent";
  try {
    const d = typeof agentCall.detail === "string" ? JSON.parse(agentCall.detail) : agentCall.detail;
    const rec = d as Record<string, unknown>;
    description = (rec?.description as string) || "sub-agent";
    subagentType = (rec?.subagent_type as string) || "Agent";
  } catch {}

  const status = agentCall.status || "running";
  const isRunning = status === "running";
  const isComplete = status === "complete";
  const isError = status === "error";

  const stepCount = childTurns.length;
  const dotColor = isComplete ? "bg-emerald-400" : isError ? "bg-red-400" : "bg-violet-400";
  const labelColor = isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-violet-400";
  const borderColor = isComplete ? "border-emerald-400/20" : isError ? "border-red-400/20" : "border-violet-400/20";

  const lastActivity = (() => {
    const last = [...childTurns].reverse().find((t) => t.content?.trim());
    if (!last) return null;
    return getCollapsedTurnPreview(last);
  })();

  const statusLabel = isComplete
    ? "done"
    : isError
      ? "error"
      : stepCount > 0
        ? `${stepCount} step${stepCount !== 1 ? "s" : ""}...`
        : "working...";

  return (
    <div className={`border-l-2 ${borderColor} ml-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-900/30 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={`text-[10px] ${labelColor} font-mono`}>⚡ {subagentType}</span>
        <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[300px]">{description}</span>
        <span className="text-[10px] text-zinc-600 font-mono">
          {stepCount > 0 && isComplete ? `${stepCount} step${stepCount !== 1 ? "s" : ""}` : statusLabel}
        </span>
        {agentCall.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono">{timeAgo(agentCall.timestamp)}</span>
        )}
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">{expanded ? "▼" : "▶"}</span>
      </button>
      {!expanded && isRunning && lastActivity && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <p className="text-[10px] text-zinc-500 font-mono truncate ml-4 animate-pulse">
            {lastActivity}
          </p>
        </div>
      )}
      {expanded && childTurns.length > 0 && (
        <div className="border-t border-zinc-800/20">
          <div className="divide-y divide-zinc-800/20 max-h-[400px] overflow-y-auto">
            {childTurns.map((turn, i) => (
              <ConversationBubble key={i} turn={turn} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkerGroup({ workerId, turns }: { workerId: string; turns: HypeshipConversationTurn[] }) {
  const [expanded, setExpanded] = useState(false);
  const statusTurn = turns.find((turn) => turn.status);
  const placeholderTurn = statusTurn ?? turns.find((turn) => turn.source?.startsWith("worker:"));
  const status = statusTurn?.status;
  const isFinished = status === "complete";
  const shortId = workerId.slice(0, 12);
  const stepCount = turns.length;
  const summary = statusTurn?.content;
  const visibleTurns = turns.filter((turn) => turn !== statusTurn || !!turn.content?.trim());

  const isError = status === "error";
  const dotColor = isFinished ? "bg-emerald-400" : isError ? "bg-red-400" : "bg-blue-400";
  const labelColor = isFinished ? "text-emerald-400" : isError ? "text-red-400" : "text-blue-400";
  const borderColor = isFinished ? "border-emerald-400/30" : isError ? "border-red-400/30" : "border-blue-400/30";

  const lastTurn = [...turns]
    .reverse()
    .find((turn) => turn !== statusTurn && !!turn.content?.trim());
  const lastActivity = lastTurn ? getCollapsedTurnPreview(lastTurn) : null;

  return (
    <div className={`border-l-2 ${borderColor} ml-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-900/30 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {!isFinished && !isError && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={`text-[10px] ${labelColor} font-mono`}>worker {shortId}</span>
        <span className="text-[10px] text-zinc-600 font-mono">
          {stepCount > 0
            ? `${stepCount} steps${isFinished || isError ? "" : "..."}`
            : isFinished
              ? "done"
              : isError
                ? "error"
                : "working..."}
        </span>
        {placeholderTurn?.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono">{timeAgo(placeholderTurn.timestamp)}</span>
        )}
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">{expanded ? "▼" : "▶"}</span>
      </button>
      {!expanded && lastActivity && !isFinished && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <p className={`text-[10px] text-zinc-500 font-mono truncate ml-4 ${!isFinished && !isError ? "animate-pulse" : ""}`}>
            {lastActivity}
          </p>
        </div>
      )}
      {expanded && (
        <div className="border-t border-zinc-800/20">
          <div className="divide-y divide-zinc-800/20 max-h-[500px] overflow-y-auto">
            {groupWorkerTurnsBySubAgent(visibleTurns).map((group, gi) =>
              group.type === "subagent" ? (
                <SubAgentGroup key={`sa-${gi}`} turns={group.turns} />
              ) : (
                group.turns.map((turn, ti) => (
                  <ConversationBubble key={`t-${gi}-${ti}`} turn={turn} />
                ))
              )
            )}
          </div>
          {summary && (
            <div className="border-t border-zinc-800/30 px-3 py-2">
              <p className="text-[10px] text-zinc-600 font-mono mb-1">summary</p>
              <p className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap">{summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared views for shell/desktop ──

function buildDesktopUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("password", "changeme");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function TerminalView({ wsUrl }: { wsUrl: string }) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!termRef.current || !wsUrl) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      const terminal = new Terminal({
        fontSize: 12,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        theme: {
          background: "#09090b",
          foreground: "#d4d4d8",
          cursor: "#3b82f6",
          selectionBackground: "#3b82f640",
        },
        cursorBlink: true,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(termRef.current!);
      fitAddon.fit();

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        terminal.writeln("\x1b[32m● Connected to shell\x1b[0m\r\n");
        ws.send("cd /home/agent 2>/dev/null; clear\n");
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          terminal.write(new Uint8Array(event.data));
        } else {
          terminal.write(event.data);
        }
      };

      ws.onclose = () => {
        terminal.writeln("\r\n\x1b[31m● Disconnected\x1b[0m");
      };

      ws.onerror = () => {
        terminal.writeln("\r\n\x1b[31m● Connection error\x1b[0m");
      };

      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const el = termRef.current!;
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch {}
      });
      resizeObserver.observe(el);

      cleanup = () => {
        resizeObserver.disconnect();
        ws.close();
        terminal.dispose();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [wsUrl]);

  return <div ref={termRef} className="h-full w-full bg-[#09090b] p-1" />;
}

function DesktopView({ desktopUrl }: { desktopUrl: string }) {
  const url = buildDesktopUrl(desktopUrl);
  return (
    <div className="h-full flex flex-col">
      <iframe
        src={url}
        className="flex-1 w-full bg-black"
        allow="clipboard-read; clipboard-write"
      />
      <div className="px-2 py-1 border-t border-zinc-800 flex items-center justify-between shrink-0">
        <span className="text-[9px] text-zinc-600 font-mono">KasmVNC</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-blue-400 hover:text-blue-300 font-mono"
        >
          open in tab ↗
        </a>
      </div>
    </div>
  );
}

function NoConnectionView({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-1">
        <p className="text-[10px] text-zinc-600 font-mono">no {label} available</p>
        <p className="text-[10px] text-zinc-700 font-mono">waiting for worker to start...</p>
      </div>
    </div>
  );
}

type DetailTab = "chat" | "shell" | "desktop";

// ── Agent Detail Panel ──

function AgentConversationPanel({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const { data, error } = useHypeshipAgent(agentId);
  const turns = data?.agent?.messages ?? [];
  const [detailTab, setDetailTab] = useState<DetailTab>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamChunks, setStreamChunks] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Extract the most recent worker ID from conversation turns
  const activeWorkerId = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].worker_id) return turns[i].worker_id;
    }
    return null;
  }, [turns]);

  const { data: workerData } = useHypeshipWorker(activeWorkerId ?? null);
  const worker = workerData?.worker;
  const hasShell = !!worker?.shell_ws_url;
  const hasDesktop = !!worker?.desktop_url;

  useEffect(() => {
    if (detailTab === "shell" && !hasShell) setDetailTab("chat");
    if (detailTab === "desktop" && !hasDesktop) setDetailTab("chat");
  }, [detailTab, hasShell, hasDesktop]);

  useEffect(() => {
    if (detailTab === "chat") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns.length, streamChunks.length, detailTab]);

  // SSE streaming for real-time updates
  useEffect(() => {
    const apiUrl = getHypeshipApiUrl();
    const jwt = getHypeshipJwt();
    if (!apiUrl || !jwt) return;

    const evtSource = new EventSource(
      `/api/hypeship/agents/${agentId}/stream?jwt=${encodeURIComponent(jwt)}&url=${encodeURIComponent(apiUrl)}`
    );

    evtSource.addEventListener("message", (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "chunk" && ev.text) {
          setStreamChunks((prev) => [...prev, ev.text]);
        } else if (ev.type === "done" || ev.type === "stopped") {
          setStreamChunks([]);
        }
      } catch {}
    });

    return () => evtSource.close();
  }, [agentId]);

  const streamingText = streamChunks.join("");

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendHypeshipFollowUp(agentId, text);
      setInput("");
    } catch {}
    setSending(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-zinc-300 font-mono truncate">
            {turns.length > 0 ? (turns.find((t) => t.role === "user")?.content?.slice(0, 60) || agentId) : agentId}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {data?.agent?.source}
          </span>
          <span className="text-[10px] text-zinc-700 font-mono">·</span>
          <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap">
            {agentId}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(["chat", "shell", "desktop"] as const).map((t) => {
            if (t === "shell" && !hasShell) return null;
            if (t === "desktop" && !hasDesktop) return null;
            return (
              <button
                key={t}
                onClick={() => setDetailTab(t)}
                className={`px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${
                  detailTab === t
                    ? "border-blue-500/50 text-blue-400"
                    : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {t}
              </button>
            );
          })}
          <button
            onClick={async () => { try { await stopHypeshipAgent(agentId); } catch {} }}
            className="text-[10px] text-zinc-600 hover:text-red-400 font-mono px-2 py-0.5 border border-zinc-800 hover:border-red-900/50 transition-colors ml-1"
          >
            [stop]
          </button>
          <button
            onClick={onClose}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 font-mono px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            [close]
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {detailTab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto min-h-0">
              {error && (
                <div className="px-3 py-2">
                  <p className="text-[10px] text-red-400/70 font-mono">{error.message}</p>
                </div>
              )}
              {!error && turns.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[10px] text-zinc-600 font-mono">
                    waiting for conversation...
                  </p>
                </div>
              )}
              <div className="divide-y divide-zinc-800/30">
                {groupTurnsByWorker(turns).map((group, gi) =>
                  group.type === "worker" && group.workerId ? (
                    <WorkerGroup key={`w-${group.workerId}-${gi}`} workerId={group.workerId} turns={group.turns} />
                  ) : (
                    group.turns.map((turn, ti) => (
                      <ConversationBubble key={`m-${gi}-${ti}`} turn={turn} />
                    ))
                  )
                )}
              </div>
              {streamingText && (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-emerald-400">$</span>
                    <span className="text-[10px] text-zinc-500 font-mono">orchestrator</span>
                    <span className="text-[10px] text-zinc-700 font-mono ml-auto animate-pulse">streaming...</span>
                  </div>
                  <div className="ml-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                    {streamingText}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-zinc-800">
              {(data?.agent?.queued_followups?.length ?? 0) > 0 && (
                <div className="px-3 py-1.5 border-b border-zinc-800/50">
                  {data!.agent.queued_followups!.map((q) => (
                    <div key={q.id} className="flex items-start gap-2 py-0.5 opacity-50">
                      <span className="text-[10px] font-mono text-blue-400/70">&gt;</span>
                      <span className="text-[10px] text-zinc-500 font-mono truncate">{q.message}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-2 py-2 flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="send a follow-up..."
                rows={1}
                className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
              />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-3 py-1.5 text-[10px] font-mono bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {sending ? "..." : "↵"}
        </button>
              </div>
            </div>
          </div>
        )}

        {detailTab === "shell" && (
          hasShell ? <TerminalView wsUrl={worker!.shell_ws_url!} /> : <NoConnectionView label="shell" />
        )}

        {detailTab === "desktop" && (
          hasDesktop ? <DesktopView desktopUrl={worker!.desktop_url!} /> : <NoConnectionView label="desktop" />
        )}
      </div>
    </div>
  );
}

// ── New Chat Panel ──

interface LocalMessage {
  role: string;
  content: string;
  timestamp: string;
}

function NewChatPanel({
  onClose,
  onAgentCreated,
}: {
  onClose: () => void;
  onAgentCreated: (agentId: string) => void;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [streamChunks, setStreamChunks] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamChunks.length]);

  // SSE streaming: connect when we have an agentId
  useEffect(() => {
    if (!agentId) return;
    const apiUrl = getHypeshipApiUrl();
    const jwt = getHypeshipJwt();
    if (!apiUrl || !jwt) return;

    const evtSource = new EventSource(
      `/api/hypeship/agents/${agentId}/stream?jwt=${encodeURIComponent(jwt)}&url=${encodeURIComponent(apiUrl)}`
    );

    evtSource.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "chunk" && data.text) {
          setStreamChunks((prev) => [...prev, data.text]);
        }
        if (data.type === "done" && data.text) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.text, timestamp: new Date().toISOString() },
          ]);
          setStreamChunks([]);
        }
      } catch {
        // ignore parse errors
      }
    });

    return () => evtSource.close();
  }, [agentId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");

    const userMsg: LocalMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const resp = await sendHypeshipPrompt({ message: text });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: resp.message, timestamp: new Date().toISOString() },
      ]);

      if (resp.agent_id) {
        setAgentId(resp.agent_id);
        onAgentCreated(resp.agent_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to send");
    } finally {
      setSending(false);
    }
  }

  const streamingText = streamChunks.join("");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
          </span>
          <span className="text-[10px] text-zinc-300 font-mono">new chat</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono px-1.5 py-0.5"
        >
          [close]
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 && !sending && (
          <div className="h-full flex items-center justify-center">
            <p className="text-[10px] text-zinc-600 font-mono">what do you want to build?</p>
          </div>
        )}
        <div className="divide-y divide-zinc-800/30">
          {messages.map((msg, i) => (
            <div key={i} className={`px-3 py-2 ${msg.role === "user" ? "bg-zinc-900/30" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-mono ${msg.role === "user" ? "text-blue-400" : "text-emerald-400"}`}>
                  {msg.role === "user" ? ">" : "$"}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{msg.role}</span>
                <span className="text-[10px] text-zinc-700 font-mono ml-auto">
                  {timeAgo(msg.timestamp)}
                </span>
              </div>
              <div className="ml-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {streamingText && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-emerald-400">$</span>
                <span className="text-[10px] text-zinc-500 font-mono">assistant</span>
                <span className="text-[10px] text-zinc-700 font-mono ml-auto animate-pulse">streaming...</span>
              </div>
              <div className="ml-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                {streamingText}
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-3 py-1 border-t border-red-900/30">
          <p className="text-[10px] text-red-400/70 font-mono">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 px-2 py-2 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="send a message..."
          rows={1}
          className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-3 py-1.5 text-[10px] font-mono bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {sending ? "..." : "↵"}
        </button>
      </div>
    </div>
  );
}

// ── Worker Detail (info + conversation tabs) ──

type WorkerTab = "chat" | "shell" | "desktop" | "info";

function WorkerDetailPanel({
  workerId,
  onClose,
  onArchive,
}: {
  workerId: string;
  onClose: () => void;
  onArchive: (id: string) => void;
}) {
  const { data, error } = useHypeshipWorker(workerId);
  const agent = data?.worker;
  const [tab, setTab] = useState<WorkerTab>("chat");

  const hasShell = !!agent?.shell_ws_url;
  const hasDesktop = !!agent?.desktop_url;

  useEffect(() => {
    if (tab === "shell" && !hasShell) setTab("chat");
    if (tab === "desktop" && !hasDesktop) setTab("chat");
  }, [tab, hasShell, hasDesktop]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[10px] text-red-400 font-mono">failed to load: {error.message}</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[10px] text-zinc-500 font-mono animate-pulse">loading...</p>
      </div>
    );
  }

  const isActive = agent.state === "creating" || agent.state === "running";

  const tabs: WorkerTab[] = ["chat"];
  if (hasShell) tabs.push("shell");
  if (hasDesktop) tabs.push("desktop");
  tabs.push("info");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <WorkerStateDot state={agent.state} />
          <span className="text-[10px] text-zinc-300 font-mono truncate">
            {agent.topic || agent.id.slice(0, 8)}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {AGENT_LABELS[agent.agent_type]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <button
              onClick={() => onArchive(agent.id)}
              className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
            >
              archive
            </button>
          )}
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono px-1.5 py-0.5"
          >
            [close]
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[10px] font-mono transition-colors ${
              tab === t
                ? "text-zinc-200 border-b border-blue-500"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "chat" && (
          <AgentConversation workerId={agent.id} workerState={agent.state} />
        )}
        {tab === "shell" && (
          hasShell ? <TerminalView wsUrl={agent.shell_ws_url!} /> : <NoConnectionView label="shell" />
        )}
        {tab === "desktop" && (
          hasDesktop ? <DesktopView desktopUrl={agent.desktop_url!} /> : <NoConnectionView label="desktop" />
        )}
        {tab === "info" && (
          <WorkerInfoTab worker={agent} />
        )}
      </div>
    </div>
  );
}

function WorkerInfoTab({ worker }: { worker: HypeshipWorker }) {
  return (
    <div className="overflow-y-auto h-full px-3 py-2 space-y-3 text-[11px] font-mono">
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span className="text-zinc-600">id</span>
        <span className="text-zinc-400 truncate">{worker.id}</span>

        <span className="text-zinc-600">state</span>
        <span className="text-zinc-300">{worker.state}</span>

        <span className="text-zinc-600">agent</span>
        <span className="text-zinc-300">{AGENT_LABELS[worker.agent_type]}</span>

        <span className="text-zinc-600">mode</span>
        <span className="text-zinc-300">{worker.launch_mode?.replace("_", " ") ?? "—"}</span>

        <span className="text-zinc-600">approval</span>
        <span className="text-zinc-300">{worker.approval_mode?.replace("_", " ") ?? "—"}</span>

        {worker.branch_name && (
          <>
            <span className="text-zinc-600">branch</span>
            <span className="text-zinc-300">{worker.branch_name}</span>
          </>
        )}

        <span className="text-zinc-600">image</span>
        <span className="text-zinc-300 truncate">{worker.launch_image}</span>

        <span className="text-zinc-600">hypeman</span>
        <span className="text-zinc-300 truncate">{worker.hypeman_name}</span>

        <span className="text-zinc-600">created</span>
        <span className="text-zinc-300">{timeAgo(worker.created_at)}</span>

        {worker.started_at && (
          <>
            <span className="text-zinc-600">started</span>
            <span className="text-zinc-300">{timeAgo(worker.started_at)}</span>
          </>
        )}

        {worker.finished_at && (
          <>
            <span className="text-zinc-600">finished</span>
            <span className="text-zinc-300">{timeAgo(worker.finished_at)}</span>
          </>
        )}

        {worker.last_heartbeat_at && (
          <>
            <span className="text-zinc-600">heartbeat</span>
            <span className="text-zinc-300">{timeAgo(worker.last_heartbeat_at)}</span>
          </>
        )}
      </div>

      <div className="space-y-1">
        <span className="text-zinc-600">prompt</span>
        <div className="text-zinc-300 bg-zinc-900/60 border border-zinc-800 p-2 whitespace-pre-wrap text-[10px]">
          {worker.initial_prompt}
        </div>
      </div>

      {worker.summary && (
        <div className="space-y-1">
          <span className="text-zinc-600">summary</span>
          <div className="text-zinc-300 bg-zinc-900/60 border border-zinc-800 p-2 whitespace-pre-wrap text-[10px]">
            {worker.summary}
          </div>
        </div>
      )}

      {worker.last_error && (
        <div className="space-y-1">
          <span className="text-red-400">error</span>
          <div className="text-red-300 bg-red-900/10 border border-red-900/30 p-2 whitespace-pre-wrap text-[10px]">
            {worker.last_error}
          </div>
        </div>
      )}

      {(worker.shell_connect_command || worker.desktop_url || worker.shell_ws_url) && (
        <div className="space-y-1.5">
          <span className="text-zinc-600">connections</span>
          {worker.shell_connect_command && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-600">shell command</span>
              <div className="text-zinc-300 bg-zinc-900/60 border border-zinc-800 p-2 text-[10px] break-all select-all">
                {worker.shell_connect_command}
              </div>
            </div>
          )}
          {worker.desktop_url && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-600">desktop</span>
              <a
                href={worker.desktop_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 text-[10px] underline truncate"
              >
                {worker.desktop_url}
              </a>
            </div>
          )}
          {worker.shell_ws_url && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-600">shell ws</span>
              <p className="text-zinc-400 text-[10px] break-all select-all">{worker.shell_ws_url}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Secrets View ──

function SecretsView() {
  const { data, error, isLoading } = useHypeshipSecrets();
  const secrets = data?.secrets ?? [];
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"team" | "user">("team");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreate() {
    if (!name.trim() || !value.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await createHypeshipSecret(name.trim(), value.trim(), scope);
      setName("");
      setValue("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "failed to create secret");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(secretName: string, secretScope: string) {
    try {
      await deleteHypeshipSecret(secretName, secretScope);
    } catch {
      // ignore
    }
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="px-3 py-3 space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">add secret</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-zinc-600 font-mono">name</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MY_SECRET"
                className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-zinc-600 font-mono">value</p>
              <input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="secret value"
                className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-600 font-mono">scope</p>
              <div className="flex gap-1">
                {(["team", "user"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-2 py-1.5 text-[10px] font-mono border transition-colors ${
                      scope === s
                        ? "border-blue-500 text-blue-400 bg-blue-500/10"
                        : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || !value.trim() || creating}
              className="px-3 py-1.5 text-[10px] font-mono bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {creating ? "..." : "add"}
            </button>
          </div>
          {createError && (
            <p className="text-[10px] text-red-400/70 font-mono">{createError}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide mb-2">
            secrets ({secrets.length})
          </p>

          {isLoading && secrets.length === 0 && (
            <p className="text-[10px] text-zinc-600 font-mono animate-pulse">loading...</p>
          )}

          {error && (
            <p className="text-[10px] text-red-400 font-mono">{error.message}</p>
          )}

          {!isLoading && secrets.length === 0 && !error && (
            <p className="text-[10px] text-zinc-600 font-mono">no secrets yet</p>
          )}

          <div className="space-y-0.5">
            {secrets.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-900/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] text-zinc-200 font-mono truncate">{s.name}</span>
                  <span className="text-[10px] text-zinc-600 font-mono">{s.scope}</span>
                  <span className="text-[10px] text-zinc-700 font-mono">{timeAgo(s.created_at)}</span>
                </div>
                <button
                  onClick={() => handleDelete(s.name, s.scope)}
                  className="text-[10px] text-zinc-700 hover:text-red-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Settings View ──

function SettingsView() {
  const { data: userData, error: userError } = useHypeshipUser();
  const { data: identData, error: identError } = useHypeshipIdentities();
  const [authConfig, setAuthConfig] = useState<HypeshipAuthConfig | null>(null);
  const [settingsLinkLoading, setSettingsLinkLoading] = useState(false);
  const [settingsLinkError, setSettingsLinkError] = useState("");
  const user = userData?.user;
  const identities = identData?.identities ?? [];

  useEffect(() => {
    getHypeshipAuthConfig()
      .then(setAuthConfig)
      .catch(() => {});
  }, []);

  async function handleUnlink(provider: string) {
    try {
      await unlinkHypeshipIdentity(provider);
    } catch {
      // ignore
    }
  }

  async function openSettingsPage() {
    if (settingsLinkLoading) return;
    setSettingsLinkLoading(true);
    setSettingsLinkError("");
    try {
      const { url } = await getHypeshipSettingsLink();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setSettingsLinkError(e instanceof Error ? e.message : "failed to generate link");
    } finally {
      setSettingsLinkLoading(false);
    }
  }

  return (
    <div className="overflow-y-auto h-full px-3 py-3 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={openSettingsPage}
          disabled={settingsLinkLoading}
          className="text-[10px] font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {settingsLinkLoading ? "generating link..." : "open api settings page ↗"}
        </button>
        {settingsLinkError && (
          <span className="text-[10px] text-red-400/70 font-mono">{settingsLinkError}</span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">user</p>
        {userError && (
          <p className="text-[10px] text-red-400 font-mono">{userError.message}</p>
        )}
        {!user && !userError && (
          <p className="text-[10px] text-zinc-600 font-mono animate-pulse">loading...</p>
        )}
        {user && (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-mono">
            <span className="text-zinc-600">id</span>
            <span className="text-zinc-400 truncate">{user.id}</span>
            <span className="text-zinc-600">name</span>
            <span className="text-zinc-300">{user.display_name}</span>
            {user.email && (
              <>
                <span className="text-zinc-600">email</span>
                <span className="text-zinc-300">{user.email}</span>
              </>
            )}
            <span className="text-zinc-600">created</span>
            <span className="text-zinc-300">{timeAgo(user.created_at)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-3 space-y-2">
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
          linked identities ({identities.length})
        </p>
        {identError && (
          <p className="text-[10px] text-red-400 font-mono">{identError.message}</p>
        )}
        {identities.length === 0 && !identError && (
          <p className="text-[10px] text-zinc-600 font-mono">no linked identities</p>
        )}
        <div className="space-y-1">
          {identities.map((ident) => (
            <div
              key={ident.id}
              className="flex items-center justify-between px-2 py-1.5 border border-zinc-800 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] text-zinc-200 font-mono">{ident.provider}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate">
                  {ident.provider_id}
                </span>
                {ident.has_token && (
                  <span className="text-[10px] text-emerald-400/70 font-mono">token</span>
                )}
              </div>
              <button
                onClick={() => handleUnlink(ident.provider)}
                className="text-[10px] text-zinc-700 hover:text-red-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity"
              >
                unlink
              </button>
            </div>
          ))}
        </div>
      </div>

      {authConfig && authConfig.providers.length > 0 && (
        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
            available providers
          </p>
          {authConfig.providers.map((p) => (
            <div key={p.type} className="flex items-center gap-3 px-2 py-1.5 border border-zinc-800">
              <span className="text-[11px] text-zinc-200 font-mono">{p.type}</span>
              <span className="text-[10px] text-zinc-600 font-mono truncate">
                client: {p.client_id}
              </span>
            </div>
          ))}
        </div>
      )}

      <ResetSection />
    </div>
  );
}

function ResetSection() {
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<"ok" | "error" | null>(null);

  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    setResult(null);
    try {
      await resetHypeshipOrchestrator();
      setResult("ok");
    } catch {
      setResult("error");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="border-t border-zinc-800 pt-3 space-y-2">
      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
        orchestrator
      </p>
      <p className="text-[10px] text-zinc-600 font-mono">
        reset destroys the orchestrator VM and picks up the latest image on next message.
        existing conversations are preserved but claude session context is lost.
      </p>
      <button
        onClick={handleReset}
        disabled={resetting}
        className="px-3 py-1.5 text-[10px] font-mono border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {resetting ? "resetting..." : "reset orchestrator"}
      </button>
      {result === "ok" && (
        <p className="text-[10px] text-emerald-400/70 font-mono">
          orchestrator reset. next message will spin up a fresh one.
        </p>
      )}
      {result === "error" && (
        <p className="text-[10px] text-red-400/70 font-mono">
          reset failed
        </p>
      )}
    </div>
  );
}

// ── Dashboard ──

type DashboardTab = "agents" | "secrets" | "settings";

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function DashboardListView({
  onLogout,
  onSwitchView,
}: {
  onLogout: () => void;
  onSwitchView: (v: HypeshipView) => void;
}) {
  const [tab, setTab] = useState<DashboardTab>("agents");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listWidth, setListWidth] = useState(320);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(200, Math.min(e.clientX - rect.left, rect.width - 300));
      setListWidth(newWidth);
    }
    function onMouseUp() {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const { data: agentsData, error: agentsError, isLoading: agentsLoading } = useHypeshipAgents();
  const agents = agentsData?.agents ?? [];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedId) {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId]);

  const agentCount = agents.length;

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-300 font-mono">hypeship</span>
          <div className="flex items-center gap-0.5 ml-1">
            {(["dashboard", "panes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onSwitchView(v)}
                className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${
                  v === "dashboard"
                    ? "text-zinc-200 bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 ml-1 border-l border-zinc-800 pl-2">
            {(["agents", "secrets", "settings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedId(null); }}
                className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${
                  tab === t
                    ? "text-zinc-200 bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "agents" && (
            <span className="text-[10px] text-zinc-600 font-mono">
              {agentCount} agent{agentCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tab === "agents" && (
            <button
              onClick={() => setSelectedId("new")}
              className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                selectedId === "new"
                  ? "text-blue-400 border-blue-500/50"
                  : "text-blue-400 hover:text-blue-300 border-zinc-800 hover:border-zinc-600"
              }`}
            >
              [new chat]
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            [disconnect]
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0" ref={containerRef}>
        {tab === "agents" && (
          <>
            {/* Agent list */}
            <div
              className="flex flex-col overflow-hidden shrink-0"
              style={{ width: selectedId ? listWidth : "100%" }}
            >
              <div className="flex-1 overflow-y-auto">
              {agentsLoading && agents.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[10px] text-zinc-600 font-mono animate-pulse">
                    loading agents...
                  </p>
                </div>
              )}

              {agentsError && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[10px] text-red-400 font-mono">{agentsError.message}</p>
                </div>
              )}

              {!agentsLoading && agents.length === 0 && !agentsError && (
                <div className="px-3 py-16 text-center space-y-3">
                  <p className="text-[10px] text-zinc-600 font-mono">no conversations yet</p>
                  <button
                    onClick={() => setSelectedId("new")}
                    className="text-[10px] font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 transition-colors"
                  >
                    start a new chat
                  </button>
                </div>
              )}

              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  className={`w-full text-left border-b border-zinc-800/50 px-3 py-2 hover:bg-zinc-900/40 transition-colors ${
                    selectedId === agent.id ? "bg-zinc-900/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusDot status={agent.status} />
                    <span className="text-[11px] text-zinc-200 font-mono truncate flex-1">
                      {agent.preview || agent.id.slice(0, 16)}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                      {timeAgo(agent.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-[10px] text-zinc-600 font-mono">
                      {agent.source}
                    </span>
                    <span className="text-[10px] text-zinc-700 font-mono">·</span>
                    <span className="text-[10px] text-zinc-700 font-mono">
                      {agent.message_count} msg{agent.message_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))}
              </div>
            </div>

            {/* Resize handle */}
            {selectedId && (
              <div
                className="w-px bg-zinc-800 hover:bg-zinc-600 cursor-col-resize shrink-0 relative group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  isDragging.current = true;
                  document.body.style.cursor = "col-resize";
                  document.body.style.userSelect = "none";
                }}
              >
                <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-500/20" />
              </div>
            )}

            {/* Detail panel */}
            {selectedId && (
              <div className="flex-1 min-h-0 min-w-0">
                {selectedId === "new" ? (
                  <NewChatPanel
                    key="new"
                    onClose={() => setSelectedId(null)}
                    onAgentCreated={(agentId) => {
                      setSelectedId(agentId);
                    }}
                  />
                ) : (
                  <AgentConversationPanel
                    key={selectedId}
                    agentId={selectedId}
                    onClose={() => setSelectedId(null)}
                  />
                )}
              </div>
            )}
          </>
        )}

        {tab === "secrets" && (
          <div className="w-full">
            <SecretsView />
          </div>
        )}

        {tab === "settings" && (
          <div className="w-full">
            <SettingsView />
          </div>
        )}
      </div>

    </div>
  );
}

// ── Panes View ──

function PanesView({
  onLogout,
  onSwitchView,
}: {
  onLogout: () => void;
  onSwitchView: (v: HypeshipView) => void;
}) {
  const [grid, setGrid] = useState(getHypeshipGrid);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  const { data: agentsData } = useHypeshipAgents();
  const agents = agentsData?.agents ?? [];
  const agentMap = useMemo(() => {
    const m = new Map<string, HypeshipAgentSummary>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const refreshGrid = useCallback(() => setGrid(getHypeshipGrid()), []);
  const sorted = useMemo(() => [...grid].sort((a, b) => a.order - b.order), [grid]);
  const paneCount = sorted.length;
  const gridAgentIds = useMemo(() => new Set(grid.map((g) => g.agentId)), [grid]);

  function handleAdd(agentId: string) {
    addToHypeshipGrid(agentId);
    refreshGrid();
    setShowAddModal(false);
    setFocusedId(agentId);
  }

  function handleRemove(agentId: string) {
    removeFromHypeshipGrid(agentId);
    if (focusedId === agentId) setFocusedId(null);
    refreshGrid();
  }

  function handleNewChatCreated(agentId: string) {
    addToHypeshipGrid(agentId);
    refreshGrid();
    setShowNewChat(false);
    setFocusedId(agentId);
  }

  const focusedAgent = focusedId ? agentMap.get(focusedId) : null;

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
      id: "switch-dashboard",
      label: "switch to dashboard",
      section: "app",
      action: () => onSwitchView("dashboard"),
    });
    cmds.push({
      id: "disconnect",
      label: "disconnect",
      section: "app",
      action: onLogout,
    });

    return cmds;
  }, [focusedAgent, focusedId, sorted, agentMap, onSwitchView, onLogout]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowPalette((v) => !v);
        setShowAddModal(false);
        setShowNewChat(false);
        return;
      }
      if (e.key === "Escape") {
        if (showPalette) { setShowPalette(false); return; }
        if (showAddModal || showNewChat) return;
        setFocusedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showPalette, showAddModal, showNewChat]);

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-0.5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500 font-mono">
            hypeship — {paneCount} pane{paneCount !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-0.5 ml-1">
            {(["dashboard", "panes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onSwitchView(v)}
                className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${
                  v === "panes"
                    ? "text-zinc-200 bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowPalette(true)}
          className="text-[10px] text-zinc-500 hover:text-zinc-200 font-mono"
        >
          [⌘K]
        </button>
      </div>

      {/* Pane grid */}
      {paneCount === 0 ? (
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
    </div>
  );
}

// ── View Router ──

function DashboardView({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<HypeshipView>("dashboard");

  useEffect(() => {
    setView(getHypeshipView());
  }, []);

  function handleSwitchView(v: HypeshipView) {
    setHypeshipView(v);
    setView(v);
  }

  if (view === "panes") {
    return <PanesView onLogout={onLogout} onSwitchView={handleSwitchView} />;
  }

  return <DashboardListView onLogout={onLogout} onSwitchView={handleSwitchView} />;
}

// ── Root ──

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
