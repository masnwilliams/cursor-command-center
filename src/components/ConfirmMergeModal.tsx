"use client";

import { useState, useEffect, useRef } from "react";
import { mergePr } from "@/lib/api";

interface ConfirmMergeModalProps {
  prUrl: string;
  agentName: string;
  onClose: () => void;
  onMerged: () => void;
}

export function ConfirmMergeModal({
  prUrl,
  agentName,
  onClose,
  onMerged,
}: ConfirmMergeModalProps) {
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"squash" | "merge" | "rebase">(
    "squash",
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const prShort = prUrl.replace(/^https?:\/\/github\.com\//, "");

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleMerge() {
    if (merging) return;
    setMerging(true);
    setError(null);
    try {
      await mergePr(prUrl, method);
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "merge failed");
      setMerging(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleMerge();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md border border-zinc-800 bg-zinc-950 outline-none"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-red-950/30">
          <span className="text-xs text-red-400 font-mono">merge pr</span>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
          >
            [esc]
          </button>
        </div>

        <div className="px-3 py-3 space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono">agent</p>
            <p className="text-xs text-zinc-300 font-mono truncate">
              {agentName}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono">pr</p>
            <p className="text-xs text-zinc-300 font-mono truncate">
              {prShort}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono">method</p>
            <div className="flex gap-1">
              {(["squash", "merge", "rebase"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                    method === m
                      ? "border-zinc-500 text-zinc-200 bg-zinc-800"
                      : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[10px] text-red-400 font-mono">{error}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2">
          <button
            onClick={handleMerge}
            disabled={merging}
            className="w-full text-xs font-mono py-1.5 border border-red-800 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors disabled:opacity-40"
          >
            {merging ? "merging..." : "⌘↵ confirm merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
