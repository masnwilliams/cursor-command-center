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
      {
        id: "m5",
        type: "user_message",
        text: "Can you also respect the system preference as the default? Use prefers-color-scheme media query.",
      },
      {
        id: "m6",
        type: "assistant_message",
        text: "Absolutely. I've updated the `useDarkMode` hook to check `window.matchMedia('(prefers-color-scheme: dark)')` on first load when there's no localStorage value set.\n\nHere's the updated logic:\n\n```ts\nfunction getInitialTheme(): 'dark' | 'light' {\n  const stored = localStorage.getItem('theme');\n  if (stored === 'dark' || stored === 'light') return stored;\n  return window.matchMedia('(prefers-color-scheme: dark)').matches\n    ? 'dark'\n    : 'light';\n}\n```\n\nI've also added a `matchMedia` listener so if the user changes their OS preference while the app is open, it updates live (unless they've manually overridden it).",
      },
      {
        id: "m7",
        type: "user_message",
        text: "Nice. What about a \"system\" option in the toggle? So it's three-way: light, dark, system.",
      },
      {
        id: "m8",
        type: "assistant_message",
        text: "Great idea — I've converted the toggle into a three-way segmented control:\n\n| Option | Behavior |\n|--------|----------|\n| Light  | Forces light mode, saves `'light'` to localStorage |\n| Dark   | Forces dark mode, saves `'dark'` to localStorage |\n| System | Removes localStorage key, follows OS preference in real-time |\n\nThe component now uses a `SegmentedControl` with three buttons. The active segment has a sliding indicator behind it (animated with `transition-transform`). When \"System\" is selected, I also show a small label underneath: \"Following system preference\" with the current resolved value.\n\nI updated the hook to store `'system' | 'light' | 'dark'` and resolve it accordingly. The `<html>` class still gets just `.dark` or nothing — the three-way state is only in the UI/storage layer.\n\nRunning the existing tests now to make sure nothing broke...",
      },
      {
        id: "m9",
        type: "user_message",
        text: "Perfect. Also add a keyboard shortcut — Cmd+Shift+D to toggle between modes.",
      },
      {
        id: "m10",
        type: "assistant_message",
        text: "Done. Added a global `keydown` listener in the `useDarkMode` hook:\n\n- `Cmd+Shift+D` cycles through: system → light → dark → system\n- The shortcut works from anywhere in the app\n- I added it to the keyboard shortcuts help modal too\n\nI also made sure it doesn't fire when the user is typing in an input or textarea to avoid conflicts.\n\nAll 47 existing tests still pass. The dark mode toggle is fully functional with:\n- Three-way segmented control (light / dark / system)\n- System preference detection + live updates\n- Smooth CSS transitions on the toggle and the page\n- `Cmd+Shift+D` keyboard shortcut\n- localStorage persistence\n\nPushing the changes now...",
      },
      {
        id: "m11",
        type: "user_message",
        text: "One more thing — can you add a subtle animation when the page transitions between light and dark? Like a circular reveal from the toggle button position.",
      },
      {
        id: "m12",
        type: "assistant_message",
        text: "That's a fun one! I'm implementing a circular clip-path reveal animation. Here's the approach:\n\n1. When the user toggles, I capture the click coordinates (or the toggle button center for keyboard shortcut)\n2. Clone the current page state as a snapshot overlay\n3. Apply the new theme underneath\n4. Animate a `clip-path: circle()` on the overlay from 0 to full viewport diagonal\n5. Remove the overlay when the animation completes\n\nUsing the View Transitions API where supported (`document.startViewTransition`), falling back to a manual CSS animation for other browsers.\n\nThe animation takes 400ms with an `ease-out` curve. Working on getting the coordinates right for the keyboard shortcut case — I'm using `getBoundingClientRect()` on the toggle button as the origin point.\n\nCurrently testing cross-browser compatibility...",
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
        text: "I'll start the Tailwind v4 migration. Let me first audit the current setup to understand the scope.\n\n**Current state:**\n- `tailwind.config.ts` with 14 theme extensions\n- 3 custom plugins (typography, forms, animated gradients)\n- 34 files using Tailwind utilities\n- PostCSS config with `tailwindcss` and `autoprefixer`\n\nLet me begin with the config file conversion...",
      },
      {
        id: "m3",
        type: "user_message",
        text: "Make sure to handle the divide utilities — we use those heavily in the table components.",
      },
      {
        id: "m4",
        type: "assistant_message",
        text: "Good callout. I've specifically audited divide utility usage and found it in 3 components:\n\n- `DataTable.tsx` — uses `divide-y divide-zinc-200`\n- `SettingsList.tsx` — uses `divide-y divide-gray-100`\n- `Sidebar.tsx` — uses `divide-x divide-gray-200`\n\nIn Tailwind v4, `divide-*` utilities work the same way but the implementation changed from `> * + *` selectors to `:where()` selectors. This means they should work out of the box, but I'll verify each one after the migration.\n\nStarting the config conversion now...",
      },
      {
        id: "m5",
        type: "assistant_message",
        text: "Config conversion complete. Here's what changed:\n\n**Before (`tailwind.config.ts`):**\n```ts\nexport default {\n  content: ['./src/**/*.{ts,tsx}'],\n  darkMode: 'class',\n  theme: { extend: { ... } },\n  plugins: [typography, forms, gradients],\n}\n```\n\n**After (`app.css` with `@theme`):**\n```css\n@import 'tailwindcss';\n@theme {\n  --color-brand: #6366f1;\n  --font-sans: 'Inter', sans-serif;\n  /* ...14 more tokens */\n}\n```\n\nThe `darkMode: 'class'` config is no longer needed — Tailwind v4 uses `@media (prefers-color-scheme: dark)` by default, but since we have a manual toggle, I added `@custom-variant dark (&.dark)` to preserve the class-based approach.\n\nMoving on to utility replacements across 34 files...",
      },
      {
        id: "m6",
        type: "user_message",
        text: "How are the custom plugins looking? Especially the animated gradients one — that was complex.",
      },
      {
        id: "m7",
        type: "assistant_message",
        text: "The animated gradients plugin required the most work. Here's the breakdown:\n\n**Typography plugin** — Migrated cleanly. The `@plugin` directive replaces the old `require()` syntax. All prose styles preserved.\n\n**Forms plugin** — Also straightforward. Reset styles now use `@layer base` instead of the plugin API.\n\n**Animated gradients plugin** — This was tricky:\n\n1. The old plugin used `addUtilities()` with dynamic class generation. In v4, I converted these to custom utilities using `@utility`:\n```css\n@utility gradient-shimmer {\n  background: linear-gradient(\n    90deg,\n    var(--color-brand) 0%,\n    var(--color-brand-light) 50%,\n    var(--color-brand) 100%\n  );\n  background-size: 200% 100%;\n  animation: shimmer 2s infinite;\n}\n```\n\n2. The `matchUtilities()` call for dynamic gradient angles was replaced with CSS custom properties: `--gradient-angle: 45deg` etc.\n\n3. Keyframe definitions moved from the plugin to a `@keyframes` block in the CSS.\n\nAll gradient animations render identically. I verified by visual comparison on the landing page hero section.\n\nNow doing the final pass on utility class replacements...",
      },
      {
        id: "m8",
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
      {
        id: "m3",
        type: "user_message",
        text: "The memory leak concern is valid. Can you suggest a specific implementation fix?",
      },
      {
        id: "m4",
        type: "assistant_message",
        text: "Here's a concrete fix for the memory leak. The current code stores every IP address forever:\n\n```ts\n// Current (leaky)\nconst store = new Map<string, { count: number; resetAt: number }>();\n\nfunction increment(key: string) {\n  const entry = store.get(key) || { count: 0, resetAt: Date.now() + windowMs };\n  entry.count++;\n  store.set(key, entry);\n  return entry;\n}\n```\n\n**Recommended fix — add a cleanup interval:**\n\n```ts\nconst store = new Map<string, { count: number; resetAt: number }>();\n\n// Evict expired entries every 60s\nsetInterval(() => {\n  const now = Date.now();\n  for (const [key, entry] of store) {\n    if (entry.resetAt <= now) store.delete(key);\n  }\n}, 60_000);\n```\n\nAlternatively, for a zero-maintenance approach, use a `WeakRef`-based TTL cache or switch to `ioredis` with `SETEX` which handles expiry natively.\n\nFor the atomicity issue, wrap the increment in a simple mutex or use `INCR` if you switch to Redis — it's atomic by default.\n\nI've left these as review comments on the PR.",
      },
      {
        id: "m5",
        type: "user_message",
        text: "What about the sliding window algorithm? Is their implementation correct?",
      },
      {
        id: "m6",
        type: "assistant_message",
        text: "Their sliding window implementation has a subtle bug. They're using a fixed-window approach but calling it \"sliding window\" in the docs.\n\n**What they implemented (fixed window):**\n- Window resets at exact intervals (e.g., every 60s)\n- A client could make 100 requests at 0:59 and 100 more at 1:01, getting 200 requests in 2 seconds\n\n**True sliding window approach:**\n```ts\nfunction isRateLimited(key: string): boolean {\n  const now = Date.now();\n  const windowStart = now - windowMs;\n  \n  // Get requests in current window\n  const requests = store.get(key) || [];\n  \n  // Filter to only requests within the window\n  const recent = requests.filter(ts => ts > windowStart);\n  \n  if (recent.length >= maxRequests) return true;\n  \n  recent.push(now);\n  store.set(key, recent);\n  return false;\n}\n```\n\nThe tradeoff is memory — storing individual timestamps vs. a single counter. For most APIs, the fixed-window approach is fine and the burst at window boundaries is acceptable. But if they want true sliding window semantics, they need this change.\n\nI'd recommend they either:\n1. Rename their approach to \"fixed window\" in the docs, or\n2. Implement the actual sliding window with timestamp arrays\n\nAdded this to the PR review comments as well.",
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
        type: "user_message",
        text: "Also add a base repository class with common CRUD methods that other repositories can extend.",
      },
      {
        id: "m4",
        type: "assistant_message",
        text: "Good idea. I've created `src/repositories/BaseRepository.ts`:\n\n```ts\nabstract class BaseRepository<T, CreateDTO, UpdateDTO> {\n  constructor(protected readonly prisma: PrismaClient) {}\n  \n  abstract findById(id: string): Promise<T | null>;\n  abstract create(data: CreateDTO): Promise<T>;\n  abstract update(id: string, data: UpdateDTO): Promise<T>;\n  abstract delete(id: string): Promise<void>;\n  \n  async findMany(where?: Partial<T>): Promise<T[]> { ... }\n  async count(where?: Partial<T>): Promise<number> { ... }\n  async exists(id: string): Promise<boolean> { ... }\n}\n```\n\n`UserRepository` and `PostRepository` now extend this base class. The common `findMany`, `count`, and `exists` methods are inherited, while model-specific queries are implemented in each subclass.\n\nUpdated 7 files to use the new repositories instead of direct Prisma calls.",
      },
      {
        id: "m5",
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
        text: "I'll create the deployment pipeline. Let me first check the existing CI configuration and infrastructure setup.\n\nFound:\n- No existing GitHub Actions workflows\n- `Dockerfile` in root (multi-stage build)\n- AWS CDK stack in `infra/` directory\n- ECS Fargate cluster defined in `infra/lib/stack.ts`\n\nI'll create a pipeline that:\n1. Builds and tests on every PR\n2. Deploys to staging on merge to `develop`\n3. Deploys to production on merge to `main` with manual approval gate",
      },
      {
        id: "m3",
        type: "user_message",
        text: "Use OIDC for AWS auth instead of static credentials. We don't want long-lived keys.",
      },
      {
        id: "m4",
        type: "assistant_message",
        text: "Smart — OIDC is much better for CI. I'm setting up the workflow to use `aws-actions/configure-aws-credentials` with OIDC:\n\n```yaml\npermissions:\n  id-token: write\n  contents: read\n\nsteps:\n  - uses: aws-actions/configure-aws-credentials@v4\n    with:\n      role-to-assume: arn:aws:iam::role/GitHubActionsRole\n      aws-region: us-east-1\n```\n\nHowever, this requires an IAM OIDC provider and role to be set up in AWS first. I've created a CDK construct for this at `infra/lib/github-oidc.ts` that provisions:\n- The OIDC identity provider for `token.actions.githubusercontent.com`\n- An IAM role with trust policy scoped to your specific repo\n- Permissions for ECR push and ECS deploy\n\nBut I hit an error — the repository doesn't have the required secrets configured (`AWS_ACCOUNT_ID`, `AWS_REGION`). The OIDC role ARN also needs to be set. Unable to proceed without these values to complete the workflow configuration.",
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
      {
        id: "m3",
        type: "user_message",
        text: "Make sure the mock server validates webhook signatures for each provider — they all have different signing mechanisms.",
      },
      {
        id: "m4",
        type: "assistant_message",
        text: "Absolutely. Here's how each provider handles webhook signature verification:\n\n**Stripe** — HMAC-SHA256 with `whsec_` prefixed secret. The signature is in the `Stripe-Signature` header with format `t=timestamp,v1=signature`. I'm using `stripe.webhooks.constructEvent()` in tests to generate valid signatures.\n\n**PayPal** — Uses certificate-based verification. The webhook sends a `PAYPAL-CERT-URL` header pointing to PayPal's signing cert. In tests, I'm mocking the cert endpoint and generating valid PKCS7 signatures.\n\n**Square** — HMAC-SHA256 with the signature in `x-square-hmacsha256-signature`. Simpler than Stripe — just `HMAC(webhook_url + body, signature_key)`.\n\nAll three mock servers now validate signatures and reject requests with invalid or missing signatures. Added negative test cases too:\n\n```ts\nit('rejects Stripe webhooks with tampered body', async () => {\n  const res = await sendWebhook({\n    provider: 'stripe',\n    body: tamperedPayload,\n    signature: originalSignature, // won't match\n  });\n  expect(res.status).toBe(400);\n  expect(res.body.error).toBe('Invalid signature');\n});\n```\n\nMoving on to Stripe refund event tests...",
      },
      {
        id: "m5",
        type: "user_message",
        text: "How are you handling the subscription lifecycle events? Those are the most complex — especially upgrade/downgrade mid-cycle.",
      },
      {
        id: "m6",
        type: "assistant_message",
        text: "Good question — subscription lifecycle is the most complex part. Here's my test matrix:\n\n| Event | Stripe | PayPal | Square |\n|-------|--------|--------|--------|\n| `subscription.created` | ✅ | ✅ | ✅ |\n| `subscription.updated` (upgrade) | ✅ | ✅ | N/A |\n| `subscription.updated` (downgrade) | ✅ | ✅ | N/A |\n| `subscription.cancelled` | ✅ | ✅ | ✅ |\n| `subscription.paused` | ✅ | ✅ | N/A |\n| `subscription.resumed` | ✅ | ✅ | N/A |\n| `invoice.payment_failed` (retry) | ✅ | N/A | N/A |\n| `subscription.trial_end` | ✅ | ✅ | N/A |\n\nFor mid-cycle upgrades/downgrades, I'm testing:\n\n1. **Proration calculation** — When a user upgrades from $10/mo to $20/mo halfway through the cycle, we should charge ~$5 for the remainder\n2. **Plan switching** — The webhook should update the user's plan immediately but keep the billing cycle the same\n3. **Feature access** — After an upgrade webhook, the user should immediately have access to the higher-tier features\n4. **Downgrade at period end** — Downgrades should schedule for the end of the current period, not take effect immediately\n\nEach scenario has fixtures with realistic timestamps and amounts. Currently at 47 test cases across all providers.\n\nSquare doesn't support subscription modifications via webhooks — they use a polling model instead, so I've added a note about that in the test docs.",
      },
      {
        id: "m7",
        type: "assistant_message",
        text: "Stripe refund tests are done. Added 8 test cases covering:\n- Full refunds\n- Partial refunds\n- Refund failures (insufficient balance)\n- Refund with reason codes\n\nNow starting on PayPal webhook integration...",
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
};

export default function TestPage() {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const paneCount = FAKE_AGENTS.length;

  function handleRemove(id: string) {
    if (focusedId === id) setFocusedId(null);
  }

  return (
    <div className="h-dvh bg-zinc-950 flex flex-col overflow-hidden">
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
