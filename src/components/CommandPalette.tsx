"use client";

import { useState, useEffect, useRef, useMemo } from "react";

export interface Command {
  id: string;
  label: string;
  section?: string;
  destructive?: boolean;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (!query && e.key >= "1" && e.key <= "9") {
      const idx = parseInt(e.key) - 1;
      if (idx < filtered.length) {
        e.preventDefault();
        filtered[idx].action();
        onClose();
      }
    }
  }

  let lastSection: string | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/70"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-zinc-800 bg-zinc-950 flex flex-col max-h-[60vh]"
      >
        <div className="border-b border-zinc-800 px-3 py-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="type a command..."
            className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
          />
        </div>
        <div ref={listRef} className="overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-[10px] text-zinc-600 font-mono px-3 py-3">
              no matches
            </p>
          )}
          {filtered.map((cmd, i) => {
            const showSection = cmd.section && cmd.section !== lastSection;
            lastSection = cmd.section;
            return (
              <div key={cmd.id}>
                {showSection && (
                  <div className="px-3 pt-2 pb-0.5">
                    <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider">
                      {cmd.section}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors flex items-center gap-2 ${
                    i === selectedIdx
                      ? cmd.destructive
                        ? "bg-red-950/40 text-red-400"
                        : "bg-zinc-800/60 text-zinc-100"
                      : cmd.destructive
                        ? "text-red-500/70 hover:text-red-400"
                        : "text-zinc-400"
                  }`}
                >
                  {i < 9 && (
                    <span className="text-[10px] text-zinc-600 w-3 shrink-0 text-right">
                      {i + 1}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">{cmd.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
