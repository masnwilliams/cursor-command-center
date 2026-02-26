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
    <div className="min-h-dvh bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-100">
            Cursor Agents
          </h1>
          <p className="text-sm text-zinc-400">
            Enter your Cursor API key to get started. Get one from{" "}
            <a
              href="https://cursor.com/dashboard?tab=integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              cursor.com/settings
            </a>
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Cursor API key"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !key.trim()}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={handleContinue}
              disabled={!key.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue ⌘↵
            </button>
          </div>

          {hasExistingKey && (
            <button
              onClick={() => router.push("/")}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors py-1"
            >
              esc — back to grid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
