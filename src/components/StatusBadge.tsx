"use client";

import type { AgentStatus } from "@/lib/types";

const config: Record<AgentStatus, { color: string; pulse: boolean }> = {
  CREATING: { color: "bg-amber-400", pulse: true },
  RUNNING: { color: "bg-blue-400", pulse: true },
  FINISHED: { color: "bg-emerald-400", pulse: false },
  STOPPED: { color: "bg-zinc-400", pulse: false },
  ERROR: { color: "bg-red-400", pulse: false },
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  const c = config[status] ?? config.ERROR;
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {c.pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${c.color}`}
        />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${c.color}`}
      />
    </span>
  );
}
