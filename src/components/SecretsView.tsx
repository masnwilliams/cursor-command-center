"use client";

import { useState } from "react";
import {
  useHypeshipSecrets,
  createHypeshipSecret,
  deleteHypeshipSecret,
} from "@/lib/api";
import { timeAgo } from "@/components/HypeshipConversation";

export default function SecretsView() {
  const { data, error, isLoading } = useHypeshipSecrets();
  const secrets = data?.secrets ?? [];
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"team" | "user">("team");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreate() {
    if (!name.trim() || !value.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await createHypeshipSecret(name.trim(), value.trim(), scope);
      setName("");
      setValue("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "failed to create secret");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(secretName: string, secretScope: string) {
    try {
      await deleteHypeshipSecret(secretName, secretScope);
    } catch {
      // ignore
    }
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="px-3 py-3 space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">add secret</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-zinc-600 font-mono">name</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MY_SECRET"
                className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-zinc-600 font-mono">value</p>
              <input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="secret value"
                className="w-full border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              />
            </div>
            <div className="flex gap-2 sm:gap-0 items-end">
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-600 font-mono">scope</p>
                <div className="flex gap-1">
                  {(["team", "user"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      className={`px-2 py-1.5 text-[10px] font-mono border transition-colors ${
                        scope === s
                          ? "border-blue-500 text-blue-400 bg-blue-500/10"
                          : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || !value.trim() || creating}
                className="px-3 py-1.5 text-[10px] font-mono bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 sm:ml-2"
              >
                {creating ? "..." : "add"}
              </button>
            </div>
          </div>
          {createError && (
            <p className="text-[10px] text-red-400/70 font-mono">{createError}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide mb-2">
            secrets ({secrets.length})
          </p>

          {isLoading && secrets.length === 0 && (
            <p className="text-[10px] text-zinc-600 font-mono animate-pulse">loading...</p>
          )}

          {error && (
            <p className="text-[10px] text-red-400 font-mono">{error.message}</p>
          )}

          {!isLoading && secrets.length === 0 && !error && (
            <p className="text-[10px] text-zinc-600 font-mono">no secrets yet</p>
          )}

          <div className="space-y-0.5">
            {secrets.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-900/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] text-zinc-200 font-mono truncate">{s.name}</span>
                  <span className="text-[10px] text-zinc-600 font-mono">{s.scope}</span>
                  <span className="text-[10px] text-zinc-700 font-mono">{timeAgo(s.created_at)}</span>
                </div>
                <button
                  onClick={() => handleDelete(s.name, s.scope)}
                  className="text-[10px] text-zinc-700 hover:text-red-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
