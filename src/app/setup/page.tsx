"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  setApiKey,
  getApiKey,
  getGithubToken,
  setGithubToken,
} from "@/lib/storage";
import { testConnection, testGithubToken } from "@/lib/api";

type TestState = "idle" | "testing" | "success" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [hasExisting, setHasExisting] = useState(false);

  const [cursorState, setCursorState] = useState<TestState>("idle");
  const [cursorMsg, setCursorMsg] = useState("");
  const [ghState, setGhState] = useState<TestState>("idle");
  const [ghMsg, setGhMsg] = useState("");

  useEffect(() => {
    const existingKey = getApiKey();
    const existingToken = getGithubToken();
    if (existingKey) setKey(existingKey);
    if (existingToken) setGhToken(existingToken);
    if (existingKey && existingToken) setHasExisting(true);
  }, []);

  // Auto-test Cursor API key
  useEffect(() => {
    if (!key.trim()) {
      setCursorState("idle");
      setCursorMsg("");
      return;
    }
    setCursorState("testing");
    const timer = setTimeout(async () => {
      setApiKey(key.trim());
      try {
        const me = await testConnection();
        setCursorState("success");
        setCursorMsg(`${me.userEmail} (${me.apiKeyName})`);
      } catch (e) {
        setCursorState("error");
        setCursorMsg(e instanceof Error ? e.message : "connection failed");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [key]);

  // Auto-test GitHub token
  useEffect(() => {
    if (!ghToken.trim()) {
      setGhState("idle");
      setGhMsg("");
      return;
    }
    setGhState("testing");
    const timer = setTimeout(async () => {
      setGithubToken(ghToken.trim());
      try {
        const user = await testGithubToken();
        setGhState("success");
        setGhMsg(`@${user.login}`);
      } catch (e) {
        setGhState("error");
        setGhMsg(e instanceof Error ? e.message : "authentication failed");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [ghToken]);

  const canContinue = cursorState === "success" && ghState === "success";

  function handleContinue() {
    if (!canContinue) return;
    setApiKey(key.trim());
    setGithubToken(ghToken.trim());
    router.push("/");
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && canContinue) {
        e.preventDefault();
        handleContinue();
      }
      if (e.key === "Escape" && hasExisting) {
        router.push("/");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function stateIcon(state: TestState) {
    switch (state) {
      case "testing":
        return (
          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
            ...
          </span>
        );
      case "success":
        return (
          <span className="text-[10px] text-emerald-400 font-mono shrink-0">
            ✓
          </span>
        );
      case "error":
        return (
          <span className="text-[10px] text-red-400 font-mono shrink-0">
            ✕
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-md border border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">setup</span>
          {hasExisting && (
            <button
              onClick={() => router.push("/")}
              className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
            >
              [esc]
            </button>
          )}
        </div>

        <div className="px-3 py-3 space-y-4">
          {/* Cursor API key */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono">
              cursor api key —{" "}
              <a
                href="https://cursor.com/dashboard?tab=integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                cursor.com/settings
              </a>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="cursor api key"
                autoFocus
                className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
              {stateIcon(cursorState)}
            </div>
            {cursorState === "success" && (
              <p className="text-[10px] text-emerald-400/70 font-mono">
                {cursorMsg}
              </p>
            )}
            {cursorState === "error" && (
              <p className="text-[10px] text-red-400/70 font-mono">
                {cursorMsg}
              </p>
            )}
          </div>

          {/* GitHub token */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono">
              github token —{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new?description=cursor-command-center&contents=read&pull_requests=read&metadata=read"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                fine-grained
              </a>
              {" · "}
              <a
                href="https://github.com/settings/tokens/new?description=cursor-command-center&scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                classic
              </a>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder="ghp_... or github pat"
                className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
              {stateIcon(ghState)}
            </div>
            {ghState === "success" && (
              <p className="text-[10px] text-emerald-400/70 font-mono">
                {ghMsg}
              </p>
            )}
            {ghState === "error" && (
              <p className="text-[10px] text-red-400/70 font-mono">
                {ghMsg}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            continue ↵
          </button>
        </div>
      </div>
    </div>
  );
}
