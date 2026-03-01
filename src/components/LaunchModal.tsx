"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRepositories, useBranches } from "@/lib/api";
import type { LaunchAgentRequest } from "@/lib/types";
import type { ImageAttachment } from "@/lib/images";
import { readFilesAsImages } from "@/lib/images";
import { ImageAttachments } from "./ImageAttachments";

interface LaunchModalProps {
  onClose: () => void;
  onLaunch: (request: LaunchAgentRequest, repoLabel: string, prompt: string) => void;
}

type Phase = "repo" | "branch" | "prompt";

export function LaunchModal({ onClose, onLaunch }: LaunchModalProps) {
  const { data: reposData } = useRepositories();

  const [phase, setPhase] = useState<Phase>("repo");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [rejections, setRejections] = useState<string[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: branchesData } = useBranches(repo || null);

  const repos = reposData?.repositories ?? [];
  const branches = branchesData?.branches ?? [];

  const repoLabel = useMemo(() => {
    if (!repo) return "";
    const r = repos.find((r) => r.repository === repo);
    return r ? `${r.owner}/${r.name}` : repo;
  }, [repo, repos]);

  const items = useMemo(() => {
    if (phase === "prompt") return [];
    const q = query.toLowerCase();
    if (phase === "repo") {
      return repos
        .map((r) => ({
          value: r.repository,
          label: `${r.owner}/${r.name}`,
        }))
        .filter((r) => r.label.toLowerCase().includes(q));
    }
    const branchItems = branches.map((b) => ({ value: b, label: b }));
    const filtered = branchItems.filter((b) =>
      b.label.toLowerCase().includes(q),
    );
    if (query && !filtered.some((b) => b.value === query)) {
      filtered.unshift({ value: query, label: query });
    }
    return filtered;
  }, [phase, repos, branches, query]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, phase]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase]);

  function scrollToIdx(idx: number) {
    const els = listRef.current?.querySelectorAll("[data-item]");
    els?.[idx]?.scrollIntoView({ block: "nearest" });
  }

  function selectItem(value: string) {
    if (phase === "repo") {
      setRepo(value);
      setPhase("branch");
      setQuery("");
      return;
    }
    if (phase === "branch") {
      setBranch(value);
      setPhase("prompt");
      setQuery("");
      return;
    }
  }

  function doLaunch(promptText: string) {
    if (!repo) return;
    const text =
      promptText.trim() ||
      "Stand by. I'll send instructions in a follow-up message.";
    const imgs =
      images.length > 0
        ? images.map((img) => ({
            data: img.data,
            dimension: img.dimension,
          }))
        : undefined;
    onLaunch(
      {
        prompt: { text, images: imgs },
        model: "claude-4.6-opus-high-thinking",
        source: { repository: repo, ref: branch || undefined },
        target: {},
      },
      repoLabel,
      text,
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      if (phase === "prompt") {
        setPhase("branch");
        setBranch("");
        setQuery("");
        return;
      }
      if (phase === "branch") {
        setPhase("repo");
        setRepo("");
        setQuery("");
        return;
      }
      onClose();
      return;
    }
    if (phase === "prompt") {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doLaunch(query);
        return;
      }
      if (e.key === "Backspace" && !query) {
        setPhase("branch");
        setBranch("");
        return;
      }
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (phase === "branch") {
        const selected = items[highlightIdx]?.value || "";
        setBranch(selected);
        doLaunch("");
      } else if (repo) {
        doLaunch("");
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (items[highlightIdx]) selectItem(items[highlightIdx].value);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(highlightIdx + 1, items.length - 1);
      setHighlightIdx(next);
      scrollToIdx(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(highlightIdx - 1, 0);
      setHighlightIdx(next);
      scrollToIdx(next);
      return;
    }
    if (e.key === "Backspace" && !query) {
      if (phase === "branch") {
        setPhase("repo");
        setRepo("");
      }
      return;
    }
  }

  const addImages = useCallback(async (files: FileList | File[]) => {
    const { images: newImages, rejected } = await readFilesAsImages(files);
    if (newImages.length) setImages((prev) => [...prev, ...newImages]);
    if (rejected.length) {
      setRejections(rejected);
      setTimeout(() => setRejections([]), 4000);
    }
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

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

  const loading =
    phase === "repo"
      ? !repos.length
      : phase === "branch"
        ? !!repo && !branchesData
        : false;

  const showList = phase !== "prompt";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full max-w-md border bg-zinc-950 relative ${
          dragOver ? "border-blue-500/50" : "border-zinc-800"
        }`}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 border-2 border-dashed border-blue-500/50 bg-blue-500/5 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-blue-400 font-mono">
              drop images
            </span>
          </div>
        )}

        {/* Input */}
        <div
          className={`flex items-center px-3 py-2 gap-2 ${showList ? "border-b border-zinc-800" : ""}`}
        >
          {(phase === "branch" || phase === "prompt") && (
            <span className="text-[10px] text-blue-400 font-mono shrink-0 bg-blue-500/10 px-1.5 py-0.5">
              {repoLabel}
            </span>
          )}
          {phase === "prompt" && branch && (
            <span className="text-[10px] text-green-400 font-mono shrink-0 bg-green-500/10 px-1.5 py-0.5">
              {branch}
            </span>
          )}
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              phase === "repo"
                ? "search repos..."
                : phase === "branch"
                  ? "search branches..."
                  : "what should the agent do?"
            }
            autoFocus
            rows={phase === "prompt" ? 3 : 1}
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono disabled:opacity-40 min-w-0 resize-none"
          />
          {phase === "prompt" && (
            <>
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
                className="text-zinc-600 hover:text-zinc-300 shrink-0"
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
              <span className="text-[10px] text-zinc-700 font-mono shrink-0">
                ↵
              </span>
            </>
          )}
          {phase !== "prompt" && (
            <span className="text-[10px] text-zinc-700 font-mono shrink-0">
              ⌘↵
            </span>
          )}
        </div>

        {/* Images (prompt phase) */}
        {phase === "prompt" && images.length > 0 && (
          <div className="px-3 py-1.5 border-b border-zinc-800">
            <ImageAttachments images={images} onRemove={removeImage} />
          </div>
        )}

        {/* List */}
        {showList && (
          <div ref={listRef} className="max-h-[240px] overflow-y-auto">
            {loading && (
              <div className="px-3 py-3 text-[10px] text-zinc-600 font-mono">
                loading...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-3 py-3 text-[10px] text-zinc-600 font-mono">
                {phase === "repo" ? "no repos found" : "no branches found"}
              </div>
            )}
            {items.map((item, idx) => (
              <button
                data-item
                key={item.value}
                onClick={() => selectItem(item.value)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                  idx === highlightIdx
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {rejections.length > 0 && (
          <div className="border-t border-zinc-800 px-3 py-2 space-y-0.5">
            {rejections.map((msg, i) => (
              <p
                key={i}
                className="text-[10px] text-red-300 font-mono truncate"
              >
                {msg}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
