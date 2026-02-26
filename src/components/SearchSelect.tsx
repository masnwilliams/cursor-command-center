"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";

export interface SearchSelectHandle {
  open: () => void;
  close: () => void;
}

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  onSkip?: () => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  loading?: boolean;
  allowCustom?: boolean;
  autoOpen?: boolean;
}

export const SearchSelect = forwardRef<SearchSelectHandle, SearchSelectProps>(
  function SearchSelect(
    {
      value,
      onChange,
      onSkip,
      options,
      placeholder = "select...",
      loading,
      allowCustom,
      autoOpen,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const mounted = useRef(false);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => {
        setOpen(false);
        setQuery("");
      },
    }));

    useEffect(() => {
      if (autoOpen && !mounted.current) setOpen(true);
      mounted.current = true;
    }, [autoOpen]);

    const filtered = options.filter((o) =>
      o.label.toLowerCase().includes(query.toLowerCase()),
    );

    const hasCustomOption =
      allowCustom && query && !filtered.some((o) => o.value === query);
    const totalItems = (hasCustomOption ? 1 : 0) + filtered.length;

    const selectedLabel =
      options.find((o) => o.value === value)?.label ?? (value || undefined);

    useEffect(() => {
      if (open && inputRef.current) inputRef.current.focus();
      setHighlightIdx(-1);
    }, [open]);

    useEffect(() => {
      setHighlightIdx(-1);
    }, [query]);

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          if (
            allowCustom &&
            query &&
            !filtered.some((o) => o.value === query)
          ) {
            onChange(query);
          }
          setOpen(false);
          setQuery("");
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [allowCustom, query, filtered, onChange]);

    function handleSelect(val: string) {
      onChange(val);
      setOpen(false);
      setQuery("");
    }

    function selectHighlighted() {
      if (highlightIdx < 0) {
        if (filtered.length === 1) handleSelect(filtered[0].value);
        else if (allowCustom && query) handleSelect(query);
        return;
      }
      if (hasCustomOption && highlightIdx === 0) {
        handleSelect(query);
        return;
      }
      const idx = hasCustomOption ? highlightIdx - 1 : highlightIdx;
      if (idx >= 0 && idx < filtered.length) handleSelect(filtered[idx].value);
    }

    function scrollToHighlight(idx: number) {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll("[data-item]");
      items[idx]?.scrollIntoView({ block: "nearest" });
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setOpen(false);
        setQuery("");
        onSkip?.();
        return;
      }
      if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectHighlighted();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(highlightIdx + 1, totalItems - 1);
        setHighlightIdx(next);
        scrollToHighlight(next);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(highlightIdx - 1, -1);
        setHighlightIdx(next);
        if (next >= 0) scrollToHighlight(next);
        return;
      }
    }

    let itemIdx = 0;

    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-left font-mono outline-none focus:border-zinc-600 flex items-center justify-between"
        >
          <span className={selectedLabel ? "text-zinc-100" : "text-zinc-600"}>
            {selectedLabel || placeholder}
          </span>
          <span className="text-zinc-600 text-[10px]">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div className="absolute z-10 left-0 right-0 top-full border border-zinc-800 border-t-0 bg-zinc-950 max-h-[200px] flex flex-col">
            <div className="border-b border-zinc-800 px-2 py-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={allowCustom ? "search or type..." : "search..."}
                className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
                onKeyDown={handleKeyDown}
              />
            </div>
            <div ref={listRef} className="overflow-y-auto flex-1">
              {loading && (
                <div className="px-2 py-2 text-[10px] text-zinc-600 font-mono">
                  loading...
                </div>
              )}
              {!loading && filtered.length === 0 && !allowCustom && (
                <div className="px-2 py-2 text-[10px] text-zinc-600 font-mono">
                  no results
                </div>
              )}
              {hasCustomOption && (
                <button
                  data-item
                  onClick={() => handleSelect(query)}
                  className={`w-full text-left px-2 py-1.5 text-xs font-mono transition-colors ${
                    highlightIdx === itemIdx++
                      ? "bg-zinc-800 text-blue-400"
                      : "text-blue-400 hover:bg-zinc-800"
                  }`}
                >
                  use &quot;{query}&quot;
                </button>
              )}
              {filtered.map((o) => {
                const idx = itemIdx++;
                return (
                  <button
                    data-item
                    key={o.value}
                    onClick={() => handleSelect(o.value)}
                    className={`w-full text-left px-2 py-1.5 text-xs font-mono transition-colors ${
                      highlightIdx === idx
                        ? "bg-zinc-800 text-zinc-100"
                        : o.value === value
                          ? "text-blue-400 hover:bg-zinc-800"
                          : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  },
);
