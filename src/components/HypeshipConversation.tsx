"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getToolDetailBody,
  getToolDetailSummary,
} from "@/lib/hypeshipMessageDetails";
import type { HypeshipConversationTurn, HypeshipArtifact } from "@/lib/types";

// ── Helpers ──

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncatePreview(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function getCollapsedTurnPreview(turn: HypeshipConversationTurn, max = 60): string | null {
  const content = turn.content?.trim();
  if (!content) return null;

  const isTool = turn.source === "orchestrator:tool" || !!turn.tool_use_id;
  if (!isTool) {
    return truncatePreview(content, max);
  }

  const toolDetail = getToolDetailSummary(turn.detail);
  return truncatePreview(toolDetail ? `${content} ${toolDetail}` : content, max);
}

// ── Grouping ──

export interface TurnGroup {
  type: "message" | "worker" | "delegate";
  workerId?: string;
  turns: HypeshipConversationTurn[];
  children?: TurnGroup[];
}

interface SubAgentTurnGroup {
  type: "turn" | "subagent";
  turns: HypeshipConversationTurn[];
}

function isDelegateTaskCall(turn: HypeshipConversationTurn): boolean {
  return (
    turn.source === "orchestrator:tool" &&
    !!turn.tool_use_id &&
    !!turn.content?.startsWith("mcp__hypeship__delegate_task")
  );
}

export function groupTurnsByWorker(turns: HypeshipConversationTurn[]): TurnGroup[] {
  interface OrderedGroup {
    idx: number;
    group: TurnGroup;
  }
  const items: OrderedGroup[] = [];
  const workerBuckets = new Map<string, HypeshipConversationTurn[]>();
  const workerStartIdx = new Map<string, number>();
  let pendingMessages: HypeshipConversationTurn[] = [];
  let pendingStart = -1;

  function flushPending() {
    if (pendingMessages.length > 0) {
      items.push({ idx: pendingStart, group: { type: "message", turns: pendingMessages } });
      pendingMessages = [];
      pendingStart = -1;
    }
  }

  function flushWorker(wid: string) {
    const bucket = workerBuckets.get(wid);
    if (bucket && bucket.length > 0) {
      items.push({ idx: workerStartIdx.get(wid)!, group: { type: "worker", workerId: wid, turns: [...bucket] } });
    }
    workerBuckets.delete(wid);
    workerStartIdx.delete(wid);
  }

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.worker_id) {
      const wid = turn.worker_id;
      const isResumed = turn.status === "running" && workerBuckets.has(wid);

      if (isResumed) {
        flushPending();
        flushWorker(wid);
      }

      if (!workerBuckets.has(wid)) {
        flushPending();
        workerBuckets.set(wid, []);
        workerStartIdx.set(wid, i);
      }
      workerBuckets.get(wid)!.push(turn);
    } else {
      if (pendingStart < 0) pendingStart = i;
      pendingMessages.push(turn);
    }
  }

  for (const wid of [...workerBuckets.keys()]) {
    flushWorker(wid);
  }
  flushPending();

  items.sort((a, b) => a.idx - b.idx);
  const groups = items.map((item) => item.group);

  // Phase 2: merge delegate_task calls with their child workers.
  // A message group may contain multiple delegate_tasks — split and handle each.
  // Each delegate_task consumes the next consecutive run of worker groups.
  const merged: TurnGroup[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];

    if (g.type !== "message") {
      merged.push(g);
      continue;
    }

    // Split this message group around delegate_task calls
    let remaining = g.turns;
    while (remaining.length > 0) {
      const dIdx = remaining.findIndex(isDelegateTaskCall);
      if (dIdx < 0) {
        merged.push({ type: "message", turns: remaining });
        break;
      }

      if (dIdx > 0) {
        merged.push({ type: "message", turns: remaining.slice(0, dIdx) });
      }

      const delegateTurn = remaining[dIdx];
      remaining = remaining.slice(dIdx + 1);

      // Consume consecutive worker groups that follow this position in the outer array
      const childWorkers: TurnGroup[] = [];
      let j = i + 1;
      while (j < groups.length && groups[j].type === "worker") {
        childWorkers.push(groups[j]);
        j++;
      }

      merged.push({
        type: "delegate",
        turns: [delegateTurn],
        children: childWorkers,
      });

      // Advance past consumed workers
      i = j - 1;
    }
  }

  return merged;
}

function isSubAgentToolCall(turn: HypeshipConversationTurn): boolean {
  if (!turn.tool_use_id || turn.content !== "Agent") return false;
  try {
    const d = typeof turn.detail === "string" ? JSON.parse(turn.detail) : turn.detail;
    return !!(d as Record<string, unknown>)?.subagent_type;
  } catch {
    return false;
  }
}

function groupTurnsBySubAgent(turns: HypeshipConversationTurn[]): SubAgentTurnGroup[] {
  const agentToolIds = new Set<string>();
  const childMap = new Map<string, HypeshipConversationTurn[]>();

  for (const turn of turns) {
    if (isSubAgentToolCall(turn) && turn.tool_use_id) {
      agentToolIds.add(turn.tool_use_id);
      childMap.set(turn.tool_use_id, []);
    }
  }

  if (agentToolIds.size === 0) {
    return turns.map((t) => ({ type: "turn" as const, turns: [t] }));
  }

  for (const turn of turns) {
    if (turn.parent_tool_use_id && childMap.has(turn.parent_tool_use_id)) {
      childMap.get(turn.parent_tool_use_id)!.push(turn);
    }
  }

  const groups: SubAgentTurnGroup[] = [];
  for (const turn of turns) {
    if (isSubAgentToolCall(turn) && turn.tool_use_id) {
      const children = childMap.get(turn.tool_use_id) || [];
      groups.push({ type: "subagent", turns: [turn, ...children] });
    } else if (turn.parent_tool_use_id && agentToolIds.has(turn.parent_tool_use_id)) {
      continue;
    } else {
      groups.push({ type: "turn", turns: [turn] });
    }
  }

  return groups;
}

// ── Bubble Components ──

function ToolIndicatorBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = turn.status === "running";
  const isComplete = turn.status === "complete";
  const isError = turn.status === "error";
  const dotColor = isError
    ? "bg-red-400"
    : isComplete
      ? "bg-emerald-400"
      : "bg-blue-400";
  const statusLabel = isError ? "error" : isComplete ? "done" : "working...";
  const toolDetail = getToolDetailSummary(turn.detail);
  const detailBody = getToolDetailBody(turn.detail);
  const hasDetailBody = detailBody.trim().length > 0;

  return (
    <div className="px-3 py-1.5">
      <button
        onClick={() => hasDetailBody && setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 hover:bg-zinc-900/30 transition-colors rounded px-1 py-0.5 -mx-1"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className="text-[10px] text-emerald-400 font-mono">⚡ {turn.content?.replace(/^mcp__\w+__/, "")}</span>
        {toolDetail && <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[300px]">{toolDetail}</span>}
        <span className="text-[10px] text-zinc-600 font-mono">{statusLabel}</span>
        {turn.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">{timeAgo(turn.timestamp)}</span>
        )}
        {hasDetailBody && (
          <span className="text-[10px] text-zinc-700 font-mono">{expanded ? "▼" : "▶"}</span>
        )}
      </button>
      {expanded && hasDetailBody && (
        <div className="ml-5 mt-1 border-l border-zinc-800/60 pl-3 max-h-[260px] overflow-y-auto">
          <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words">
            {detailBody}
          </pre>
        </div>
      )}
    </div>
  );
}

function ThinkingBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const [expanded, setExpanded] = useState(false);
  const preview = turn.content?.slice(0, 80) || "thinking...";
  return (
    <div className="px-3 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 hover:bg-zinc-900/30 transition-colors rounded px-1 py-0.5 -mx-1"
      >
        <span className="text-[10px] text-violet-400/60 font-mono">~</span>
        <span className="text-[10px] text-zinc-600 font-mono italic truncate">
          {expanded ? "thinking" : preview}
        </span>
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 mt-1 border-l border-violet-900/30 pl-3 max-h-[300px] overflow-y-auto">
          <div className="text-[10px] text-zinc-600 font-mono whitespace-pre-wrap italic">
            {turn.content}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConversationBubble({ turn }: { turn: HypeshipConversationTurn }) {
  const source = turn.source || "";
  const isUser = turn.role === "user";
  const isSystem = source === "system";
  const isTool = source === "orchestrator:tool" || !!turn.tool_use_id;
  const isThinking = source.endsWith(":thinking");
  const isWorker = source.startsWith("worker:") && !isThinking;
  const workerID = isWorker ? source.slice(7) : "";

  if (isThinking) {
    return <ThinkingBubble turn={turn} />;
  }

  if (isTool) {
    return <ToolIndicatorBubble turn={turn} />;
  }

  if (isSystem) {
    return (
      <div className="px-3 py-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">*</span>
          <span className="text-[10px] text-zinc-600 font-mono">{turn.content}</span>
          <span className="text-[10px] text-zinc-700 font-mono ml-auto">
            {timeAgo(turn.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  const prefix = isUser ? ">" : "$";
  const label = isUser
    ? "user"
    : isWorker
      ? `worker ${workerID.slice(0, 12)}`
      : "orchestrator";
  const color = isUser
    ? "text-blue-400"
    : isWorker
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <div className={`px-3 py-2 ${isUser ? "bg-zinc-900/30" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-mono ${color}`}>{prefix}</span>
        <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">
          {timeAgo(turn.timestamp)}
        </span>
      </div>
      <div className="ml-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words prose prose-invert prose-xs max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
      </div>
    </div>
  );
}

// ── Group Components ──

function ToolBatchGroup({ turns }: { turns: HypeshipConversationTurn[] }) {
  const [expanded, setExpanded] = useState(false);
  const allDone = turns.every((t) => t.status === "complete");
  const anyRunning = turns.some((t) => t.status === "running");
  const anyError = turns.some((t) => t.status === "error");
  const count = turns.length;

  const dotColor = anyError ? "bg-red-400" : allDone ? "bg-emerald-400" : "bg-blue-400";
  const statusLabel = anyError ? "error" : allDone ? "done" : "working...";

  return (
    <div className="px-3 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 hover:bg-zinc-900/30 transition-colors rounded px-1 py-0.5 -mx-1"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {anyRunning && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">
          {count} tool call{count !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{statusLabel}</span>
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="ml-1 mt-0.5">
          {turns.map((turn, i) => (
            <ToolIndicatorBubble key={`tb-${i}`} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TurnTree({ turns }: { turns: HypeshipConversationTurn[] }) {
  const saGroups = groupTurnsBySubAgent(turns);
  const rendered: React.ReactNode[] = [];
  let toolBatch: HypeshipConversationTurn[] = [];
  let batchKey = 0;

  function flushToolBatch() {
    if (toolBatch.length > 1) {
      rendered.push(<ToolBatchGroup key={`batch-${batchKey++}`} turns={[...toolBatch]} />);
    } else if (toolBatch.length === 1) {
      rendered.push(<ConversationBubble key={`batch-${batchKey++}`} turn={toolBatch[0]} />);
    }
    toolBatch = [];
  }

  for (const sg of saGroups) {
    if (sg.type === "subagent") {
      flushToolBatch();
      rendered.push(<SubAgentGroup key={`sa-${batchKey++}`} turns={sg.turns} />);
    } else {
      for (const turn of sg.turns) {
        const isTool = turn.source === "orchestrator:tool" || !!turn.tool_use_id;
        if (isTool && !isDelegateTaskCall(turn)) {
          toolBatch.push(turn);
        } else {
          flushToolBatch();
          rendered.push(<ConversationBubble key={`t-${batchKey++}`} turn={turn} />);
        }
      }
    }
  }
  flushToolBatch();

  return <>{rendered}</>;
}

function SubAgentGroup({ turns }: { turns: HypeshipConversationTurn[] }) {
  const [expanded, setExpanded] = useState(false);

  const agentCall = turns[0];
  const childTurns = turns.slice(1);

  let description = "sub-agent";
  let subagentType = "Agent";
  try {
    const d = typeof agentCall.detail === "string" ? JSON.parse(agentCall.detail) : agentCall.detail;
    const rec = d as Record<string, unknown>;
    description = (rec?.description as string) || "sub-agent";
    subagentType = (rec?.subagent_type as string) || "Agent";
  } catch {}

  const status = agentCall.status || "running";
  const isRunning = status === "running";
  const isComplete = status === "complete";
  const isError = status === "error";

  const stepCount = childTurns.length;
  const dotColor = isComplete ? "bg-emerald-400" : isError ? "bg-red-400" : "bg-violet-400";
  const labelColor = isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-violet-400";
  const borderColor = isComplete ? "border-emerald-400/20" : isError ? "border-red-400/20" : "border-violet-400/20";

  const lastActivity = (() => {
    const last = [...childTurns].reverse().find((t) => t.content?.trim());
    if (!last) return null;
    return getCollapsedTurnPreview(last);
  })();

  const statusLabel = isComplete
    ? "done"
    : isError
      ? "error"
      : stepCount > 0
        ? `${stepCount} step${stepCount !== 1 ? "s" : ""}...`
        : "working...";

  return (
    <div className={`border-l-2 ${borderColor} ml-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-900/30 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={`text-[10px] ${labelColor} font-mono`}>⚡ {subagentType}</span>
        <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[300px]">{description}</span>
        <span className="text-[10px] text-zinc-600 font-mono">
          {stepCount > 0 && isComplete ? `${stepCount} step${stepCount !== 1 ? "s" : ""}` : statusLabel}
        </span>
        {agentCall.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono">{timeAgo(agentCall.timestamp)}</span>
        )}
        <span className="text-[10px] text-zinc-700 font-mono ml-auto">{expanded ? "▼" : "▶"}</span>
      </button>
      {!expanded && isRunning && lastActivity && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <p className="text-[10px] text-zinc-500 font-mono truncate ml-4 animate-pulse">
            {lastActivity}
          </p>
        </div>
      )}
      {expanded && childTurns.length > 0 && (
        <div className="border-t border-zinc-800/20">
          <div className="divide-y divide-zinc-800/20 max-h-[400px] overflow-y-auto">
            <TurnTree turns={childTurns} />
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkerGroup({ workerId, turns }: { workerId: string; turns: HypeshipConversationTurn[] }) {
  const [expanded, setExpanded] = useState(false);
  const statusTurn = turns.find((turn) => turn.status);
  const placeholderTurn = statusTurn ?? turns.find((turn) => turn.source?.startsWith("worker:"));
  const status = statusTurn?.status;
  const isFinished = status === "complete";
  const shortId = workerId.slice(0, 12);
  const summary = statusTurn?.content;
  const visibleTurns = turns.filter((turn) => turn !== statusTurn || !!turn.content?.trim());
  const stepCount = visibleTurns.length;

  // Skip rendering ghost workers that have no meaningful content
  const hasContent = visibleTurns.some((t) => t.content?.trim());
  if (!hasContent && !summary) return null;

  const isError = status === "error";
  const dotColor = isFinished ? "bg-emerald-400" : isError ? "bg-red-400" : "bg-blue-400";
  const labelColor = isFinished ? "text-emerald-400" : isError ? "text-red-400" : "text-blue-400";
  const borderColor = isFinished ? "border-emerald-400/30" : isError ? "border-red-400/30" : "border-blue-400/30";

  const lastTurn = [...turns]
    .reverse()
    .find((turn) => turn !== statusTurn && !!turn.content?.trim());
  const lastActivity = lastTurn ? getCollapsedTurnPreview(lastTurn) : null;

  return (
    <div className={`border-l-2 ${borderColor} ml-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-900/30 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {!isFinished && !isError && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={`text-[10px] ${labelColor} font-mono shrink-0`}>worker {shortId}</span>
        {summary && !expanded && (
          <span className="text-[10px] text-zinc-400 font-mono truncate">{truncatePreview(summary, 50)}</span>
        )}
        <span className="text-[10px] text-zinc-600 font-mono shrink-0">
          {stepCount > 0
            ? `${stepCount} step${stepCount === 1 ? "" : "s"}${isFinished || isError ? "" : "..."}`
            : isFinished
              ? "done"
              : isError
                ? "error"
                : "working..."}
        </span>
        {placeholderTurn?.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono shrink-0">{timeAgo(placeholderTurn.timestamp)}</span>
        )}
        <span className="text-[10px] text-zinc-700 font-mono ml-auto shrink-0">{expanded ? "▼" : "▶"}</span>
      </button>
      {!expanded && !summary && lastActivity && !isFinished && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <p className={`text-[10px] text-zinc-500 font-mono truncate ml-4 ${!isFinished && !isError ? "animate-pulse" : ""}`}>
            {lastActivity}
          </p>
        </div>
      )}
      {expanded && (
        <div className="border-t border-zinc-800/20">
          <div className="divide-y divide-zinc-800/20 max-h-[500px] overflow-y-auto">
            <TurnTree turns={visibleTurns} />
          </div>
          {summary && (
            <div className="border-t border-zinc-800/30 px-3 py-2">
              <p className="text-[10px] text-zinc-600 font-mono mb-1">summary</p>
              <p className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap">{summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DelegateTaskGroup({ turn, children }: { turn: HypeshipConversationTurn; children: TurnGroup[] }) {
  const [expanded, setExpanded] = useState(true);
  const isRunning = turn.status === "running";
  const isComplete = turn.status === "complete";
  const isError = turn.status === "error";

  const dotColor = isComplete ? "bg-emerald-400" : isError ? "bg-red-400" : "bg-blue-400";
  const labelColor = isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-blue-400";
  const borderColor = isComplete ? "border-emerald-400/20" : isError ? "border-red-400/20" : "border-blue-400/20";

  const toolDetail = getToolDetailSummary(turn.detail);
  const workerCount = children.length;
  const statusLabel = isComplete
    ? "done"
    : isError
      ? "error"
      : workerCount > 0
        ? `${workerCount} worker${workerCount !== 1 ? "s" : ""}...`
        : "working...";

  return (
    <div className={`border-l-2 ${borderColor} ml-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-900/30 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={`text-[10px] ${labelColor} font-mono shrink-0`}>⚡ delegate_task</span>
        {toolDetail && <span className="text-[10px] text-zinc-400 font-mono truncate">{toolDetail}</span>}
        <span className="text-[10px] text-zinc-600 font-mono shrink-0">{statusLabel}</span>
        {turn.timestamp && (
          <span className="text-[10px] text-zinc-700 font-mono shrink-0">{timeAgo(turn.timestamp)}</span>
        )}
        <span className="text-[10px] text-zinc-700 font-mono ml-auto shrink-0">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        children.length > 0 ? (
          <div className="divide-y divide-zinc-800/20">
            {children.map((child) =>
              child.type === "worker" && child.workerId ? (
                <WorkerGroup key={`w-${child.workerId}`} workerId={child.workerId} turns={child.turns} />
              ) : (
                <TurnTree key={`dt-${child.turns[0]?.timestamp}`} turns={child.turns} />
              )
            )}
          </div>
        ) : isRunning ? (
          <div className="px-3 py-2 ml-4">
            <p className="text-[10px] text-zinc-600 font-mono animate-pulse">waiting for workers...</p>
          </div>
        ) : null
      )}
    </div>
  );
}

export function ArtifactsBar({ artifacts }: { artifacts?: HypeshipArtifact[] }) {
  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className="px-3 py-1.5 border-b border-zinc-800/50 flex gap-2 overflow-x-auto">
      {artifacts.map((a, i) => {
        if (a.type === "pull_request" && a.pr_url) {
          return (
            <a
              key={`${a.worker_id}-${a.repo}-${i}`}
              href={a.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">PR</span>
              <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]">
                {a.repo}{a.branch ? `:${a.branch}` : ""}
              </span>
              <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 font-mono">↗</span>
            </a>
          );
        }

        return (
          <span
            key={`${a.worker_id}-${a.repo}-${i}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 border border-zinc-800"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] text-amber-400 font-mono">branch</span>
            <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]">
              {a.repo}{a.branch ? `:${a.branch}` : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Renders a full conversation turn list with worker grouping, delegate task
 * nesting, sub-agent grouping, and recursive child rendering.
 */
export function GroupedConversation({ turns }: { turns: HypeshipConversationTurn[] }) {
  return (
    <div className="divide-y divide-zinc-800/30">
      {groupTurnsByWorker(turns).map((group, gi) =>
        group.type === "delegate" ? (
          <DelegateTaskGroup key={`d-${gi}`} turn={group.turns[0]} children={group.children ?? []} />
        ) : group.type === "worker" && group.workerId ? (
          <WorkerGroup key={`w-${group.workerId}`} workerId={group.workerId} turns={group.turns} />
        ) : (
          <TurnTree key={`m-${gi}`} turns={group.turns} />
        )
      )}
    </div>
  );
}
