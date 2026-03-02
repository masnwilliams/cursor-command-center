"use client";

import { useState, useCallback } from "react";
import { usePrFiles } from "@/lib/api";
import type { Agent, PrFile } from "@/lib/types";
import { PatchDiff } from "@pierre/diffs/react";

interface DiffBarProps {
  agent: Agent;
  expanded: boolean;
  onToggle: () => void;
}

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
  onToggle,
}: {
  file: PrFile;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-0.5 hover:bg-zinc-800/60 text-left min-w-0"
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
          <span className="text-zinc-400">{fileBasename(file.filename)}</span>
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
        <div className="border-t border-zinc-800/40 bg-zinc-950">
          <PatchDiff
            patch={file.patch}
            options={{
              theme: "pierre-dark",
              overflow: "scroll",
              disableFileHeader: true,
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

export function DiffBar({ agent, expanded, onToggle }: DiffBarProps) {
  const prUrl = agent.target.prUrl;
  const { data, isLoading } = usePrFiles(expanded ? prUrl : null);
  const files = data?.files;
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  const toggleFile = useCallback((filename: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  const hasStats =
    agent.linesAdded != null ||
    agent.linesRemoved != null ||
    agent.filesChanged != null;

  if (!prUrl && !hasStats) return null;

  const totalAdded = files
    ? files.reduce((s, f) => s + f.additions, 0)
    : agent.linesAdded;
  const totalRemoved = files
    ? files.reduce((s, f) => s + f.deletions, 0)
    : agent.linesRemoved;
  const totalFiles = files?.length ?? agent.filesChanged;

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/60 flex flex-col max-h-[60vh]">
      {/* Summary line */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-2 py-0.5 hover:bg-zinc-800/40 text-left shrink-0"
      >
        <span className="text-[10px] text-zinc-600 font-mono shrink-0">
          {expanded ? "▾" : "▸"} changes
        </span>
        <span className="flex items-center gap-2 text-[10px] font-mono">
          {totalAdded != null && totalAdded > 0 && (
            <span className="text-green-500">+{totalAdded}</span>
          )}
          {totalRemoved != null && totalRemoved > 0 && (
            <span className="text-red-500">-{totalRemoved}</span>
          )}
          {totalFiles != null && (
            <span className="text-zinc-500">
              {totalFiles} file{totalFiles !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      </button>

      {/* Expanded file list + inline diffs */}
      {expanded && (
        <div className="border-t border-zinc-800/60 overflow-y-auto min-h-0">
          {isLoading && (
            <p className="text-[10px] text-zinc-600 font-mono px-3 py-2">
              loading...
            </p>
          )}
          {files && files.length === 0 && (
            <p className="text-[10px] text-zinc-600 font-mono px-3 py-2">
              no file changes
            </p>
          )}
          {files &&
            files.length > 0 &&
            files.map((file) => (
              <FileLine
                key={file.filename}
                file={file}
                isOpen={openFiles.has(file.filename)}
                onToggle={() => toggleFile(file.filename)}
              />
            ))}
          {!prUrl && !isLoading && (
            <p className="text-[10px] text-zinc-600 font-mono px-3 py-2">
              no pr yet — stats from agent
            </p>
          )}
        </div>
      )}
    </div>
  );
}
