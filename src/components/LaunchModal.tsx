"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useModels,
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

export function LaunchModal({ onClose, onLaunched }: LaunchModalProps) {
  const { data: modelsData } = useModels();
  const { data: reposData, refresh: refreshRepos } = useRepositories();

  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-4.6-opus-high-thinking");
  const [branchName, setBranchName] = useState("");
  const [autoCreatePr, setAutoCreatePr] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [rejections, setRejections] = useState<string[]>([]);

  const branchSelectRef = useRef<SearchSelectHandle>(null);
  const modelSelectRef = useRef<SearchSelectHandle>(null);
  const branchNameRef = useRef<HTMLInputElement>(null);

  const prevRepo = useRef(repo);
  const prevRef = useRef(ref);
  const prevModel = useRef(model);

  useEffect(() => {
    if (repo && !prevRepo.current) {
      setTimeout(() => branchSelectRef.current?.open(), 80);
    }
    prevRepo.current = repo;
  }, [repo]);

  useEffect(() => {
    if (ref && !prevRef.current) {
      setTimeout(() => branchNameRef.current?.focus(), 80);
    }
    prevRef.current = ref;
  }, [ref]);

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
          text: prompt.trim() || "Follow instructions in the repository.",
          images: imgs,
        },
        model: model || undefined,
        source: { repository: repo, ref: ref || undefined },
        target: {
          autoCreatePr: autoCreatePr || undefined,
          branchName: branchName.trim() || undefined,
        },
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
  const models = modelsData?.models ?? [];
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
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
          >
            [esc]
          </button>
        </div>

        <div className="px-3 py-3 space-y-3 max-h-[70dvh] overflow-y-auto">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-zinc-500 font-mono">
                repository
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
              value={repo}
              onChange={setRepo}
              options={repos.map((r) => ({
                value: r.repository,
                label: `${r.owner}/${r.name}`,
              }))}
              placeholder="search repos..."
              loading={!repos.length}
              autoOpen
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">
              branch/ref
            </label>
            <SearchSelect
              ref={branchSelectRef}
              value={ref}
              onChange={setRef}
              options={branches.map((b) => ({ value: b, label: b }))}
              placeholder="main"
              loading={!!repo && !branchesData}
              allowCustom
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">
              branch name
            </label>
            <input
              ref={branchNameRef}
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="auto"
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">model</label>
            <SearchSelect
              ref={modelSelectRef}
              value={model}
              onChange={setModel}
              options={[
                { value: "", label: "auto" },
                ...models.map((m) => ({ value: m, label: m })),
              ]}
              placeholder="auto"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreatePr}
              onChange={(e) => setAutoCreatePr(e.target.checked)}
              className="border-zinc-700 bg-zinc-900"
            />
            <span className="text-xs text-zinc-400 font-mono">
              auto-create pr
            </span>
          </label>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-mono">
              message <span className="text-zinc-700">optional</span>
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="or send in pane after launch"
              className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            />
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
          </div>

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
