"use client";

import { useEffect, useRef } from "react";

interface MentionPopoverProps {
  items: string[];
  highlightIdx: number;
  query: string;
  onSelect: (index: number) => void;
  onDismiss: () => void;
}

function highlightMatch(label: string, query: string) {
  if (!query) return <span className="text-zinc-300">{label}</span>;
  const idx = label.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <span className="text-zinc-300">{label}</span>;
  return (
    <>
      <span className="text-zinc-500">{label.slice(0, idx)}</span>
      <span className="text-zinc-100">{label.slice(idx, idx + query.length)}</span>
      <span className="text-zinc-500">{label.slice(idx + query.length)}</span>
    </>
  );
}

export function MentionPopover({
  items,
  highlightIdx,
  query,
  onSelect,
  onDismiss,
}: MentionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onDismiss]);

  if (items.length === 0) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 right-0 mb-1 z-50 border border-zinc-800 bg-zinc-900 max-h-[160px] overflow-y-auto font-mono text-xs"
    >
      {items.map((item, i) => (
        <button
          key={item}
          ref={(el) => { itemRefs.current[i] = el; }}
          className={`w-full text-left px-2 py-1 cursor-pointer ${
            i === highlightIdx
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/50"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(i);
          }}
        >
          <span className="text-zinc-600 mr-1">@</span>
          {highlightMatch(item, query)}
        </button>
      ))}
    </div>
  );
}
