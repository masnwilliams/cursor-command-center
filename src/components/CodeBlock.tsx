"use client";

import { useState, useCallback, isValidElement, type ReactNode } from "react";

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

export function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = extractText(children);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [children]);

  return (
    <pre className="group/code relative">
      <button
        onClick={handleCopy}
        className="absolute top-1 right-1 opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover/code:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 p-0.5"
        title="copy"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-400">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="1" />
            <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
          </svg>
        )}
      </button>
      {children}
    </pre>
  );
}
