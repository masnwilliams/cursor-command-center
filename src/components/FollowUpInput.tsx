"use client";

import { useState, forwardRef, useCallback } from "react";
import { getDraft, setDraft } from "@/lib/storage";

interface FollowUpInputProps {
  agentId: string;
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export const FollowUpInput = forwardRef<HTMLTextAreaElement, FollowUpInputProps>(
  function FollowUpInput({ agentId, onSend, disabled }, ref) {
    const [text, setText] = useState(() => getDraft(agentId));
    const [sending, setSending] = useState(false);

    const updateText = useCallback(
      (val: string) => {
        setText(val);
        setDraft(agentId, val);
      },
      [agentId],
    );

    async function handleSend() {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      try {
        await onSend(trimmed);
        updateText("");
      } finally {
        setSending(false);
      }
    }

    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-600 select-none shrink-0 font-mono">
          {">"}
        </span>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => updateText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={sending ? "sending..." : "follow up..."}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 outline-none disabled:opacity-40 min-w-0 resize-none px-2 py-1 font-mono focus:border-zinc-600"
        />
      </div>
    );
  }
);
