"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePrFiles } from "@/lib/api";
import type { PrFile } from "@/lib/types";
import { PatchDiff } from "@pierre/diffs/react";

const STATUS_LABEL: Record<string, string> = {
  added: "A",
  modified: "M",
  removed: "D",
  renamed: "R",
  copied: "C",
  changed: "M",
  unchanged: "·",
};

const STATUS_COLOR: Record<string, string> = {
  added: "text-green-400",
  modified: "text-amber-400",
  removed: "text-red-400",
  renamed: "text-blue-400",
  copied: "text-blue-400",
  changed: "text-amber-400",
  unchanged: "text-zinc-600",
};

function fileBasename(path: string): string {
  return path.split("/").pop() || path;
}

function fileDir(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/") + "/";
}

function FileLine({
  file,
  isOpen,
  highlighted,
  onToggle,
  onMouseEnter,
  setRef,
}: {
  file: PrFile;
  isOpen: boolean;
  highlighted: boolean;
  onToggle: () => void;
  onMouseEnter: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={setRef}>
      <button
        onClick={onToggle}
        onMouseEnter={onMouseEnter}
        className={`w-full flex items-center gap-2 px-3 py-0.5 text-left min-w-0 ${
          highlighted ? "bg-zinc-800/60" : "hover:bg-zinc-800/40"
        }`}
      >
        <span className="text-[10px] text-zinc-600 font-mono shrink-0">
          {isOpen ? "▾" : "▸"}
        </span>
        <span
          className={`text-[10px] font-mono w-3 shrink-0 ${STATUS_COLOR[file.status] || "text-zinc-500"}`}
        >
          {STATUS_LABEL[file.status] || "?"}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono truncate min-w-0">
          {fileDir(file.filename)}
          <span className={highlighted ? "text-zinc-200" : "text-zinc-400"}>
            {fileBasename(file.filename)}
          </span>
        </span>
        {file.status === "renamed" && file.previous_filename && (
          <span className="text-[10px] text-zinc-700 font-mono truncate">
            ← {fileBasename(file.previous_filename)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {file.additions > 0 && (
            <span className="text-[10px] text-green-500/80 font-mono">
              +{file.additions}
            </span>
          )}
          {file.deletions > 0 && (
            <span className="text-[10px] text-red-500/80 font-mono">
              -{file.deletions}
            </span>
          )}
        </span>
      </button>
      {isOpen && file.patch && (
        <div className="border-t border-zinc-800/40">
          <PatchDiff
            patch={file.patch}
            style={{
              "--diffs-font-size": "11px",
              "--diffs-line-height": "16px",
              "--diffs-font-family":
                "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
              "--diffs-gap-block": "2px",
              "--diffs-gap-inline": "4px",
            } as React.CSSProperties}
            options={{
              theme: "pierre-dark",
              themeType: "dark",
              overflow: "scroll",
              disableFileHeader: true,
              disableLineNumbers: false,
              diffIndicators: "bars",
            }}
          />
        </div>
      )}
      {isOpen && !file.patch && (
        <div className="px-6 py-2 text-[10px] text-zinc-600 font-mono border-t border-zinc-800/40">
          binary file or no diff available
        </div>
      )}
    </div>
  );
}

export default function HypeshipDiffPanel({ prUrl }: { prUrl: string }) {
  const { data, isLoading } = usePrFiles(prUrl);
  const files = data?.files;
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const fileCount = files?.length ?? 0;

  const toggleFile = useCallback((filename: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  useEffect(() => {
    if (files?.length) setSelectedIdx(0);
  }, [files?.length]);

  useEffect(() => {
    const el = itemRefs.current.get(selectedIdx);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  useEffect(() => {
    if (!fileCount) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, fileCount - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const f = files?.[selectedIdx];
        if (f && !openFiles.has(f.filename)) toggleFile(f.filename);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const f = files?.[selectedIdx];
        if (f && openFiles.has(f.filename)) toggleFile(f.filename);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (files?.[selectedIdx]) {
          toggleFile(files[selectedIdx].filename);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileCount, selectedIdx, files, openFiles, toggleFile]);

  const totalAdded = files?.reduce((s, f) => s + f.additions, 0) ?? 0;
  const totalRemoved = files?.reduce((s, f) => s + f.deletions, 0) ?? 0;

  return (
    <div ref={listRef} className="h-full overflow-y-auto">
      {/* Summary header */}
      <div className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800/60 px-3 py-1.5 flex items-center gap-3">
        <span className="text-[10px] text-zinc-400 font-mono">
          {fileCount} file{fileCount !== 1 ? "s" : ""} changed
        </span>
        {totalAdded > 0 && (
          <span className="text-[10px] text-green-500 font-mono">+{totalAdded}</span>
        )}
        {totalRemoved > 0 && (
          <span className="text-[10px] text-red-500 font-mono">-{totalRemoved}</span>
        )}
        {fileCount > 0 && (
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">
            [↑↓ navigate · →open ←close]
          </span>
        )}
      </div>

      {isLoading && (
        <div className="px-3 py-8 text-center">
          <p className="text-[10px] text-zinc-600 font-mono">loading diff...</p>
        </div>
      )}
      {files && files.length === 0 && (
        <div className="px-3 py-8 text-center">
          <p className="text-[10px] text-zinc-600 font-mono">no file changes</p>
        </div>
      )}
      {files &&
        files.length > 0 &&
        files.map((file, i) => (
          <FileLine
            key={file.filename}
            file={file}
            isOpen={openFiles.has(file.filename)}
            highlighted={i === selectedIdx}
            onToggle={() => toggleFile(file.filename)}
            onMouseEnter={() => setSelectedIdx(i)}
            setRef={(el) => itemRefs.current.set(i, el)}
          />
        ))}
    </div>
  );
}
