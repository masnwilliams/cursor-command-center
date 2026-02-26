"use client";

import { useState, useRef, useEffect } from "react";

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  loading?: boolean;
  allowCustom?: boolean;
}

export function SearchSelect({ value, onChange, options, placeholder = "select...", loading, allowCustom }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  const selectedLabel = options.find((o) => o.value === value)?.label ?? (value || undefined);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (allowCustom && query && !filtered.some((o) => o.value === query)) {
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
        <span className="text-zinc-600 text-[10px]">{open ? "▲" : "▼"}</span>
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
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setQuery(""); }
                if (e.key === "Enter") {
                  if (filtered.length === 1) {
                    handleSelect(filtered[0].value);
                  } else if (allowCustom && query) {
                    handleSelect(query);
                  }
                }
              }}
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="px-2 py-2 text-[10px] text-zinc-600 font-mono">loading...</div>
            )}
            {!loading && filtered.length === 0 && !allowCustom && (
              <div className="px-2 py-2 text-[10px] text-zinc-600 font-mono">no results</div>
            )}
            {allowCustom && query && !filtered.some((o) => o.value === query) && (
              <button
                onClick={() => handleSelect(query)}
                className="w-full text-left px-2 py-1.5 text-xs font-mono hover:bg-zinc-800 text-blue-400 transition-colors"
              >
                use &quot;{query}&quot;
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                onClick={() => handleSelect(o.value)}
                className={`w-full text-left px-2 py-1.5 text-xs font-mono hover:bg-zinc-800 transition-colors ${
                  o.value === value ? "text-blue-400" : "text-zinc-300"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
