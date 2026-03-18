"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useHypeshipAgent,
  useHypeshipWorker,
  sendHypeshipFollowUp,
  stopHypeshipAgent,
} from "@/lib/api";
import { getHypeshipApiUrl, getHypeshipJwt } from "@/lib/storage";
import {
  GroupedConversation,
  ArtifactsBar,
  timeAgo,
  groupTurnsByWorker,
} from "@/components/HypeshipConversation";
import TerminalView from "@/components/TerminalView";
import type {
  HypeshipAgentStatus,
  HypeshipArtifact,
} from "@/lib/types";

type PaneTab = "chat" | "shell" | "desktop" | "raw";

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

function buildDesktopUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("password", "changeme");
    return url.toString();
  } catch {
    return rawUrl;
  }
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
  isMobile = false,
}: {
  agentId: string;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const { data, error } = useHypeshipAgent(agentId);
  const agent = data?.agent;
  const turns = agent?.messages ?? [];
  const status: HypeshipAgentStatus =
    (agent as any)?.status ?? "creating";

  useEffect(() => {
    if (turns.length === 0) return;
    const compact = turns.map((t, i) => ({
      i,
      role: t.role,
      source: t.source,
      worker_id: t.worker_id,
      status: t.status,
      tool_use_id: t.tool_use_id,
      parent_tool_use_id: t.parent_tool_use_id,
      content: t.content?.slice(0, 80),
    }));
    console.log(`[hypeship-debug] ${agentId} raw turns (${turns.length}):`, compact);
    console.log(`[hypeship-debug] ${agentId} grouped:`, groupTurnsByWorker(turns));
  }, [turns.length, agentId]);

  const [tab, setTab] = useState<PaneTab>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const streamBuf = useRef("");
  const rafRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const flushStream = useCallback(() => {
    rafRef.current = 0;
    setStreamingText(streamBuf.current);
  }, []);

  const appendStream = useCallback(
    (text: string) => {
      streamBuf.current += text;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushStream);
      }
    },
    [flushStream],
  );

  const clearStream = useCallback(() => {
    streamBuf.current = "";
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setStreamingText("");
  }, []);

  // Auto-focus input when focused pane receives keyboard input (desktop only — on mobile this would pop up the keyboard)
  useEffect(() => {
    if (!focused || isMobile) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      )
        return;
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused, isMobile]);

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
    if (tab === "shell" && !hasShell) setTab("chat");
    if (tab === "desktop" && !hasDesktop) setTab("chat");
  }, [tab, hasShell, hasDesktop]);

  const prevTurnCount = useRef(turns.length);
  useEffect(() => {
    if (tab !== "chat") return;
    if (turns.length > prevTurnCount.current || streamingText) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTurnCount.current = turns.length;
  }, [turns.length, streamingText, tab]);

  useEffect(() => {
    if (status === "finished" || status === "error") {
      clearStream();
    }
  }, [status, clearStream]);

  useEffect(() => {
    if (status !== "running") return;

    const apiUrl = getHypeshipApiUrl();
    const jwt = getHypeshipJwt();
    if (!apiUrl || !jwt) return;

    let closed = false;
    const abort = new AbortController();
    const streamUrl = `/api/hypeship/agents/${agentId}/stream?jwt=${encodeURIComponent(jwt)}&url=${encodeURIComponent(apiUrl)}`;

    let idleTimer: ReturnType<typeof setTimeout>;
    function resetIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!closed) abort.abort();
      }, 60_000);
    }

    async function connect() {
      try {
        resetIdle();
        const res = await fetch(streamUrl, {
          headers: { Accept: "text/event-stream" },
          signal: abort.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          resetIdle();
          buf += decoder.decode(value, { stream: true });

          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === "chunk" && ev.text) {
                appendStream(ev.text);
              }
              if (ev.type === "done" || ev.type === "stopped") {
                clearStream();
                closed = true;
                return;
              }
            } catch {}
          }
        }
      } catch {
        if (!closed) clearStream();
      }
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(idleTimer);
      abort.abort();
      clearStream();
    };
  }, [agentId, status, appendStream, clearStream]);

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

  const isActive = status === "creating" || status === "running";
  const preview =
    turns.find((t) => t.role === "user")?.content?.slice(0, 60) ||
    agentId.slice(0, 12);

  const artifacts: HypeshipArtifact[] = agent?.artifacts ?? [];
  const prArtifact = artifacts.find((a) => a.type === "pull_request" && a.pr_url);
  const branchArtifact = artifacts.find((a) => a.branch);
  const prUrl = prArtifact?.pr_url;
  const branchName = branchArtifact?.branch;
  const repoName = (prArtifact?.repo || branchArtifact?.repo || "")
    .replace(/^https?:\/\/github\.com\//, "");

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 min-h-0 bg-zinc-950 ${isMobile ? "" : "border-r border-b border-zinc-800"} ${focused && !isMobile ? "ring-1 ring-inset ring-blue-500/60" : ""}`}
      onClick={onFocus}
    >
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className={`flex items-center justify-between ${isMobile ? "px-3 py-2" : "px-2 py-1"}`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StatusDot status={status} />
            <span className={`${isMobile ? "text-sm" : "text-[10px]"} text-zinc-300 font-mono truncate`}>
              {preview}
            </span>
            {!isMobile && (
              <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                {agent?.source}
              </span>
            )}
            {!isMobile && repoName && (
              <span className="text-[10px] text-zinc-600 truncate max-w-[120px] font-mono">
                {repoName}
              </span>
            )}
            {!isMobile && branchName && (
              <span className="text-[10px] text-zinc-600 truncate max-w-[140px] font-mono leading-none">
                {branchName}
              </span>
            )}
            {!isMobile && prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-green-400 hover:brightness-125 shrink-0"
              >
                PR
              </a>
            )}
          </div>
        <div className={`flex items-center ${isMobile ? "gap-1" : "gap-0.5"} shrink-0`}>
          {(["chat", "shell", "desktop", "raw"] as const).map((t) => {
            if (t === "shell" && !hasShell) return null;
            if (t === "desktop" && !hasDesktop) return null;
            return (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  setTab(t);
                }}
                className={`${isMobile ? "px-2.5 py-1 text-[11px]" : "px-1.5 py-0.5 text-[9px]"} font-mono border transition-colors ${
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
              className={`text-zinc-600 hover:text-red-400 font-mono border border-zinc-800 hover:border-red-900/50 transition-colors ml-1 ${isMobile ? "text-[11px] px-2 py-1" : "text-[10px] px-1.5 py-0.5"}`}
            >
              stop
            </button>
          )}
          {!isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono ml-1"
            >
              ×
            </button>
          )}
        </div>
        </div>
        {/* Mobile secondary info row */}
        {isMobile && (agent?.source || repoName || branchName || prUrl) && (
          <div className="flex items-center gap-1.5 px-3 pb-1.5 -mt-0.5 min-w-0">
            {agent?.source && (
              <span className="text-[10px] text-zinc-600 truncate min-w-0">
                {agent.source}
              </span>
            )}
            {repoName && (
              <>
                {agent?.source && <span className="text-[10px] text-zinc-700 shrink-0">·</span>}
                <span className="text-[10px] text-zinc-600 truncate min-w-0">{repoName}</span>
              </>
            )}
            {branchName && (
              <>
                <span className="text-[10px] text-zinc-700 shrink-0">·</span>
                <span className="text-[10px] text-zinc-600 truncate font-mono leading-none min-w-0">{branchName}</span>
              </>
            )}
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-green-400 hover:brightness-125 shrink-0"
              >
                PR
              </a>
            )}
          </div>
        )}
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
              <GroupedConversation turns={turns} />
              {streamingText && (
                <div className="px-3 py-2">
                  <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none [overflow-wrap:anywhere]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingText}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-zinc-800">
              <ArtifactsBar artifacts={agent?.artifacts} />
              {(agent?.queued_followups?.length ?? 0) > 0 && (
                <div className="px-3 py-1.5 border-b border-zinc-800/50">
                  {agent!.queued_followups!.map((q) => (
                    <div key={q.id} className="flex items-start gap-2 py-0.5 opacity-50">
                      <span className="text-[10px] font-mono text-blue-400/70">&gt;</span>
                      <span className="text-[10px] text-zinc-500 font-mono truncate">{q.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`shrink-0 border-t border-zinc-800 flex gap-1.5 items-end ${isMobile ? "px-3 py-2" : "px-2 py-1.5"}`}>
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
                placeholder={
                  isActive ? "send a follow-up..." : "send a message..."
                }
                rows={1}
                className={`flex-1 bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none ${isMobile ? "px-3 py-2 text-sm" : "px-2 py-1 text-[11px]"}`}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className={`font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 disabled:opacity-40 transition-colors ${isMobile ? "px-3 py-2 text-sm" : "px-2 py-1 text-[10px]"}`}
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

        {tab === "raw" && (
          <div className="h-full overflow-y-auto p-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-zinc-500 font-mono">{turns.length} turns</span>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(turns, null, 2))}
                className="text-[9px] text-zinc-600 hover:text-zinc-400 font-mono border border-zinc-800 px-1.5 py-0.5"
              >
                copy json
              </button>
            </div>
            <pre className="text-[9px] text-zinc-400 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(turns.map((t, i) => ({
                _i: i,
                role: t.role,
                source: t.source,
                worker_id: t.worker_id,
                status: t.status,
                tool_use_id: t.tool_use_id,
                parent_tool_use_id: t.parent_tool_use_id,
                content: t.content?.slice(0, 120) + (t.content && t.content.length > 120 ? "..." : ""),
                detail: t.detail ? "..." : undefined,
                timestamp: t.timestamp,
              })), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
