"use client";

import type { AgentStatus } from "@/lib/types";

const config: Record<
  AgentStatus,
  { color: string; pulse: boolean; label: string }
> = {
  CREATING: { color: "bg-amber-400", pulse: true, label: "Creating" },
  RUNNING: { color: "bg-blue-400", pulse: true, label: "Running" },
  FINISHED: { color: "bg-emerald-400", pulse: false, label: "Finished" },
  STOPPED: { color: "bg-zinc-400", pulse: false, label: "Stopped" },
  ERROR: { color: "bg-red-400", pulse: false, label: "Error" },
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  const c = config[status] ?? config.ERROR;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span className="relative flex h-2 w-2">
        {c.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${c.color}`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${c.color}`}
        />
      </span>
      {c.label}
    </span>
  );
}
