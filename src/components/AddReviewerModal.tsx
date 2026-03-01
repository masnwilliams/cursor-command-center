"use client";

import { useState, useEffect } from "react";
import { addPrReviewers } from "@/lib/api";

interface AddReviewerModalProps {
  prUrl: string;
  agentName: string;
  onClose: () => void;
}

export function AddReviewerModal({
  prUrl,
  agentName,
  onClose,
}: AddReviewerModalProps) {
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const prShort = prUrl.replace(/^https?:\/\/github\.com\//, "");

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

  async function handleAdd() {
    const trimmed = username.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      await addPrReviewers(prUrl, [trimmed]);
      setSuccess(`added ${trimmed}`);
      setUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-zinc-800 bg-zinc-950"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">
            add reviewer
          </span>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
          >
            [esc]
          </button>
        </div>

        <div className="px-3 py-3 space-y-2">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono">pr</p>
            <p className="text-xs text-zinc-400 font-mono truncate">
              {prShort}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono">
              github username
            </p>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="username, hit enter"
              autoFocus
              className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
            />
          </div>

          {error && (
            <p className="text-[10px] text-red-400 font-mono">{error}</p>
          )}
          {success && (
            <p className="text-[10px] text-green-400 font-mono">{success}</p>
          )}
        </div>
      </div>
    </div>
  );
}
