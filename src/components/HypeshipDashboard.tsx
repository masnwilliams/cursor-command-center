"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getHypeshipApiUrl,
  getHypeshipJwt,
  setHypeshipJwt,
  clearHypeshipAuth,
  getHypeshipView,
  setHypeshipView,
  getHypeshipGrid,
  addToHypeshipGrid,
  removeFromHypeshipGrid,
  getHypeshipEnvJwt,
  setHypeshipEnvJwt,
  clearHypeshipEnvAuth,
  activateHypeshipEnv,
  HYPESHIP_URLS,
} from "@/lib/storage";
import type { HypeshipView, HypeshipEnv } from "@/lib/storage";
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
  useHypeshipOrchestrator,
  getHypeshipSettingsLink,
  useReviewRequests,
  usePrStatus,
  usePrFiles,
  markPrReady,
} from "@/lib/api";
import { DiffBar } from "@/components/DiffBar";
import { ConfirmMergeModal } from "@/components/ConfirmMergeModal";
import { AddReviewerModal } from "@/components/AddReviewerModal";
import { buildHypeshipPrReviewPrompt } from "@/lib/prompts";
import {
  GroupedConversation,
  ConversationBubble,
  ArtifactsBar,
  timeAgo,
} from "@/components/HypeshipConversation";
import type {
  HypeshipWorker,
  HypeshipWorkerState,
  HypeshipAgentStatus,
  HypeshipAgentType,
  HypeshipConversationTurn,
  HypeshipPromptResponse,
  HypeshipAuthConfig,
  HypeshipAgentSummary,
  HypeshipArtifact,
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

  const initialScrollDone = useRef(false);
  useLayoutEffect(() => {
    if (detailTab !== "chat") return;
    if (initialScrollDone.current) return;
    if (turns.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    initialScrollDone.current = true;
  }, [turns.length, detailTab]);

  useEffect(() => {
    if (!initialScrollDone.current || detailTab !== "chat") return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, streamChunks.length, detailTab]);

  const agentStatus = data?.agent?.status;

  // Clear streaming buffer when the agent reaches a terminal state.
  useEffect(() => {
    if (agentStatus === "finished" || agentStatus === "error") {
      setStreamChunks([]);
    }
  }, [agentStatus]);

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

    evtSource.onerror = () => {
      setStreamChunks([]);
    };

    return () => {
      evtSource.close();
      setStreamChunks([]);
    };
  }, [agentId]);

  const streamingText = agentStatus === "finished" || agentStatus === "error" ? "" : streamChunks.join("");

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
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 sm:py-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs sm:text-[11px] text-zinc-300 font-mono truncate">
            {turns.length > 0 ? (turns.find((t) => t.role === "user")?.content?.slice(0, 60) || agentId) : agentId}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">
            {data?.agent?.source}
          </span>
          <span className="text-[10px] text-zinc-700 font-mono hidden sm:inline">·</span>
          <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap hidden sm:inline">
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
            stop
          </button>
          <button
            onClick={onClose}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 font-mono px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors hidden sm:block"
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
              <GroupedConversation turns={turns} />
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
              <ArtifactsBar artifacts={data?.agent?.artifacts} />
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
        if (data.type === "stopped") {
          setStreamChunks([]);
        }
      } catch {
        // ignore parse errors
      }
    });

    evtSource.onerror = () => {
      setStreamChunks([]);
    };

    return () => {
      evtSource.close();
      setStreamChunks([]);
    };
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

      <OrchestratorSection />
    </div>
  );
}

const ORCH_STATE_COLORS: Record<string, string> = {
  creating: "bg-amber-400",
  running: "bg-blue-400",
  standby: "bg-zinc-400",
  error: "bg-red-400",
};

const ORCH_STATE_PULSE: Record<string, boolean> = {
  creating: true,
  running: true,
  standby: false,
  error: false,
};

function OrchestratorSection() {
  const { data: orchData } = useHypeshipOrchestrator();
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

  const orch = orchData?.orchestrator;

  return (
    <div className="border-t border-zinc-800 pt-3 space-y-2">
      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
        orchestrator
      </p>

      {!orch ? (
        <p className="text-[10px] text-zinc-600 font-mono">no orchestrator</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {ORCH_STATE_PULSE[orch.state] && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${ORCH_STATE_COLORS[orch.state] ?? "bg-zinc-400"}`}
                />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${ORCH_STATE_COLORS[orch.state] ?? "bg-zinc-400"}`}
              />
            </span>
            <span className="text-[11px] text-zinc-200 font-mono">{orch.state}</span>
            <span className="text-[10px] text-zinc-600 font-mono truncate">
              {orch.id.length > 20 ? orch.id.slice(0, 20) + "..." : orch.id}
            </span>
          </div>

          {orch.last_active_at && (
            <p className="text-[10px] text-zinc-600 font-mono">
              last active: {new Date(orch.last_active_at).toLocaleString()}
            </p>
          )}

          {orch.pending_tasks != null && orch.pending_tasks > 0 && (
            <p className="text-[10px] text-amber-400/70 font-mono">
              {orch.pending_tasks} pending task{orch.pending_tasks !== 1 ? "s" : ""}
            </p>
          )}

          {orch.desktop_url && (
            <a
              href={orch.desktop_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
            >
              open desktop (vnc)
            </a>
          )}

          {orch.shell_ws_url && (
            <p className="text-[10px] text-zinc-600 font-mono truncate">
              ws: {orch.shell_ws_url}
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-zinc-600 font-mono">
        reset restarts the orchestrator VM on the latest image.
        all conversations and session context are preserved.
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

type DashboardTab = "agents" | "reviews" | "secrets" | "settings";

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function ReviewPrRow({
  pr,
  expanded,
  onToggle,
  launching,
  onLaunchReview,
  onMerge,
  onAddReviewer,
}: {
  pr: ReviewRequestPR;
  expanded: boolean;
  onToggle: () => void;
  launching: boolean;
  onLaunchReview: () => void;
  onMerge: () => void;
  onAddReviewer: () => void;
}) {
  const { data: filesData } = usePrFiles(expanded ? pr.url : null);
  const files = filesData?.files;
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  return (
    <div className="border-b border-zinc-800/50">
      <button
        onClick={onToggle}
        className={`w-full text-left px-3 py-3 sm:py-2 hover:bg-zinc-900/40 transition-colors ${
          expanded ? "bg-zinc-900/60" : ""
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-zinc-600 font-mono shrink-0">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="text-xs sm:text-[11px] text-zinc-200 font-mono truncate flex-1">
            {pr.title}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono shrink-0">
            #{pr.number}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-5">
          <span className="text-[10px] text-zinc-600 font-mono">{pr.repo}</span>
          <span className="text-[10px] text-zinc-700 font-mono">·</span>
          <span className="text-[10px] text-zinc-600 font-mono">{pr.author}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800/40 bg-zinc-900/30">
          {/* Action buttons */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/40">
            <button
              onClick={onLaunchReview}
              disabled={launching}
              className="text-[10px] font-mono px-2 py-0.5 border border-blue-500/50 text-blue-400 hover:bg-blue-950/30 hover:text-blue-300 transition-colors disabled:opacity-40"
            >
              {launching ? "launching..." : "review with hypeship"}
            </button>
            <button
              onClick={onMerge}
              className="text-[10px] font-mono px-2 py-0.5 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              merge
            </button>
            <button
              onClick={onAddReviewer}
              className="text-[10px] font-mono px-2 py-0.5 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              add reviewer
            </button>
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 ml-auto"
            >
              [open in github]
            </a>
          </div>

          {/* File list / diff */}
          <div className="max-h-[50vh] overflow-y-auto">
            {!files && (
              <p className="text-[10px] text-zinc-600 font-mono px-3 py-2 animate-pulse">
                loading files...
              </p>
            )}
            {files && files.length === 0 && (
              <p className="text-[10px] text-zinc-600 font-mono px-3 py-2">
                no file changes
              </p>
            )}
            {files && files.map((file) => {
              const isOpen = openFiles.has(file.filename);
              return (
                <div key={file.filename}>
                  <button
                    onClick={() => {
                      setOpenFiles((prev) => {
                        const next = new Set(prev);
                        if (next.has(file.filename)) next.delete(file.filename);
                        else next.add(file.filename);
                        return next;
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-0.5 text-left min-w-0 hover:bg-zinc-800/40"
                  >
                    <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <span className={`text-[10px] font-mono w-3 shrink-0 ${
                      file.status === "added" ? "text-green-400" :
                      file.status === "removed" ? "text-red-400" :
                      file.status === "renamed" ? "text-blue-400" :
                      "text-amber-400"
                    }`}>
                      {file.status === "added" ? "A" : file.status === "removed" ? "D" : file.status === "renamed" ? "R" : "M"}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono truncate min-w-0">
                      {file.filename}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 shrink-0">
                      {file.additions > 0 && (
                        <span className="text-[10px] text-green-500/80 font-mono">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-[10px] text-red-500/80 font-mono">-{file.deletions}</span>
                      )}
                    </span>
                  </button>
                  {isOpen && file.patch && (
                    <div className="border-t border-zinc-800/40 overflow-x-auto">
                      <pre className="text-[10px] font-mono text-zinc-400 px-3 py-1 whitespace-pre">
                        {file.patch}
                      </pre>
                    </div>
                  )}
                  {isOpen && !file.patch && (
                    <div className="px-6 py-2 text-[10px] text-zinc-600 font-mono border-t border-zinc-800/40">
                      binary file or no diff available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsPanel({
  prs,
  expandedPr,
  onToggleExpand,
  launchingReview,
  onLaunchReview,
  onMerge,
  onAddReviewer,
}: {
  prs: ReviewRequestPR[];
  expandedPr: string | null;
  onToggleExpand: (url: string) => void;
  launchingReview: string | null;
  onLaunchReview: (pr: ReviewRequestPR) => void;
  onMerge: (pr: ReviewRequestPR) => void;
  onAddReviewer: (pr: ReviewRequestPR) => void;
}) {
  if (prs.length === 0) {
    return (
      <div className="px-3 py-16 text-center">
        <p className="text-[10px] text-zinc-600 font-mono">no pending review requests</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-3 py-2 border-b border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
          prs requesting your review ({prs.length})
        </span>
      </div>
      {prs.map((pr) => (
        <ReviewPrRow
          key={pr.url}
          pr={pr}
          expanded={expandedPr === pr.url}
          onToggle={() => onToggleExpand(pr.url)}
          launching={launchingReview === pr.url}
          onLaunchReview={() => onLaunchReview(pr)}
          onMerge={() => onMerge(pr)}
          onAddReviewer={() => onAddReviewer(pr)}
        />
      ))}
    </div>
  );
}

function DashboardListView({
  env,
  onLogout,
  onSwitchView,
  initialAgentId,
}: {
  env: HypeshipEnv;
  onLogout: () => void;
  onSwitchView: (v: HypeshipView) => void;
  initialAgentId?: string | null;
}) {
  const router = useRouter();
  const basePath = env === "staging" ? "/staging/hypeship" : "/hypeship";
  const selectedId = initialAgentId ?? null;
  const [tab, setTab] = useState<DashboardTab>("agents");
  const [listWidth, setListWidth] = useState(320);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
  const { data: reviewData } = useReviewRequests();
  const reviewPrs = reviewData?.prs ?? [];
  const [expandedPr, setExpandedPr] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ prUrl: string; agentName: string } | null>(null);
  const [reviewerTarget, setReviewerTarget] = useState<{ prUrl: string; agentName: string } | null>(null);
  const [launchingReview, setLaunchingReview] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedId) {
        router.push(basePath);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, router, basePath]);

  const agentCount = agents.length;

  // On mobile, show the detail panel as a full-screen overlay
  const showMobileDetail = isMobile && selectedId;

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar — hidden on mobile when detail is open */}
      {!showMobileDetail && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 sm:py-1.5 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0 overflow-x-auto scrollbar-hide">
            <span className="text-xs text-zinc-300 font-mono shrink-0">hypeship</span>
            {env === "staging" && (
              <span className="text-[10px] text-amber-400 font-mono border border-amber-400/30 px-1.5 py-0.5 shrink-0">staging</span>
            )}
            <div className="flex items-center gap-0.5 ml-1">
              {(["dashboard", "panes"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => onSwitchView(v)}
                  className={`px-2.5 py-1 sm:px-2 sm:py-0.5 text-[11px] sm:text-[10px] font-mono transition-colors ${
                    v === "dashboard"
                      ? "text-zinc-200 bg-zinc-800"
                      : "text-zinc-600 hover:text-zinc-400 active:text-zinc-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 ml-1 border-l border-zinc-800 pl-2">
              {(["agents", "reviews", "secrets", "settings"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); if (selectedId) router.push(basePath); }}
                  className={`px-2.5 py-1 sm:px-2 sm:py-0.5 text-[11px] sm:text-[10px] font-mono transition-colors shrink-0 ${
                    tab === t
                      ? "text-zinc-200 bg-zinc-800"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {t}
                  {t === "reviews" && reviewPrs.length > 0 && (
                    <span className="ml-1 text-amber-400">{reviewPrs.length}</span>
                  )}
                </button>
              ))}
            </div>
            {tab === "agents" && (
              <span className="text-[10px] text-zinc-600 font-mono shrink-0 hidden sm:inline">
                {agentCount} agent{agentCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tab === "agents" && (
              <button
                onClick={() => router.push(`${basePath}/new`)}
                className={`text-xs sm:text-[10px] font-mono px-2 py-1 sm:py-0.5 border transition-colors ${
                  selectedId === "new"
                    ? "text-blue-400 border-blue-500/50"
                    : "text-blue-400 hover:text-blue-300 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                {isMobile ? "+" : "[new chat]"}
              </button>
            )}
            <button
              onClick={onLogout}
              className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 transition-colors hidden sm:block"
            >
              [disconnect]
            </button>
          </div>
        </div>
      )}

      {/* Mobile: full-screen detail overlay */}
      {showMobileDetail ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mobile detail header with back button */}
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 bg-zinc-900/60 shrink-0">
            <button
              onClick={() => router.push(basePath)}
              className="text-xs text-zinc-400 hover:text-zinc-200 font-mono flex items-center gap-1 shrink-0 active:text-zinc-100 py-0.5"
            >
              ← back
            </button>
            <span className="text-[10px] text-zinc-600 font-mono truncate">
              {selectedId === "new" ? "new chat" : selectedId?.slice(0, 12)}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            {selectedId === "new" ? (
              <NewChatPanel
                key="new"
                onClose={() => router.push(basePath)}
                onAgentCreated={(agentId) => {
                  router.replace(`${basePath}/${agentId}`);
                }}
              />
            ) : (
              <AgentConversationPanel
                key={selectedId}
                agentId={selectedId!}
                onClose={() => router.push(basePath)}
              />
            )}
          </div>
        </div>
      ) : (
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
                      onClick={() => router.push(`${basePath}/new`)}
                      className="text-sm sm:text-[10px] font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 px-4 sm:px-3 py-2 sm:py-1.5 transition-colors"
                    >
                      start a new chat
                    </button>
                  </div>
                )}

                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => router.push(`${basePath}/${agent.id}`)}
                    className={`w-full text-left border-b border-zinc-800/50 px-3 py-3 sm:py-2 hover:bg-zinc-900/40 active:bg-zinc-900/60 transition-colors ${
                      selectedId === agent.id ? "bg-zinc-900/60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot status={agent.status} />
                      <span className="text-xs sm:text-[11px] text-zinc-200 font-mono truncate flex-1">
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

              {/* Resize handle - desktop only */}
              {selectedId && !isMobile && (
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

              {/* Detail panel - desktop only (mobile uses overlay above) */}
              {selectedId && (
                <div className="flex-1 min-h-0 min-w-0">
                  {selectedId === "new" ? (
                    <NewChatPanel
                      key="new"
                      onClose={() => router.push(basePath)}
                      onAgentCreated={(agentId) => {
                        router.replace(`${basePath}/${agentId}`);
                      }}
                    />
                  ) : (
                    <AgentConversationPanel
                      key={selectedId}
                      agentId={selectedId}
                      onClose={() => router.push(basePath)}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {tab === "reviews" && (
            <div className="w-full overflow-y-auto">
              <ReviewsPanel
                prs={reviewPrs}
                expandedPr={expandedPr}
                onToggleExpand={(url) => setExpandedPr(expandedPr === url ? null : url)}
                launchingReview={launchingReview}
                onLaunchReview={async (pr) => {
                  setLaunchingReview(pr.url);
                  try {
                    const prompt = buildHypeshipPrReviewPrompt({
                      prUrl: pr.url,
                      repo: pr.repo,
                    });
                    const resp = await sendHypeshipPrompt({ message: prompt });
                    router.push(`${basePath}/${resp.agent_id}`);
                    setTab("agents");
                  } catch {
                    // silently fail — user can retry
                  } finally {
                    setLaunchingReview(null);
                  }
                }}
                onMerge={(pr) => setMergeTarget({ prUrl: pr.url, agentName: pr.title })}
                onAddReviewer={(pr) => setReviewerTarget({ prUrl: pr.url, agentName: pr.title })}
              />
            </div>
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
      )}

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

// ── Panes View ──

function PanesView({
  env,
  onLogout,
  onSwitchView,
}: {
  env: HypeshipEnv;
  onLogout: () => void;
  onSwitchView: (v: HypeshipView) => void;
}) {
  const [grid, setGrid] = useState(() => getHypeshipGrid(env));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
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

  const focusedAgent = focusedId ? agentMap.get(focusedId) : null;

  // Auto-focus first pane on mobile
  useEffect(() => {
    if (!isMobile || !mounted || sorted.length === 0) return;
    if (!focusedId || !sorted.some((s) => s.agentId === focusedId)) {
      setFocusedId(sorted[0].agentId);
    }
  }, [isMobile, mounted, sorted, focusedId]);

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
        if (!isMobile) setFocusedId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showPalette, showAddModal, showNewChat, isMobile]);

  if (!mounted) return null;

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className={`flex items-center justify-between border-b border-zinc-800 px-3 bg-zinc-900/60 shrink-0 ${isMobile ? "py-2" : "py-0.5"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`${isMobile ? "text-xs" : "text-[10px]"} text-zinc-500 font-mono shrink-0`}>
            hypeship
          </span>
          {env === "staging" && (
            <span className="text-[10px] text-amber-400 font-mono border border-amber-400/30 px-1.5 py-0.5 shrink-0">staging</span>
          )}
          <div className={`flex items-center gap-0.5 ml-1`}>
            {(["dashboard", "panes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onSwitchView(v)}
                className={`${isMobile ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"} font-mono transition-colors ${
                  v === "panes"
                    ? "text-zinc-200 bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-400 active:text-zinc-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
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
    </div>
  );
}

// ── View Router ──

function DashboardView({ env, onLogout, initialAgentId }: { env: HypeshipEnv; onLogout: () => void; initialAgentId?: string | null }) {
  const [view, setView] = useState<HypeshipView>("dashboard");

  useEffect(() => {
    setView(getHypeshipView(env));
  }, [env]);

  function handleSwitchView(v: HypeshipView) {
    setHypeshipView(v, env);
    setView(v);
  }

  if (view === "panes") {
    return <PanesView env={env} onLogout={onLogout} onSwitchView={handleSwitchView} />;
  }

  return <DashboardListView env={env} onLogout={onLogout} onSwitchView={handleSwitchView} initialAgentId={initialAgentId} />;
}

// ── Root ──

export default function HypeshipDashboard({ env = "production" as HypeshipEnv, initialAgentId }: { env?: HypeshipEnv; initialAgentId?: string }) {
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
    <DashboardView
      env={env}
      initialAgentId={initialAgentId}
      onLogout={() => {
        clearHypeshipEnvAuth(env);
        clearHypeshipAuth();
        setConnected(false);
      }}
    />
  );
}
