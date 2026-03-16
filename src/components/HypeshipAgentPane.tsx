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
} from "@/components/HypeshipConversation";
import { ImageAttachments } from "@/components/ImageAttachments";
import type { ImageAttachment } from "@/lib/images";
import { readFilesAsImages } from "@/lib/images";
import type {
  HypeshipAgentStatus,
  HypeshipArtifact,
} from "@/lib/types";

type PaneTab = "chat" | "shell" | "desktop";

const MAX_IMAGES = 5;

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

  const [tab, setTab] = useState<PaneTab>("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamChunks, setStreamChunks] = useState<string[]>([]);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback(async (files: FileList | File[]) => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageWarning(`Max ${MAX_IMAGES} images per message`);
      return;
    }
    const toProcess = Array.from(files).slice(0, remaining);
    if (toProcess.length < files.length) {
      setImageWarning(`Max ${MAX_IMAGES} images — only added ${toProcess.length}`);
    }
    const { images: newImages, rejected } = await readFilesAsImages(toProcess);
    if (rejected.length > 0) {
      setImageWarning(rejected[0]);
    }
    setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
  }, [images.length]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setImageWarning(null);
  }, []);

  // Clear warning after 3s
  useEffect(() => {
    if (!imageWarning) return;
    const t = setTimeout(() => setImageWarning(null), 3000);
    return () => clearTimeout(t);
  }, [imageWarning]);

  // Handle paste for images
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addImages]);

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
    if (turns.length > prevTurnCount.current || streamChunks.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTurnCount.current = turns.length;
  }, [turns.length, streamChunks.length, tab]);

  useEffect(() => {
    if (status === "finished" || status === "error") {
      setStreamChunks([]);
    }
  }, [status]);

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

    evtSource.onerror = () => {
      setStreamChunks([]);
    };

    return () => {
      evtSource.close();
      setStreamChunks([]);
    };
  }, [agentId]);

  const streamingText = status === "finished" || status === "error" ? "" : streamChunks.join("");

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const imgPayload = images.length > 0
        ? images.map((img) => ({ data: img.data, dimension: img.dimension }))
        : undefined;
      await sendHypeshipFollowUp(agentId, text, imgPayload);
      setInput("");
      setImages([]);
      setImageWarning(null);
    } catch {}
    setSending(false);
  }

  // Drag-and-drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      addImages(e.dataTransfer.files);
    }
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
          <div
            className="flex flex-col h-full relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {dragging && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 border-2 border-dashed border-blue-500/50 pointer-events-none">
                <div className="text-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="mx-auto text-blue-400 mb-2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <p className="text-[11px] text-blue-400 font-mono">drop images here</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">png, jpg, gif, webp — max 10MB each</p>
                </div>
              </div>
            )}

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
                  <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none">
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
            </div>

            {/* Image attachments + warning */}
            {(images.length > 0 || imageWarning) && (
              <div className={`shrink-0 border-t border-zinc-800 ${isMobile ? "px-3" : "px-2"}`}>
                <ImageAttachments images={images} onRemove={removeImage} />
                {imageWarning && (
                  <p className="text-[10px] text-amber-400/80 font-mono py-0.5">{imageWarning}</p>
                )}
              </div>
            )}

            {/* Input area */}
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
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addImages(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                className={`text-zinc-600 hover:text-zinc-300 disabled:opacity-40 shrink-0 ${isMobile ? "py-2" : "py-1"}`}
                title="attach images"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </button>
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
      </div>
    </div>
  );
}
