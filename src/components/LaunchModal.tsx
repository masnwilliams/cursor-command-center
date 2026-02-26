"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRepositories, useBranches, launchAgent } from "@/lib/api";
import type { Agent } from "@/lib/types";
import type { ImageAttachment } from "@/lib/images";
import { readFilesAsImages } from "@/lib/images";
import { ImageAttachments } from "./ImageAttachments";

interface LaunchModalProps {
  onClose: () => void;
  onLaunched: (agent: Agent) => void;
}

type Phase = "repo" | "branch";

export function LaunchModal({ onClose, onLaunched }: LaunchModalProps) {
  const { data: reposData } = useRepositories();

  const [phase, setPhase] = useState<Phase>("repo");
  const [repo, setRepo] = useState("");
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [rejections, setRejections] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: branchesData } = useBranches(repo || null);

  const repos = reposData?.repositories ?? [];
  const branches = branchesData?.branches ?? [];

  const repoLabel = useMemo(() => {
    if (!repo) return "";
    const r = repos.find((r) => r.repository === repo);
    return r ? `${r.owner}/${r.name}` : repo;
  }, [repo, repos]);

  const items = useMemo(() => {
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
    doLaunch(repo, value);
  }

  async function doLaunch(repoVal: string, branchVal?: string) {
    if (!repoVal) return;
    setLaunching(true);
    setError(null);
    try {
      const imgs =
        images.length > 0
          ? images.map((img) => ({
              data: img.data,
              dimension: img.dimension,
            }))
          : undefined;
      const agent = await launchAgent({
        prompt: {
          text: "Stand by. I'll send instructions in a follow-up message.",
          images: imgs,
        },
        model: "claude-4.6-opus-high-thinking",
        source: {
          repository: repoVal,
          ref: branchVal || undefined,
        },
        target: {},
      });
      onLaunched(agent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "launch failed");
      setLaunching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      if (phase === "branch") {
        setPhase("repo");
        setRepo("");
        setQuery("");
        return;
      }
      onClose();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (repo) doLaunch(repo);
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
    if (e.key === "Backspace" && !query && phase === "branch") {
      setPhase("repo");
      setRepo("");
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
    phase === "repo" ? !repos.length : !!repo && !branchesData;

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
        <div className="flex items-center border-b border-zinc-800 px-3 py-2 gap-2">
          {phase === "branch" && (
            <span className="text-[10px] text-blue-400 font-mono shrink-0 bg-blue-500/10 px-1.5 py-0.5">
              {repoLabel}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              launching
                ? "launching..."
                : phase === "repo"
                  ? "search repos..."
                  : "branch (enter = launch)"
            }
            disabled={launching}
            autoFocus
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono disabled:opacity-40 min-w-0"
          />
          <span className="text-[10px] text-zinc-700 font-mono shrink-0">
            ⌘↵
          </span>
        </div>

        {/* List / launching state */}
        {launching ? (
          <div className="px-3 py-4 text-xs text-zinc-500 font-mono text-center">
            launching...
          </div>
        ) : (
          <div
            ref={listRef}
            className="max-h-[240px] overflow-y-auto"
          >
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

        {/* Footer: images, errors, hints */}
        {(images.length > 0 || rejections.length > 0 || error) && (
          <div className="border-t border-zinc-800 px-3 py-2 space-y-1">
            <ImageAttachments images={images} onRemove={removeImage} />
            {rejections.length > 0 && (
              <div className="space-y-0.5">
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
            {error && (
              <p className="text-[10px] text-red-400 font-mono">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
