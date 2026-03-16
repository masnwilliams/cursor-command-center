# AGENTS.md

## Overview

Cursor Command Center is a tmux-style PWA for managing Cursor Cloud Agents. It provides a grid of live conversation panes, keyboard-driven workflows, and a PR review quick-launcher.

## Tech Stack

- **Next.js 16** (App Router, webpack mode for serwist compatibility)
- **TypeScript**, **Tailwind CSS 4**
- **SWR** for data fetching with polling
- **Serwist** (`@serwist/next`) for PWA service worker
- **react-markdown** + **remark-gfm** for rendering agent messages
- **bun** as package manager

## Design Principles

### Keyboard-first

All actions are accessible through a single command palette (`Cmd+K`).

| Shortcut | Action |
|---|---|
| Cmd+K | Open command palette (launch, add, review, stop, close, delete, settings...) |
| Cmd+Enter | Submit/launch on any form |
| Esc | Close palette, close modals, unfocus pane |
| Arrow Up/Down | Navigate command palette and dropdowns |
| Enter | Select highlighted item |

New features should be added as commands in the palette, not as new shortcuts.

### tmux aesthetic

- No rounded corners anywhere
- No padding between grid panes — just borders
- Mono font (`font-mono`) for all chrome (labels, buttons, status bar)
- Dark theme only (`bg-zinc-950` base)
- Tiny text for chrome (`text-[10px]` for info bars, `text-xs` for content)
- Status bar at top with pane count and `[⌘K]` palette trigger
- Messages use `>` prefix for user, `$` for assistant

### No native form elements

Don't use `<select>`. Use the `SearchSelect` component which supports:
- Searching/filtering
- Arrow key navigation
- Free-text entry (`allowCustom` prop)
- Consistent styling with the rest of the UI

## Architecture

### API proxy layer (`src/app/api/`)

Thin Next.js API routes that proxy to `api.cursor.com`. The client passes the API key via `x-cursor-key` header, the proxy converts it to Basic Auth. This avoids CORS and keeps the key out of browser network logs.

### Client data layer (`src/lib/api.ts`)

SWR hooks with polling:
- Running/creating agents poll every 5s for status
- Conversations refresh every 10s
- Agent list refreshes every 15s
- Repos cached 1hr in localStorage (strict rate limit: 1/min)

### State management

All in `localStorage` via `src/lib/storage.ts`:
- API key
- Grid layout (which agents are pinned, their order)
- Repository cache with TTL

No server-side state, no database. Each device stores its own key and grid.

## File Structure

```
.claude/
  CLAUDE.md               — Claude Code agent instructions for this repo
src/
  app/
    page.tsx              — main dashboard (grid of panes)
    staging/              — Hypeship staging dashboard
    cursor/               — Cursor-specific setup/dashboard
    sw.ts                 — service worker (serwist)
    ~offline/page.tsx     — offline fallback
    api/                  — proxy routes
      agents/             — Cursor Cloud Agent endpoints
      hypeship/           — Hypeship API proxy (agents, secrets, settings, workers)
      branches/           — GitHub branches for repo (for SearchSelect)
      me/                 — API key info
      models/             — available models
      repositories/       — GitHub repos
  components/
    Pane.tsx              — Cursor agent pane (info bar + messages + follow-up)
    HypeshipPane.tsx      — Hypeship agent pane
    HypeshipDashboard.tsx — Hypeship dashboard (agents list, chat, PR reviews)
    HypeshipConversation.tsx — conversation renderer with worker grouping
    CommandPalette.tsx    — Cmd+K command palette (search, arrow nav, enter to select)
    LaunchModal.tsx       — launch new agent (repo, branch, prompt, model)
    SearchSelect.tsx      — custom searchable dropdown (replaces <select>)
    StatusBadge.tsx       — status dot with label (pulsing for active)
  lib/
    api.ts                — SWR hooks + mutation helpers (Cursor + Hypeship)
    proxy.ts              — shared proxy-to-cursor helper
    hypeship-proxy.ts     — proxy-to-hypeship helper
    storage.ts            — localStorage helpers
    types.ts              — TypeScript types for Cursor + Hypeship APIs
    prompts.ts            — pre-built prompt templates (PR review)
```

## Key Patterns

### Adding a new action

1. Add the handler function in `page.tsx`
2. Add a `Command` entry to the `commands` array in `page.tsx` (use `section` for grouping, `destructive` for dangerous actions)
3. If it needs a modal, create it as a component in `components/`
4. Do NOT add a new keyboard shortcut — all actions go through the `Cmd+K` palette

### Adding a new pre-built prompt (like PR review)

1. Add the prompt constant to `src/lib/prompts.ts`
2. Add a quick-launch flow in `page.tsx` (input modal + direct `launchAgent` call)
3. Add a command to the palette

### Custom dropdowns

Always use `SearchSelect` instead of native `<select>`:

```tsx
<SearchSelect
  value={value}
  onChange={setValue}
  options={items.map(i => ({ value: i.id, label: i.name }))}
  placeholder="search..."
  loading={!items.length}
  allowCustom  // enables free-text entry
/>
```

## Commands

```bash
bun install          # install deps
bun run dev          # dev server (webpack mode, port 3000)
bun run build        # production build
bun run format       # prettier
bun run start        # production server
```

## Hypeship Integration

The dashboard also manages Hypeship agents via a separate proxy layer (`src/lib/hypeship-proxy.ts`).

### Prompt flow

User messages flow through: Dashboard UI -> `sendHypeshipPrompt()` in `api.ts` -> `/api/hypeship/agents` route -> `proxyToHypeship()` -> Hypeship backend `/v1/agents`.

The Hypeship backend (not in this repo) spins up VMs with Claude Code agents, injects system instructions via CLAUDE.md in the VM image, and provides MCP tools (`save_artifact`, `list_artifacts`, `delegate_task`).

### Prompt templates

Reusable prompt templates live in `src/lib/prompts.ts`. Current templates:
- `PR_REVIEW_PROMPT` — incremental PR review workflow
- `buildHypeshipPrReviewPrompt()` — constructs PR review prompts with file details

When adding new templates:
1. Export a constant or builder function from `prompts.ts`
2. Import and use it from the component that triggers the agent task
3. Do NOT prepend system-level agent instructions (like "always call save_artifact") to user prompts — those belong in the VM-level CLAUDE.md managed by the Hypeship platform

### Artifact tracking

Hypeship agents track branches and PRs via `save_artifact` / `list_artifacts` MCP tools. These tools are provided by the Hypeship backend, not defined in this repo. The `HypeshipArtifact` type in `types.ts` describes the artifact shape returned by the API.

Agent instructions for when/how to call these tools belong in the Hypeship VM image's CLAUDE.md, not in this frontend codebase. The dashboard only displays artifacts — it doesn't instruct agents on when to save them.

## Cursor API

The app proxies all Cursor Cloud Agent API endpoints. Auth is Basic Auth with the user's API key. See https://cursor.com/docs/cloud-agent/api/endpoints for the full API reference.

Key behaviors:
- No websocket/SSE — status updates are polled via SWR
- `GET /v0/repositories` has strict rate limits (1/min, 30/hr) — cached aggressively
- Stopping an agent pauses it; sending a follow-up resumes it
- The API returns `linesAdded`, `linesRemoved`, `filesChanged` on finished agents
