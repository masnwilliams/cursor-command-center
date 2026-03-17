"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import type { HypeshipEnv } from "@/lib/storage";

type NavTab = "panes" | "secrets" | "settings";

export default function PageShell({
  env = "production",
  activeTab,
  children,
}: {
  env?: HypeshipEnv;
  activeTab: NavTab;
  children: ReactNode;
}) {
  const router = useRouter();
  const basePath = env === "staging" ? "/staging" : "";
  const [showPalette, setShowPalette] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setMounted(true);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }
      if (e.key === "Escape" && showPalette) {
        setShowPalette(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showPalette]);

  const commands = useMemo(() => {
    const cmds: Command[] = [];

    cmds.push({
      id: "panes",
      label: "panes",
      section: "navigation",
      action: () => router.push(basePath || "/"),
    });
    cmds.push({
      id: "secrets",
      label: "secrets",
      section: "navigation",
      action: () => router.push(`${basePath}/secrets`),
    });
    cmds.push({
      id: "settings",
      label: "settings",
      section: "navigation",
      action: () => router.push(`${basePath}/settings`),
    });
    cmds.push({
      id: "cursor",
      label: "open cursor agents",
      section: "app",
      action: () => router.push("/cursor"),
    });

    return cmds;
  }, [router, basePath]);

  if (!mounted) return null;

  function navClass(tab: NavTab) {
    const base = `font-mono ${isMobile ? "text-xs" : "text-[10px]"} transition-colors`;
    if (tab === activeTab) return `${base} text-zinc-200`;
    return `${base} text-zinc-500 hover:text-zinc-200`;
  }

  return (
    <div className="h-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 sm:px-2 py-2 sm:py-0.5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`${isMobile ? "text-xs" : "text-[10px]"} text-zinc-500 font-mono shrink-0`}>
            hypeship
          </span>
          {env === "staging" && (
            <span className="text-[10px] text-amber-400 font-mono border border-amber-400/30 px-1.5 py-0.5 shrink-0">staging</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => router.push(basePath || "/")} className={navClass("panes")}>
            panes
          </button>
          <button onClick={() => router.push(`${basePath}/secrets`)} className={navClass("secrets")}>
            secrets
          </button>
          <button onClick={() => router.push(`${basePath}/settings`)} className={navClass("settings")}>
            settings
          </button>
          <button
            onClick={() => setShowPalette(true)}
            className={`text-zinc-500 hover:text-zinc-200 active:text-zinc-100 font-mono ${isMobile ? "text-xs py-1 px-2" : "text-[10px]"}`}
          >
            {isMobile ? "menu" : "[⌘K]"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>

      {/* Command palette */}
      {showPalette && (
        <CommandPalette commands={commands} onClose={() => setShowPalette(false)} />
      )}
    </div>
  );
}
