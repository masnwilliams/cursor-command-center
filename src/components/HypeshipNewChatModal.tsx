"use client";

import { useState, useEffect, useRef } from "react";
import { sendHypeshipPrompt } from "@/lib/api";

interface HypeshipNewChatModalProps {
  onCreated: (agentId: string) => void;
  onClose: () => void;
}

export function HypeshipNewChatModal({
  onCreated,
  onClose,
}: HypeshipNewChatModalProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const resp = await sendHypeshipPrompt({ message: text });
      if (resp.agent_id) {
        onCreated(resp.agent_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to send");
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-zinc-800 bg-zinc-950 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">new chat</span>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
          >
            [esc]
          </button>
        </div>

        <div className="px-3 py-3 space-y-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="what do you want to build?"
            rows={4}
            className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono resize-none"
          />
          {error && (
            <p className="text-[10px] text-red-400/70 font-mono">{error}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-zinc-600 font-mono">
            ⌘↵ to send
          </span>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? "sending..." : "send"}
          </button>
        </div>
      </div>
    </div>
  );
}
