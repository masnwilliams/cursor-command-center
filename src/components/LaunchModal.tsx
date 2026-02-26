"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useRepositories,
  useBranches,
  launchAgent,
} from "@/lib/api";
import type { Agent } from "@/lib/types";
import type { ImageAttachment } from "@/lib/images";
import { readFilesAsImages } from "@/lib/images";
import { SearchSelect } from "./SearchSelect";
import type { SearchSelectHandle } from "./SearchSelect";
import { ImageAttachments } from "./ImageAttachments";

interface LaunchModalProps {
  onClose: () => void;
  onLaunched: (agent: Agent) => void;
}

type Step = "repo" | "branch" | "ready";

export function LaunchModal({ onClose, onLaunched }: LaunchModalProps) {
  const { data: reposData, refresh: refreshRepos } = useRepositories();

  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [rejections, setRejections] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("repo");

  const repoSelectRef = useRef<SearchSelectHandle>(null);
  const branchSelectRef = useRef<SearchSelectHandle>(null);

  function advanceTo(target: Step) {
    setStep(target);
    setTimeout(() => {
      if (target === "repo") repoSelectRef.current?.open();
      else if (target === "branch") branchSelectRef.current?.open();
    }, 80);
  }

  function handleRepoChange(val: string) {
    setRepo(val);
    if (val) advanceTo("branch");
  }

  function handleBranchChange(val: string) {
    setRef(val);
    if (val) setStep("ready");
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

  async function handleLaunch() {
    if (!repo) {
      setError("select a repository");
      return;
    }

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
          text: "Start.",
          images: imgs,
        },
        model: "claude-4.6-opus-high-thinking",
        source: { repository: repo, ref: ref || undefined },
        target: {},
      });
      onLaunched(agent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "launch failed");
      setLaunching(false);
    }
  }

  const launchRef = useRef(handleLaunch);
  launchRef.current = handleLaunch;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        launchRef.current();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { data: branchesData } = useBranches(repo || null);

  const repos = reposData?.repositories ?? [];
  const branches = branchesData?.branches ?? [];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full max-w-lg border bg-zinc-950 overflow-hidden relative ${
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

        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">launch agent</span>
          <span className="text-[10px] text-zinc-600 font-mono">
            tab next · ⇧tab back · ⌘↵ launch
          </span>
        </div>

        <div className="px-3 py-3 space-y-2.5">
          {/* 1. Repository */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                className={`text-[10px] font-mono ${step === "repo" ? "text-blue-400" : repo ? "text-zinc-400" : "text-zinc-600"}`}
              >
                1. repository
                {repo && <span className="text-zinc-600 ml-1">✓</span>}
              </label>
              <button
                type="button"
                onClick={refreshRepos}
                className="text-[10px] text-zinc-600 hover:text-zinc-300 font-mono"
              >
                refresh
              </button>
            </div>
            <SearchSelect
              ref={repoSelectRef}
              value={repo}
              onChange={handleRepoChange}
              onSkip={() => advanceTo("branch")}
              onBack={() => {}}
              options={repos.map((r) => ({
                value: r.repository,
                label: `${r.owner}/${r.name}`,
              }))}
              placeholder="search repos..."
              loading={!repos.length}
              autoOpen
            />
          </div>

          {/* 2. Branch */}
          <div className="space-y-1">
            <label
              className={`text-[10px] font-mono ${step === "branch" ? "text-blue-400" : ref ? "text-zinc-400" : "text-zinc-600"}`}
            >
              2. branch
              {ref && <span className="text-zinc-600 ml-1">✓</span>}
            </label>
            <SearchSelect
              ref={branchSelectRef}
              value={ref}
              onChange={handleBranchChange}
              onSkip={() => setStep("ready")}
              onBack={() => advanceTo("repo")}
              options={branches.map((b) => ({ value: b, label: b }))}
              placeholder="main"
              loading={!!repo && !branchesData}
              allowCustom
            />
          </div>

          {/* Images */}
          <ImageAttachments images={images} onRemove={removeImage} />
          {rejections.length > 0 && (
            <div className="bg-red-950/90 border border-red-800 px-2 py-1.5 space-y-0.5">
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

          {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 font-mono transition-colors"
          >
            cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="flex-1 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-40 font-mono transition-colors"
          >
            {launching ? "launching..." : "launch ⌘↵"}
          </button>
        </div>
      </div>
    </div>
  );
}
