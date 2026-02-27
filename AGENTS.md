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

Every action has a keyboard shortcut. New features must include a shortcut.

| Shortcut | Action |
|---|---|
| Cmd+E | Review PR (paste URL, hit enter, launches immediately) |
| Cmd+K | Launch new agent |
| Cmd+Shift+A | Add existing agent to grid |
| Cmd+Shift+X | Close focused pane |
| Cmd+Shift+, | Settings (API key) |
| Cmd+Shift+O | Open PR for focused pane |
| Cmd+Shift+1-9 | Focus pane by number |
| Cmd+Shift+Backspace | Stop focused agent |
| Cmd+Shift+D | Delete focused agent permanently |
| Cmd+Enter | Submit/launch on any form |
| Esc | Close modals, unfocus pane, back to grid from settings |
| Arrow Up/Down | Navigate lists and dropdowns |
| Enter | Select highlighted item in lists |

### tmux aesthetic

- No rounded corners anywhere
- No padding between grid panes — just borders
- Mono font (`font-mono`) for all chrome (labels, buttons, status bar)
- Dark theme only (`bg-zinc-950` base)
- Tiny text for chrome (`text-[10px]` for info bars, `text-xs` for content)
- Status bar at top with pane count and shortcut hints in `[brackets]`
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
src/
  app/
    page.tsx              — main dashboard (grid of panes)
    setup/page.tsx        — API key input
    sw.ts                 — service worker (serwist)
    ~offline/page.tsx     — offline fallback
    api/                  — proxy routes to api.cursor.com
      agents/             — list, create, get, delete, conversation, followup, stop
      branches/           — GitHub branches for repo (for SearchSelect)
      me/                 — API key info
      models/             — available models
      repositories/       — GitHub repos
  components/
    Pane.tsx              — single conversation pane (info bar + messages + follow-up)
    AddAgentModal.tsx     — pick existing agent to pin to grid
    LaunchModal.tsx       — launch new agent (repo, branch, prompt, model)
    FollowUpInput.tsx     — textarea for sending follow-ups
    SearchSelect.tsx      — custom searchable dropdown (replaces <select>)
    StatusBadge.tsx       — status dot with label (pulsing for active)
  lib/
    api.ts                — SWR hooks + mutation helpers
    proxy.ts              — shared proxy-to-cursor helper
    storage.ts            — localStorage helpers
    types.ts              — TypeScript types for Cursor API
    prompts.ts            — pre-built prompts (PR review)
```

## Key Patterns

### Adding a new action

1. Add the handler function in `page.tsx`
2. Add a keyboard shortcut in the `useEffect` key handler
3. Add a `[shortcut label]` button in the top bar
4. If it needs a modal, create it as a component in `components/`

### Adding a new pre-built prompt (like PR review)

1. Add the prompt constant to `src/lib/prompts.ts`
2. Add a quick-launch flow in `page.tsx` (input modal + direct `launchAgent` call)
3. Add a keyboard shortcut and top bar button

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

## Cursor API

The app proxies all Cursor Cloud Agent API endpoints. Auth is Basic Auth with the user's API key. See https://cursor.com/docs/cloud-agent/api/endpoints for the full API reference.

Key behaviors:
- No websocket/SSE — status updates are polled via SWR
- `GET /v0/repositories` has strict rate limits (1/min, 30/hr) — cached aggressively
- Stopping an agent pauses it; sending a follow-up resumes it
- The API returns `linesAdded`, `linesRemoved`, `filesChanged` on finished agents
