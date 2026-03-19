import type { GridItem, Repository } from "./types";

const KEYS = {
  apiKey: "hypeship-cursor-api-key",
  githubToken: "hypeship-github-token",
  githubLogin: "hypeship-github-login",
  grid: "hypeship-cursor-grid",
  repos: "hypeship-repos",
  reposTimestamp: "hypeship-repos-ts",
  branches: "hypeship-branches",
  drafts: "hypeship-drafts",
  soundEnabled: "hypeship-sound-enabled",
  hypeshipApiUrl: "hypeship-api-url",
  hypeshipJwt: "hypeship-jwt",
  hypeshipProdApiKey: "hypeship-prod-api-key",
  hypeshipStagingApiKey: "hypeship-staging-api-key",
  hypeshipView: "hypeship-view",
  hypeshipGrid: "hypeship-grid",
} as const;

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(KEYS.apiKey) ||
    process.env.NEXT_PUBLIC_CURSOR_API_KEY ||
    null
  );
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEYS.apiKey, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(KEYS.apiKey);
}

export function getGithubToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(KEYS.githubToken) ||
    process.env.NEXT_PUBLIC_GITHUB_TOKEN ||
    null
  );
}

export function setGithubToken(token: string): void {
  localStorage.setItem(KEYS.githubToken, token);
}

export function clearGithubToken(): void {
  localStorage.removeItem(KEYS.githubToken);
  localStorage.removeItem(KEYS.githubLogin);
}

export function getGithubLogin(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.githubLogin);
}

export function setGithubLogin(login: string): void {
  localStorage.setItem(KEYS.githubLogin, login);
}

export function getGrid(): GridItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEYS.grid);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setGrid(items: GridItem[]): void {
  localStorage.setItem(KEYS.grid, JSON.stringify(items));
}

export function addToGrid(agentId: string): GridItem[] {
  const grid = getGrid();
  if (grid.some((g) => g.agentId === agentId)) return grid;
  const maxOrder = grid.reduce((max, g) => Math.max(max, g.order), -1);
  const updated = [...grid, { agentId, order: maxOrder + 1 }];
  setGrid(updated);
  return updated;
}

export function removeFromGrid(agentId: string): GridItem[] {
  const updated = getGrid().filter((g) => g.agentId !== agentId);
  setGrid(updated);
  return updated;
}

export function replaceInGrid(oldId: string, newId: string): GridItem[] {
  const grid = getGrid();
  const updated = grid.map((g) =>
    g.agentId === oldId ? { ...g, agentId: newId } : g,
  );
  setGrid(updated);
  return updated;
}

const REPO_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function getCachedRepos(): Repository[] | null {
  if (typeof window === "undefined") return null;
  const ts = localStorage.getItem(KEYS.reposTimestamp);
  if (!ts || Date.now() - Number(ts) > REPO_CACHE_TTL) return null;
  const raw = localStorage.getItem(KEYS.repos);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCachedRepos(repos: Repository[]): void {
  localStorage.setItem(KEYS.repos, JSON.stringify(repos));
  localStorage.setItem(KEYS.reposTimestamp, String(Date.now()));
}

export function clearCachedRepos(): void {
  localStorage.removeItem(KEYS.repos);
  localStorage.removeItem(KEYS.reposTimestamp);
}

// Returns cached repos regardless of TTL (for stale-while-revalidate)
export function getReposFromCache(): Repository[] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEYS.repos);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Branch caching (per-repo, 10 min TTL)
const BRANCH_CACHE_TTL = 10 * 60 * 1000;

interface BranchCacheEntry {
  branches: string[];
  ts: number;
}

function getBranchCacheMap(): Record<string, BranchCacheEntry> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(KEYS.branches);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getCachedBranches(repoUrl: string): string[] | null {
  const entry = getBranchCacheMap()[repoUrl];
  if (!entry || Date.now() - entry.ts > BRANCH_CACHE_TTL) return null;
  return entry.branches;
}

// Returns cached branches regardless of TTL (for stale-while-revalidate)
export function getBranchesFromCache(repoUrl: string): string[] | null {
  return getBranchCacheMap()[repoUrl]?.branches ?? null;
}

export function setCachedBranches(repoUrl: string, branches: string[]): void {
  const cache = getBranchCacheMap();
  cache[repoUrl] = { branches, ts: Date.now() };
  localStorage.setItem(KEYS.branches, JSON.stringify(cache));
}

function getDraftsMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(KEYS.drafts);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getDraft(agentId: string): string {
  return getDraftsMap()[agentId] ?? "";
}

export function setDraft(agentId: string, text: string): void {
  const drafts = getDraftsMap();
  if (text) {
    drafts[agentId] = text;
  } else {
    delete drafts[agentId];
  }
  localStorage.setItem(KEYS.drafts, JSON.stringify(drafts));
}

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(KEYS.soundEnabled);
  return val !== "false"; // enabled by default
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(KEYS.soundEnabled, String(enabled));
}

// ── Hypeship ──

export type HypeshipEnv = "production" | "staging";

export const HYPESHIP_URLS: Record<HypeshipEnv, string> = {
  production: "https://hypeship-production.up.railway.app",
  staging: "https://hypeship-staging.up.railway.app",
};

// Active environment keys — written by activateHypeshipEnv(), read by api.ts
export function getHypeshipApiUrl(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(KEYS.hypeshipApiUrl) ||
    process.env.NEXT_PUBLIC_HYPESHIP_API_URL ||
    null
  );
}

export function setHypeshipApiUrl(url: string): void {
  localStorage.setItem(KEYS.hypeshipApiUrl, url);
}

export function getHypeshipJwt(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(KEYS.hypeshipJwt) ||
    process.env.NEXT_PUBLIC_HYPESHIP_JWT ||
    null
  );
}

export function setHypeshipJwt(jwt: string): void {
  localStorage.setItem(KEYS.hypeshipJwt, jwt);
}

export function clearHypeshipAuth(): void {
  localStorage.removeItem(KEYS.hypeshipApiUrl);
  localStorage.removeItem(KEYS.hypeshipJwt);
}

// Per-environment JWT storage
export function getHypeshipEnvJwt(env: HypeshipEnv): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`hypeship-${env}-jwt`) || null;
}

export function setHypeshipEnvJwt(env: HypeshipEnv, jwt: string): void {
  localStorage.setItem(`hypeship-${env}-jwt`, jwt);
}

export function clearHypeshipEnvAuth(env: HypeshipEnv): void {
  localStorage.removeItem(`hypeship-${env}-jwt`);
  const apiKeyKey =
    env === "production" ? KEYS.hypeshipProdApiKey : KEYS.hypeshipStagingApiKey;
  localStorage.removeItem(apiKeyKey);
}

// Per-environment API key storage
export function getHypeshipApiKey(env: HypeshipEnv): string | null {
  if (typeof window === "undefined") return null;
  const key =
    env === "production" ? KEYS.hypeshipProdApiKey : KEYS.hypeshipStagingApiKey;
  const envVar =
    env === "production"
      ? process.env.NEXT_PUBLIC_HYPESHIP_PROD_API_KEY
      : process.env.NEXT_PUBLIC_HYPESHIP_STAGING_API_KEY;
  return localStorage.getItem(key) || envVar || null;
}

export function setHypeshipApiKey(env: HypeshipEnv, apiKey: string): void {
  const key =
    env === "production" ? KEYS.hypeshipProdApiKey : KEYS.hypeshipStagingApiKey;
  localStorage.setItem(key, apiKey);
}

export function clearHypeshipApiKey(env: HypeshipEnv): void {
  const key =
    env === "production" ? KEYS.hypeshipProdApiKey : KEYS.hypeshipStagingApiKey;
  localStorage.removeItem(key);
}

// Get the active API key (for the currently activated environment)
export function getActiveHypeshipApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const url = getHypeshipApiUrl();
  if (!url) return null;
  const env: HypeshipEnv = url.includes("staging") ? "staging" : "production";
  return getHypeshipApiKey(env);
}

export function activateHypeshipEnv(env: HypeshipEnv): void {
  setHypeshipApiUrl(HYPESHIP_URLS[env]);
  const jwt = getHypeshipEnvJwt(env);
  if (jwt) setHypeshipJwt(jwt);
}

// Per-environment view & grid storage
export type HypeshipView = "dashboard" | "panes";

export function getHypeshipView(env?: HypeshipEnv): HypeshipView {
  if (typeof window === "undefined") return "dashboard";
  const key = env ? `hypeship-${env}-view` : KEYS.hypeshipView;
  const val = localStorage.getItem(key);
  return val === "panes" ? "panes" : "dashboard";
}

export function setHypeshipView(view: HypeshipView, env?: HypeshipEnv): void {
  const key = env ? `hypeship-${env}-view` : KEYS.hypeshipView;
  localStorage.setItem(key, view);
}

export function getHypeshipGrid(env?: HypeshipEnv): GridItem[] {
  if (typeof window === "undefined") return [];
  const key = env ? `hypeship-${env}-grid` : KEYS.hypeshipGrid;
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setHypeshipGrid(items: GridItem[], env?: HypeshipEnv): void {
  const key = env ? `hypeship-${env}-grid` : KEYS.hypeshipGrid;
  localStorage.setItem(key, JSON.stringify(items));
}

export function addToHypeshipGrid(agentId: string, env?: HypeshipEnv): GridItem[] {
  const grid = getHypeshipGrid(env);
  if (grid.some((g) => g.agentId === agentId)) return grid;
  const maxOrder = grid.reduce((max, g) => Math.max(max, g.order), -1);
  const updated = [...grid, { agentId, order: maxOrder + 1 }];
  setHypeshipGrid(updated, env);
  return updated;
}

export function removeFromHypeshipGrid(agentId: string, env?: HypeshipEnv): GridItem[] {
  const updated = getHypeshipGrid(env).filter((g) => g.agentId !== agentId);
  setHypeshipGrid(updated, env);
  return updated;
}
