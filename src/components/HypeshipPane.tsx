"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useHypeshipWorker,
  useHypeshipConversation,
  sendHypeshipMessage,
} from "@/lib/api";
import type { HypeshipWorkerState } from "@/lib/types";

const WORKER_STATE_COLORS: Record<HypeshipWorkerState, string> = {
  launching: "bg-amber-400",
  working: "bg-blue-400",
  archived: "bg-zinc-400",
  gone: "bg-red-400",
};

function WorkerStateDot({ state }: { state: HypeshipWorkerState }) {
  const color = WORKER_STATE_COLORS[state] ?? "bg-zinc-400";
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

type Tab = "conversation" | "desktop" | "terminal";

function buildDesktopUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("password", "changeme");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export default function HypeshipPane({
  agentId,
  onClose,
  focused,
  onFocus,
}: {
  agentId: string;
  onClose: () => void;
  focused: boolean;
  onFocus: () => void;
}) {
  const { data: agentData } = useHypeshipWorker(agentId);
  const agent = agentData?.worker;
  const isActive =
    agent?.state === "launching" || agent?.state === "working";

  const { data: convData } = useHypeshipConversation(
    agentId,
    isActive ?? false,
  );
  const conversation = convData?.conversation ?? [];

  const [tab, setTab] = useState<Tab>("conversation");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length]);

  useEffect(() => {
    if (agent?.desktop_url && tab === "conversation" && !conversation.length) {
      setTab("desktop");
    }
  }, [agent?.desktop_url]);

  const handleSend = useCallback(async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendHypeshipMessage(agentId, text);
      setMessage("");
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [agentId, message, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const topic = agent?.topic || agentId.slice(0, 12);

  return (
    <div
      className={`flex flex-col h-full border border-zinc-800 bg-zinc-950 ${focused ? "ring-1 ring-blue-500/30" : ""}`}
      onClick={onFocus}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {agent && <WorkerStateDot state={agent.state} />}
          <span className="text-[10px] text-zinc-300 font-mono truncate">
            {topic}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Tab buttons */}
          <button
            onClick={() => setTab("conversation")}
            className={`px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${tab === "conversation" ? "border-blue-500/50 text-blue-400" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}
          >
            chat
          </button>
          {agent?.desktop_url && (
            <button
              onClick={() => setTab("desktop")}
              className={`px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${tab === "desktop" ? "border-blue-500/50 text-blue-400" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}
            >
              desktop
            </button>
          )}
          {agent?.shell_ws_url && (
            <button
              onClick={() => setTab("terminal")}
              className={`px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${tab === "terminal" ? "border-blue-500/50 text-blue-400" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}
            >
              shell
            </button>
          )}
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono ml-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {tab === "conversation" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {conversation.length === 0 && (
                <div className="text-[10px] text-zinc-600 font-mono text-center py-8">
                  {isActive
                    ? "agent is working..."
                    : "no conversation yet"}
                </div>
              )}
              {conversation.map((turn, i) => (
                <div
                  key={i}
                  className={`text-[11px] font-mono ${turn.role === "user" ? "text-blue-300 bg-blue-500/5 border-l-2 border-blue-500/30 pl-2 py-1" : "text-zinc-300 py-1"}`}
                >
                  <span className="text-[9px] text-zinc-600 block mb-0.5">
                    {turn.role}
                  </span>
                  <div className="whitespace-pre-wrap break-words">
                    {turn.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            {isActive && (
              <div className="border-t border-zinc-800 px-2 py-1.5 shrink-0">
                <div className="flex gap-1">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="send a message..."
                    rows={1}
                    className="flex-1 bg-zinc-900 border border-zinc-800 px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="px-2 py-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 disabled:opacity-40 transition-colors"
                  >
                    ↵
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "desktop" && agent?.desktop_url && (
          <div className="h-full flex flex-col">
            <iframe
              src={buildDesktopUrl(agent.desktop_url)}
              className="flex-1 w-full bg-black"
              allow="clipboard-read; clipboard-write"
            />
            <div className="px-2 py-1 border-t border-zinc-800 flex items-center justify-between shrink-0">
              <span className="text-[9px] text-zinc-600 font-mono">
                KasmVNC
              </span>
              <a
                href={buildDesktopUrl(agent.desktop_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-blue-400 hover:text-blue-300 font-mono"
              >
                open in tab ↗
              </a>
            </div>
          </div>
        )}

        {tab === "terminal" && agent?.shell_ws_url && (
          <TerminalView wsUrl={agent.shell_ws_url} />
        )}
      </div>
    </div>
  );
}

function TerminalView({ wsUrl }: { wsUrl: string }) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);

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

      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch {}
      });
      resizeObserver.observe(termRef.current!);

      xtermRef.current = terminal;

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

  return (
    <div
      ref={termRef}
      className="h-full w-full bg-[#09090b] p-1"
    />
  );
}
