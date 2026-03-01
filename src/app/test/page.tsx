"use client";

import { useState } from "react";
import type {
  Agent,
  ConversationResponse,
} from "@/lib/types";
import { Pane } from "@/components/Pane";

function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

const FAKE_AGENTS: Agent[] = [
  {
    id: "agent-001-running-feature",
    name: "Add dark mode toggle",
    status: "RUNNING",
    source: {
      repository: "https://github.com/acme/web-app",
      ref: "main",
    },
    target: {
      branchName: "feature/dark-mode-toggle",
      autoCreatePr: true,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: "agent-002-creating",
    name: "Fix auth middleware",
    status: "CREATING",
    source: {
      repository: "https://github.com/acme/api-server",
      ref: "develop",
    },
    target: {
      branchName: "fix/auth-middleware-redirect",
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 5_000).toISOString(),
  },
  {
    id: "agent-003-finished-pr",
    name: "Migrate to Tailwind v4",
    status: "FINISHED",
    source: {
      repository: "https://github.com/acme/web-app",
      ref: "main",
    },
    target: {
      branchName: "chore/tailwind-v4-migration",
      url: "https://github.com/acme/web-app/tree/chore/tailwind-v4-migration",
      prUrl: "https://github.com/acme/web-app/pull/342",
      autoCreatePr: true,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    summary: "Migrated all utility classes from Tailwind v3 to v4 syntax.",
    createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    linesAdded: 847,
    linesRemoved: 612,
    filesChanged: 34,
  },
  {
    id: "agent-004-pr-review",
    name: "Review PR #128",
    status: "FINISHED",
    source: {
      repository: "https://github.com/acme/api-server",
      prUrl: "https://github.com/acme/api-server/pull/128",
    },
    target: {
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    linesAdded: 0,
    linesRemoved: 0,
    filesChanged: 0,
  },
  {
    id: "agent-005-stopped",
    name: "Refactor database layer",
    status: "STOPPED",
    source: {
      repository: "https://github.com/acme/api-server",
      ref: "main",
    },
    target: {
      branchName: "refactor/db-layer",
      url: "https://github.com/acme/api-server/tree/refactor/db-layer",
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    linesAdded: 156,
    linesRemoved: 89,
    filesChanged: 7,
  },
  {
    id: "agent-006-error",
    name: "Deploy pipeline setup",
    status: "ERROR",
    source: {
      repository: "https://github.com/acme/infra",
      ref: "main",
    },
    target: {
      branchName: "ci/deploy-pipeline",
      autoCreatePr: true,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: "agent-007-running-long-names",
    name: "Implement comprehensive integration test suite for payment processing webhooks",
    status: "RUNNING",
    source: {
      repository: "https://github.com/acme-corporation/enterprise-payment-gateway",
      ref: "release/v2.4.0-beta",
    },
    target: {
      branchName: "test/payment-webhook-integration-tests-comprehensive-suite",
      autoCreatePr: true,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: "agent-008-finished-minimal",
    name: "",
    status: "FINISHED",
    source: {
      repository: "https://github.com/acme/docs",
    },
    target: {
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    linesAdded: 12,
    linesRemoved: 3,
    filesChanged: 1,
  },
  {
    id: "agent-009-long-user-msg",
    name: "Long user message test",
    status: "RUNNING",
    source: {
      repository: "https://github.com/acme/web-app",
      ref: "main",
    },
    target: {
      branchName: "test/long-message",
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
];

const FAKE_CONVERSATIONS: Record<string, ConversationResponse> = {
  "agent-001-running-feature": {
    id: "conv-001",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Add a dark mode toggle to the settings page. It should persist the preference in localStorage and apply a .dark class to the html element.",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "I'll add a dark mode toggle to the settings page. Let me start by examining the current settings component and the Tailwind configuration.\n\nI've found the settings page at `src/components/Settings.tsx`. I'll now:\n\n1. Add a `useDarkMode` hook that reads/writes to localStorage\n2. Create a toggle switch component\n3. Wire it into the settings page\n4. Update `tailwind.config.ts` to use `class` strategy\n\nWorking on the hook first...",
      },
      {
        id: "m3",
        type: "user_message",
        text: "Make sure the toggle has a smooth transition animation",
      },
      {
        id: "m4",
        type: "assistant_message",
        text: "Good call. I've added a CSS transition to the toggle switch — it now slides with a `transition-transform duration-200` and the background fades between colors with `transition-colors duration-300`.\n\nI'm also adding a `transition-colors` to the `<html>` element so that background and text colors transition smoothly when switching modes.\n\nCurrently updating the global styles...",
      },
    ],
  },
  "agent-002-creating": {
    id: "conv-002",
    messages: [],
  },
  "agent-003-finished-pr": {
    id: "conv-003",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Migrate all components from Tailwind v3 to v4. Update the config file, replace deprecated utilities, and ensure all custom plugins still work.",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "I've completed the Tailwind v4 migration across 34 files. Here's a summary:\n\n**Config changes:**\n- Converted `tailwind.config.ts` to the new CSS-based config format\n- Moved theme extensions to `@theme` blocks\n- Updated plugin syntax\n\n**Utility replacements:**\n- `bg-opacity-*` → `bg-{color}/{opacity}`\n- `ring-opacity-*` → `ring-{color}/{opacity}`\n- Removed `purge` config (now automatic)\n\n**Breaking changes handled:**\n- Updated `@apply` directives that used removed utilities\n- Fixed `divide-*` usage in 3 components\n- Replaced `space-*` with gap utilities where appropriate\n\nAll existing tests pass. Created PR #342.",
      },
    ],
  },
  "agent-004-pr-review": {
    id: "conv-004",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Review this PR: https://github.com/acme/api-server/pull/128",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "## PR Review: Add rate limiting middleware (#128)\n\n**Overall:** Solid implementation with a few concerns.\n\n### Issues\n\n- **Memory leak risk** — The in-memory store in `src/middleware/rateLimit.ts:24` never evicts expired entries. Consider using a TTL map or Redis.\n- **Race condition** — The `increment()` call on line 47 isn't atomic. Under high concurrency, clients could exceed the limit.\n- **Missing tests** — No test coverage for the sliding window edge case.\n\n### Suggestions\n\n- Extract the `429` response body to a constant\n- Add `Retry-After` header to rate-limited responses\n- Consider using `ioredis` for production — the in-memory approach won't work with multiple instances\n\n### Nits\n\n- `rateLimit.ts:12` — unused import `Request` from express\n- Inconsistent naming: `maxReqs` vs `maxRequests` across files\n\n**Verdict:** Request changes — fix the memory leak and add basic tests before merging.",
      },
    ],
  },
  "agent-005-stopped": {
    id: "conv-005",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Refactor the database layer to use the repository pattern. Start with the User and Post models.",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "I'll refactor the database layer to use the repository pattern. Starting with the `User` model.\n\nCreated `src/repositories/UserRepository.ts` with methods:\n- `findById(id: string)`\n- `findByEmail(email: string)`\n- `create(data: CreateUserDTO)`\n- `update(id: string, data: UpdateUserDTO)`\n- `delete(id: string)`\n\nNow working on `PostRepository`...",
      },
      {
        id: "m3",
        type: "assistant_message",
        text: "Created `PostRepository` with the same pattern. Updated 7 files to use the new repositories instead of direct Prisma calls.\n\nI was about to update the service layer when the agent was stopped.",
      },
    ],
  },
  "agent-006-error": {
    id: "conv-006",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Set up a GitHub Actions deploy pipeline with staging and production environments.",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "I'll create the deployment pipeline. Setting up the workflow files now...\n\nI've created `.github/workflows/deploy.yml` with:\n- Build step with caching\n- Staging deploy on push to `develop`\n- Production deploy on push to `main` with manual approval\n\nEncountered an error while trying to validate the workflow syntax — the repository doesn't have the required secrets configured (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). Unable to proceed without these credentials.",
      },
    ],
  },
  "agent-007-running-long-names": {
    id: "conv-007",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Create a comprehensive integration test suite for the payment processing webhooks. Cover Stripe, PayPal, and Square. Each provider should have tests for successful payments, refunds, disputes, and subscription lifecycle events.",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "I'm setting up the test infrastructure. Creating test fixtures and mock servers for each payment provider.\n\n**Progress:**\n- [x] Test harness with mock HTTP server\n- [x] Stripe webhook signature verification tests\n- [x] Stripe payment_intent.succeeded tests\n- [ ] Stripe refund events\n- [ ] PayPal webhooks\n- [ ] Square webhooks\n\nCurrently implementing Stripe refund event handlers...",
      },
    ],
  },
  "agent-008-finished-minimal": {
    id: "conv-008",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "Fix typo in README",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "Fixed the typo on line 23: \"recieve\" → \"receive\".",
      },
    ],
  },
  "agent-009-long-user-msg": {
    id: "conv-009",
    messages: [
      {
        id: "m1",
        type: "user_message",
        text: "I need you to do a full refactor of the authentication system. Here are the detailed requirements:\n\n1. Replace the current JWT implementation with short-lived access tokens (15 min) and long-lived refresh tokens (7 days) stored in httpOnly cookies.\n2. Add a /auth/refresh endpoint that issues new access tokens using the refresh token.\n3. Implement token rotation — each time a refresh token is used, invalidate it and issue a new one.\n4. Store refresh token families in the database so we can detect reuse and revoke the entire family.\n5. Add rate limiting on /auth/login — max 5 attempts per minute per IP, with exponential backoff.\n6. Implement CSRF protection using the double-submit cookie pattern for all state-changing requests.\n7. Add an /auth/logout endpoint that clears cookies and revokes the current refresh token family.\n8. Update all existing middleware to validate the new short-lived access tokens.\n9. Make sure all error responses follow RFC 7807 problem details format.\n10. Add comprehensive test coverage for all the above — unit tests for token logic, integration tests for the endpoints, and E2E tests for the full login/refresh/logout flow.\n11. Update the API documentation with the new auth flow diagrams.\n12. Ensure backward compatibility with existing mobile clients for at least 2 weeks via a legacy header fallback.",
      },
      {
        id: "m2",
        type: "assistant_message",
        text: "That's a comprehensive auth overhaul. I'll break this down into phases and start with the token infrastructure.\n\n**Phase 1 — Token layer:**\n- Implementing short-lived access tokens (15 min) and refresh tokens (7 days)\n- Setting up httpOnly cookie configuration\n- Creating the refresh token family schema in the database\n\n**Phase 2 — Endpoints:**\n- `/auth/refresh` with token rotation\n- `/auth/logout` with family revocation\n- Rate limiting on `/auth/login`\n\n**Phase 3 — Middleware & protection:**\n- CSRF double-submit cookie\n- Updated auth middleware\n- Legacy header fallback\n\n**Phase 4 — Tests & docs:**\n- Unit, integration, and E2E coverage\n- Updated API docs with flow diagrams\n\nStarting with the token layer now...",
      },
    ],
  },
};

export default function TestPage() {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const paneCount = FAKE_AGENTS.length;

  function handleRemove(id: string) {
    if (focusedId === id) setFocusedId(null);
  }

  return (
    <div className="h-full bg-zinc-950 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-0.5 bg-zinc-900/60 shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono">
          cursor-agents — {paneCount} pane{paneCount !== 1 ? "s" : ""} — test
          mode
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-500/80 font-mono">
            [hardcoded data]
          </span>
          <a
            href="/"
            className="text-[10px] text-zinc-600 hover:text-zinc-300 font-mono"
          >
            [← dashboard]
          </a>
        </div>
      </div>

      <div
        className={`flex-1 grid ${gridCols(paneCount)} auto-rows-fr min-h-0 overflow-hidden`}
      >
        {FAKE_AGENTS.map((agent) => (
          <Pane
            key={agent.id}
            agent={agent}
            focused={focusedId === agent.id}
            onFocus={() => setFocusedId(agent.id)}
            onClose={() => handleRemove(agent.id)}
            onDelete={() => handleRemove(agent.id)}
            conversation={FAKE_CONVERSATIONS[agent.id]}
          />
        ))}
      </div>
    </div>
  );
}
