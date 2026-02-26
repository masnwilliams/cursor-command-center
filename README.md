# Cursor Command Center

A tmux-style dashboard for managing [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent/api/endpoints). View multiple agent conversations side-by-side, send follow-ups, launch new agents, and quick-start PR reviews — all from a keyboard-driven PWA.

## Get Started

**Go to [cmdcenter.dev](https://cmdcenter.dev)**, enter your [Cursor API key](https://cursor.com/dashboard?tab=integrations), and you're in. Install it as a PWA on your phone or desktop for the full app experience.

Or self-host it:

```bash
git clone https://github.com/masnwilliams/cursor-command-center.git
cd cursor-command-center
bun install
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Security

**Your Cursor API key never leaves your browser.** It's stored in `localStorage` on your device and proxied directly to Cursor's API. There is no server-side storage, no database, no analytics, and no third-party services. We never see or store your key. Each device stores its own key independently.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+E` | Quick-launch PR review |
| `Cmd+N` | Launch new agent |
| `Cmd+A` | Add existing agent to grid |
| `Cmd+W` | Close focused pane |
| `Cmd+,` | API key settings |
| `Cmd+1-9` | Focus pane by number |
| `Cmd+Shift+Backspace` | Stop focused agent |
| `Cmd+Enter` | Submit any form |
| `Esc` | Close modal / unfocus / back |
| `↑ ↓` | Navigate lists and dropdowns |

## Features

- **Tmux-style grid** — multiple agent conversations visible at once, no wasted space
- **PR review quick-launch** — `Cmd+E`, paste a PR URL, hit Enter. Agent launches with an incremental review prompt and starts presenting chunks for your feedback
- **Live polling** — running agents update automatically (status every 5s, conversation every 10s)
- **Follow-up input** on every pane — interact with agents without leaving the grid
- **Installable PWA** — works as a standalone app on desktop and mobile
- **Fully keyboard-driven** — every action has a shortcut

## Commands

```bash
bun install       # install dependencies
bun run dev       # dev server (port 3000)
bun run build     # production build
bun run format    # prettier
bun run start     # production server
```
