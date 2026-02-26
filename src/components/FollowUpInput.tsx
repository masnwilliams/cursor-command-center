"use client";

import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { getDraft, setDraft } from "@/lib/storage";
import type { ImageAttachment } from "@/lib/images";
import { ImageAttachments } from "./ImageAttachments";

interface FollowUpInputProps {
  agentId: string;
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  images: ImageAttachment[];
  onRemoveImage: (id: string) => void;
  onAddFiles: (files: FileList) => void;
}

const MAX_ROWS = 10;

export const FollowUpInput = forwardRef<HTMLTextAreaElement, FollowUpInputProps>(
  function FollowUpInput(
    { agentId, onSend, disabled, images, onRemoveImage, onAddFiles },
    ref,
  ) {
    const [text, setText] = useState(() => getDraft(agentId));
    const [sending, setSending] = useState(false);
    const internalRef = useRef<HTMLTextAreaElement | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const setRefs = useCallback(
      (el: HTMLTextAreaElement | null) => {
        internalRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      },
      [ref],
    );

    function autoResize() {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
      const maxHeight = lineHeight * MAX_ROWS;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }

    useEffect(() => {
      autoResize();
    }, []);

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
        const el = internalRef.current;
        if (el) {
          el.style.height = "auto";
          el.style.overflowY = "hidden";
        }
      } finally {
        setSending(false);
      }
    }

    return (
      <div className="space-y-1">
        <ImageAttachments images={images} onRemove={onRemoveImage} />
        <div className="flex items-end gap-1.5">
          <span className="text-xs text-zinc-600 select-none shrink-0 font-mono py-1">
            {">"}
          </span>
          <textarea
            ref={setRefs}
            value={text}
            onChange={(e) => {
              updateText(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={sending ? "sending..." : "follow up..."}
            disabled={disabled || sending}
            rows={1}
            className="flex-1 bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 outline-none disabled:opacity-40 min-w-0 resize-none px-2 py-1 font-mono focus:border-zinc-600 overflow-hidden"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || sending}
            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-40 shrink-0 py-1"
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
        </div>
      </div>
    );
  },
);
