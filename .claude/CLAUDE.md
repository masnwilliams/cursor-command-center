# Cursor Command Center

## Overview

Next.js 16 PWA dashboard for managing Hypeship agents and Cursor Cloud Agents. Thin frontend — no backend logic, no database. All API calls proxy through Next.js API routes to external services.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4, SWR, bun
- `src/lib/api.ts` — all data fetching (SWR hooks + mutation helpers)
- `src/lib/hypeship-proxy.ts` — proxy layer to Hypeship backend API
- `src/lib/prompts.ts` — reusable prompt templates for agent tasks
- `src/lib/types.ts` — TypeScript types for both Cursor and Hypeship APIs

## Architecture: Hypeship agent prompts

User messages flow: Dashboard UI -> `sendHypeshipPrompt()` -> `/api/hypeship/agents` (Next.js route) -> `proxyToHypeship()` -> Hypeship backend `/v1/agents`.

The Hypeship backend (not in this repo) handles:
- Spinning up VMs with Claude Code agents
- Injecting system-level instructions via CLAUDE.md in the VM image
- Providing MCP tools (save_artifact, list_artifacts, delegate_task)
- Managing orchestrator/worker lifecycle

This repo does NOT define agent system prompts or MCP tools. It only constructs user-visible prompt text.

## Prompt templates

Reusable prompts live in `src/lib/prompts.ts`. When adding a new prompt template:
1. Export a constant or builder function from `prompts.ts`
2. Import and use it from the component that triggers the agent task
3. Do NOT prepend system-level instructions to user prompts — those belong in the VM-level CLAUDE.md, not in frontend code

## Artifact tracking

Hypeship agents have MCP tools for tracking work artifacts (branches, PRs). The instructions for using these tools belong in the VM-level CLAUDE.md (managed by the Hypeship platform), not prepended to individual prompts from this dashboard.

If agents aren't reliably calling save_artifact, the fix is in:
1. The VM CLAUDE.md (`/home/agent/.claude/CLAUDE.md` in the Hypeship VM image)
2. The MCP tool descriptions on the Hypeship backend
3. NOT in this frontend repo's `api.ts` or `prompts.ts`

## Conventions

- Keyboard-first: all actions via Cmd+K palette, no new shortcuts
- tmux aesthetic: no rounded corners, mono font, dark theme, tiny text
- Use `SearchSelect` instead of native `<select>`
- No server-side state — everything in localStorage via `src/lib/storage.ts`
