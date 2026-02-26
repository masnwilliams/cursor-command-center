"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useConversation, sendFollowUp, stopAgent } from "@/lib/api";
import type { Agent, ConversationResponse } from "@/lib/types";
import type { ImageAttachment } from "@/lib/images";
import { readFilesAsImages } from "@/lib/images";
import { StatusBadge } from "./StatusBadge";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FollowUpInput } from "./FollowUpInput";

interface PaneProps {
  agent: Agent;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  conversation?: ConversationResponse;
}

function repoShort(agent: Agent): string {
  const url = agent.source.repository ?? "";
  return url.replace(/^(https?:\/\/)?github\.com\//, "");
}

export function Pane({ agent, focused, onFocus, onClose, conversation }: PaneProps) {
  const { data: fetchedConvo } = useConversation(conversation ? null : agent.id);
  const convo = conversation ?? fetchedConvo;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isActive = agent.status === "RUNNING" || agent.status === "CREATING";

  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const addImages = useCallback(async (files: FileList | File[]) => {
    const newImages = await readFilesAsImages(files);
    if (newImages.length) setImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convo?.messages?.length]);

  useEffect(() => {
    if (!focused) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement === inputRef.current) return;
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused]);

  async function handleFollowUp(text: string) {
    const imgs =
      images.length > 0
        ? images.map((img) => ({
            data: img.data,
            dimension: img.dimension,
          }))
        : undefined;
    setImages([]);
    await sendFollowUp(agent.id, { prompt: { text, images: imgs } });
  }

  async function handleStop() {
    await stopAgent(agent.id);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      await addImages(e.dataTransfer.files);
    }
  }

  return (
    <div
      onClick={onFocus}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-w-0 min-h-0 border-r border-b border-zinc-800 relative ${
        focused ? "ring-1 ring-inset ring-blue-500/60" : ""
      }`}
    >
      {dragOver && (
        <div className="absolute inset-0 z-10 border-2 border-dashed border-blue-500/50 bg-blue-500/5 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-blue-400 font-mono">drop images</span>
        </div>
      )}

      {/* Info bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1 shrink-0 min-h-0">
        <StatusBadge status={agent.status} />
        <span className="text-xs text-zinc-300 truncate font-medium flex-1 min-w-0">
          {agent.name || agent.id}
        </span>
        <span className="text-[10px] text-zinc-600 truncate hidden sm:block max-w-[120px]">
          {repoShort(agent)}
        </span>
        {agent.target.branchName && (
          <span className="text-[10px] text-zinc-600 truncate hidden sm:block max-w-[140px] font-mono leading-none">
            {agent.target.branchName}
          </span>
        )}
        {agent.target.prUrl && (
          <a
            href={agent.target.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-zinc-500 hover:text-blue-400 shrink-0"
          >
            PR
          </a>
        )}
        {agent.target.url && (
          <a
            href={agent.target.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-zinc-500 hover:text-blue-400 shrink-0"
          >
            ↗
          </a>
        )}
        {isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStop();
            }}
            className="text-[10px] text-amber-500 hover:text-amber-300 shrink-0"
          >
            stop
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-zinc-600 hover:text-zinc-300 shrink-0"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      >
        {convo?.messages?.length ? (
          <div className="divide-y divide-zinc-900">
            {convo.messages.map((msg) => (
              <div
                key={msg.id}
                className={`px-2 py-1.5 text-xs leading-relaxed ${
                  msg.type === "user_message"
                    ? "bg-blue-950/20 text-blue-200"
                    : "text-zinc-300"
                }`}
              >
                <span className="text-[10px] text-zinc-600 mr-1.5 select-none">
                  {msg.type === "user_message" ? ">" : "$"}
                </span>
                {msg.type === "assistant_message" ? (
                  <span className="prose-pane inline">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                  </span>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 px-2 py-3">
            {agent.status === "CREATING" ? "starting..." : "no messages"}
          </p>
        )}
      </div>

      {/* Follow-up */}
      <div className="shrink-0 border-t border-zinc-800 px-2 py-2">
        <FollowUpInput
          ref={inputRef}
          agentId={agent.id}
          onSend={handleFollowUp}
          disabled={agent.status === "CREATING"}
          images={images}
          onRemoveImage={removeImage}
        />
      </div>
    </div>
  );
}
