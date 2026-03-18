"use client";

import { useState, useEffect } from "react";
import {
  useHypeshipUser,
  useHypeshipIdentities,
  unlinkHypeshipIdentity,
  getHypeshipAuthConfig,
  getHypeshipSettingsLink,
  useHypeshipOrchestrator,
  resetHypeshipOrchestrator,
} from "@/lib/api";
import TerminalView from "@/components/TerminalView";
import { timeAgo } from "@/components/HypeshipConversation";
import type { HypeshipAuthConfig } from "@/lib/types";

const ORCH_STATE_COLORS: Record<string, string> = {
  creating: "bg-amber-400",
  running: "bg-blue-400",
  standby: "bg-zinc-400",
  error: "bg-red-400",
};

const ORCH_STATE_PULSE: Record<string, boolean> = {
  creating: true,
  running: true,
  standby: false,
  error: false,
};

function OrchestratorSection() {
  const { data: orchData } = useHypeshipOrchestrator();
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<"ok" | "error" | null>(null);

  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    setResult(null);
    try {
      await resetHypeshipOrchestrator();
      setResult("ok");
    } catch {
      setResult("error");
    } finally {
      setResetting(false);
    }
  }

  const orch = orchData?.orchestrator;

  return (
    <div className="border-t border-zinc-800 pt-3 space-y-2">
      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
        orchestrator
      </p>

      {!orch ? (
        <p className="text-[10px] text-zinc-600 font-mono">no orchestrator</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {ORCH_STATE_PULSE[orch.state] && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${ORCH_STATE_COLORS[orch.state] ?? "bg-zinc-400"}`}
                />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${ORCH_STATE_COLORS[orch.state] ?? "bg-zinc-400"}`}
              />
            </span>
            <span className="text-[11px] text-zinc-200 font-mono">{orch.state}</span>
            <span className="text-[10px] text-zinc-600 font-mono truncate">
              {orch.id.length > 20 ? orch.id.slice(0, 20) + "..." : orch.id}
            </span>
          </div>

          {orch.last_active_at && (
            <p className="text-[10px] text-zinc-600 font-mono">
              last active: {new Date(orch.last_active_at).toLocaleString()}
            </p>
          )}

          {orch.pending_tasks != null && orch.pending_tasks > 0 && (
            <p className="text-[10px] text-amber-400/70 font-mono">
              {orch.pending_tasks} pending task{orch.pending_tasks !== 1 ? "s" : ""}
            </p>
          )}

          {orch.desktop_url && (
            <a
              href={orch.desktop_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
            >
              open desktop (vnc)
            </a>
          )}

          {orch.shell_ws_url && (
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
                shell
              </p>
              <div className="h-[400px] border border-zinc-800 rounded overflow-hidden">
                <TerminalView wsUrl={orch.shell_ws_url} />
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-zinc-600 font-mono">
        reset restarts the orchestrator VM on the latest image.
        all conversations and session context are preserved.
      </p>
      <button
        onClick={handleReset}
        disabled={resetting}
        className="px-3 py-1.5 text-[10px] font-mono border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {resetting ? "resetting..." : "reset orchestrator"}
      </button>
      {result === "ok" && (
        <p className="text-[10px] text-emerald-400/70 font-mono">
          orchestrator reset. next message will spin up a fresh one.
        </p>
      )}
      {result === "error" && (
        <p className="text-[10px] text-red-400/70 font-mono">
          reset failed
        </p>
      )}
    </div>
  );
}

export default function SettingsView() {
  const { data: userData, error: userError } = useHypeshipUser();
  const { data: identData, error: identError } = useHypeshipIdentities();
  const [authConfig, setAuthConfig] = useState<HypeshipAuthConfig | null>(null);
  const [settingsLinkLoading, setSettingsLinkLoading] = useState(false);
  const [settingsLinkError, setSettingsLinkError] = useState("");
  const user = userData?.user;
  const identities = identData?.identities ?? [];

  useEffect(() => {
    getHypeshipAuthConfig()
      .then(setAuthConfig)
      .catch(() => {});
  }, []);

  async function handleUnlink(provider: string) {
    try {
      await unlinkHypeshipIdentity(provider);
    } catch {
      // ignore
    }
  }

  async function openSettingsPage() {
    if (settingsLinkLoading) return;
    setSettingsLinkLoading(true);
    setSettingsLinkError("");
    try {
      const { url } = await getHypeshipSettingsLink();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setSettingsLinkError(e instanceof Error ? e.message : "failed to generate link");
    } finally {
      setSettingsLinkLoading(false);
    }
  }

  return (
    <div className="overflow-y-auto h-full px-3 py-3 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={openSettingsPage}
          disabled={settingsLinkLoading}
          className="text-[10px] font-mono text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {settingsLinkLoading ? "generating link..." : "open api settings page ↗"}
        </button>
        {settingsLinkError && (
          <span className="text-[10px] text-red-400/70 font-mono">{settingsLinkError}</span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">user</p>
        {userError && (
          <p className="text-[10px] text-red-400 font-mono">{userError.message}</p>
        )}
        {!user && !userError && (
          <p className="text-[10px] text-zinc-600 font-mono animate-pulse">loading...</p>
        )}
        {user && (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-mono">
            <span className="text-zinc-600">id</span>
            <span className="text-zinc-400 truncate">{user.id}</span>
            <span className="text-zinc-600">name</span>
            <span className="text-zinc-300">{user.display_name}</span>
            {user.email && (
              <>
                <span className="text-zinc-600">email</span>
                <span className="text-zinc-300">{user.email}</span>
              </>
            )}
            <span className="text-zinc-600">created</span>
            <span className="text-zinc-300">{timeAgo(user.created_at)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-3 space-y-2">
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
          linked identities ({identities.length})
        </p>
        {identError && (
          <p className="text-[10px] text-red-400 font-mono">{identError.message}</p>
        )}
        {identities.length === 0 && !identError && (
          <p className="text-[10px] text-zinc-600 font-mono">no linked identities</p>
        )}
        <div className="space-y-1">
          {identities.map((ident) => (
            <div
              key={ident.id}
              className="flex items-center justify-between px-2 py-1.5 border border-zinc-800 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] text-zinc-200 font-mono">{ident.provider}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate">
                  {ident.provider_id}
                </span>
                {ident.has_token && (
                  <span className="text-[10px] text-emerald-400/70 font-mono">token</span>
                )}
              </div>
              <button
                onClick={() => handleUnlink(ident.provider)}
                className="text-[10px] text-zinc-700 hover:text-red-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity"
              >
                unlink
              </button>
            </div>
          ))}
        </div>
      </div>

      {authConfig && authConfig.providers.length > 0 && (
        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
            available providers
          </p>
          {authConfig.providers.map((p) => (
            <div key={p.type} className="flex items-center gap-3 px-2 py-1.5 border border-zinc-800">
              <span className="text-[11px] text-zinc-200 font-mono">{p.type}</span>
              <span className="text-[10px] text-zinc-600 font-mono truncate">
                client: {p.client_id}
              </span>
            </div>
          ))}
        </div>
      )}

      <OrchestratorSection />
    </div>
  );
}
