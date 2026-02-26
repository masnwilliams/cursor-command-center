"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setApiKey, getApiKey } from "@/lib/storage";
import { testConnection } from "@/lib/api";

export default function SetupPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    const existing = getApiKey();
    if (existing) {
      setKey(existing);
      setHasExistingKey(true);
    }
  }, []);

  async function handleTest() {
    if (!key.trim()) {
      setError("Enter an API key");
      return;
    }
    setTesting(true);
    setError(null);
    setSuccess(null);
    setApiKey(key.trim());
    try {
      const me = await testConnection();
      setSuccess(`Connected as ${me.userEmail} (${me.apiKeyName})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setSuccess(null);
    } finally {
      setTesting(false);
    }
  }

  function handleContinue() {
    if (!key.trim()) return;
    setApiKey(key.trim());
    router.push("/");
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && key.trim()) {
        e.preventDefault();
        handleContinue();
      }
      if (e.key === "Escape" && hasExistingKey) {
        router.push("/");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-md border border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-900/60">
          <span className="text-xs text-zinc-300 font-mono">api key</span>
          {hasExistingKey && (
            <button
              onClick={() => router.push("/")}
              className="text-zinc-600 hover:text-zinc-300 text-xs font-mono"
            >
              [esc]
            </button>
          )}
        </div>

        <div className="px-3 py-3 space-y-3">
          <p className="text-[10px] text-zinc-500 font-mono">
            enter your cursor api key —{" "}
            <a
              href="https://cursor.com/dashboard?tab=integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              cursor.com/settings
            </a>
          </p>

          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="cursor api key"
            className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
          />

          {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
          {success && (
            <p className="text-xs text-emerald-400 font-mono">{success}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !key.trim()}
            className="flex-1 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? "testing..." : "test"}
          </button>
          <button
            onClick={handleContinue}
            disabled={!key.trim()}
            className="flex-1 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            continue ⌘↵
          </button>
        </div>
      </div>
    </div>
  );
}
