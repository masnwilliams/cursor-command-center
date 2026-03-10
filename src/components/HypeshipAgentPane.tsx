"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useHypeshipAgent,
  useHypeshipWorker,
  sendHypeshipFollowUp,
  stopHypeshipAgent,
} from "@/lib/api";
import { getHypeshipApiUrl, getHypeshipJwt } from "@/lib/storage";
import type {
  HypeshipAgentStatus,
  HypeshipConversationTurn,
} from "@/lib/types";

type PaneTab = "chat" | "shell" | "desktop";

const STATUS_COLORS: Record<HypeshipAgentStatus, string> = {
  pending: "bg-amber-400",
  running: "bg-blue-400",
  finished: "bg-emerald-400",
  stopped: "bg-zinc-400",
  error: "bg-red-400",
};

const STATUS_PULSE: Record<HypeshipAgentStatus, boolean> = {
  pending: true,
  running: true,
  finished: false,
  stopped: false,
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

function isWorkerTurn(turn: HypeshipConversationTurn): boolean {
  return !!turn.source?.startsWith("worker:");
}

function ToolIndicator({ turn }: { turn: HypeshipConversationTurn }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = turn.status === "running";
  const isError = turn.status === "error";
  const isComplete = turn.status === "complete";

  const dotColor = isError
    ? "bg-red-400"
    : isComplete
      ? "bg-emerald-400"
      : "bg-amber-400";
  const label = isError
    ? "error"
    : isComplete
      ? "done"
      : "working...";

  return (
    <div className="px-3 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 hover:bg-zinc-900/30 transition-colors rounded px-1 py-0.5 -mx-1"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-amber-400" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
        {isComplete && turn.detail && (
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">
            {expanded ? "▼" : "▶"}
          </span>
        )}
      </button>
      {expanded && turn.detail && (
        <div className="ml-4 mt-1 border-l border-zinc-800 pl-3">
          {turn.detail.map((d, i) => (
            <div key={i} className="py-1">
              <span className="text-[10px] text-zinc-600 font-mono">
                {d.role === "user" ? "> " : "$ "}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap">
                {d.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const source = turn.source || "";
  const isUser = turn.role === "user";
  const isSystem = source === "system";

  if (isWorkerTurn(turn)) {
    return <ToolIndicator turn={turn} />;
  }

  if (isSystem) {
    return (
      <div className="px-3 py-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">*</span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {turn.content}
          </span>
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">
            {timeAgo(turn.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 ${isUser ? "bg-zinc-900/30" : ""}`}>
      {isUser && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-blue-400">&gt;</span>
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">
            {timeAgo(turn.timestamp)}
          </span>
        </div>
      )}
      <div className={`${isUser ? "ml-4" : ""} text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {turn.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

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
        <p className="text-[10px] text-zinc-600 font-mono">
          no {label} available
        </p>
        <p className="text-[10px] text-zinc-700 font-mono">
          waiting for worker to start...
        </p>
      </div>
    </div>
  );
}

export default function HypeshipAgentPane({
  agentId,
  focused,
  onFocus,
  onClose,
}: {
  agentId: string;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
}) {
  const { data, error } = useHypeshipAgent(agentId);
  const agent = data?.agent;
  const turns = agent?.messages ?? [];
  const status: HypeshipAgentStatus =
    (agent as any)?.status ?? "pending";

  const [tab, setTab] = useState<PaneTab>("chat");
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
  const worker = workerData?.agent;

  const hasShell = !!worker?.shell_ws_url;
  const hasDesktop = !!worker?.desktop_url;

  // Fall back to chat if selected tab becomes unavailable
  useEffect(() => {
    if (tab === "shell" && !hasShell) setTab("chat");
    if (tab === "desktop" && !hasDesktop) setTab("chat");
  }, [tab, hasShell, hasDesktop]);

  const prevTurnCount = useRef(turns.length);
  useEffect(() => {
    if (tab !== "chat") return;
    if (turns.length > prevTurnCount.current || streamChunks.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTurnCount.current = turns.length;
  }, [turns.length, streamChunks.length, tab]);

  // SSE streaming
  useEffect(() => {
    const apiUrl = getHypeshipApiUrl();
    const jwt = getHypeshipJwt();
    if (!apiUrl || !jwt) return;

    const evtSource = new EventSource(
      `/api/hypeship/agents/${agentId}/stream?jwt=${encodeURIComponent(jwt)}&url=${encodeURIComponent(apiUrl)}`,
    );

    evtSource.addEventListener("message", (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "chunk" && ev.text) {
          setStreamChunks((prev) => [...prev, ev.text]);
        }
        if (ev.type === "done" || ev.type === "stopped") {
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

  const isActive = status === "pending" || status === "running";
  const preview =
    turns.find((t) => t.role === "user")?.content?.slice(0, 60) ||
    agentId.slice(0, 12);

  return (
    <div
      className={`flex flex-col h-full border-r border-b border-zinc-800 bg-zinc-950 ${focused ? "ring-1 ring-blue-500/30" : ""}`}
      onClick={onFocus}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusDot status={status} />
          <span className="text-[10px] text-zinc-300 font-mono truncate">
            {preview}
          </span>
          {agent?.source && (
            <span className="text-[10px] text-zinc-600 font-mono shrink-0">
              {agent.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(["chat", "shell", "desktop"] as const).map((t) => {
            if (t === "shell" && !hasShell) return null;
            if (t === "desktop" && !hasDesktop) return null;
            return (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  setTab(t);
                }}
                className={`px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${
                  tab === t
                    ? "border-blue-500/50 text-blue-400"
                    : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {t}
              </button>
            );
          })}
          {isActive && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await stopHypeshipAgent(agentId);
                } catch {}
              }}
              className="text-[10px] text-zinc-600 hover:text-red-400 font-mono px-1.5 py-0.5 border border-zinc-800 hover:border-red-900/50 transition-colors ml-1"
            >
              stop
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono ml-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden min-h-0">
        {tab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto min-h-0">
              {error && (
                <div className="px-3 py-2">
                  <p className="text-[10px] text-red-400/70 font-mono">
                    {error.message}
                  </p>
                </div>
              )}
              {!error && turns.length === 0 && !streamingText && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {isActive ? "waiting for conversation..." : "no messages"}
                  </p>
                </div>
              )}
              <div className="divide-y divide-zinc-800/30">
                {turns.map((turn, i) => (
                  <ConversationBubble key={i} turn={turn} />
                ))}
              </div>
              {streamingText && (
                <div className="px-3 py-2">
                  <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingText}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Follow-up input */}
            <div className="shrink-0 border-t border-zinc-800 px-2 py-1.5 flex gap-1 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isActive ? "send a follow-up..." : "send a message..."
                }
                rows={1}
                className="flex-1 bg-zinc-900 border border-zinc-800 px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="px-2 py-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 disabled:opacity-40 transition-colors"
              >
                {sending ? "..." : "↵"}
              </button>
            </div>
          </div>
        )}

        {tab === "shell" &&
          (hasShell ? (
            <TerminalView wsUrl={worker!.shell_ws_url!} />
          ) : (
            <NoConnectionView label="shell" />
          ))}

        {tab === "desktop" &&
          (hasDesktop ? (
            <DesktopView desktopUrl={worker!.desktop_url!} />
          ) : (
            <NoConnectionView label="desktop" />
          ))}
      </div>
    </div>
  );
}
