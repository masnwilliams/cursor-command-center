import type { GridItem, Repository } from "./types";

const KEYS = {
  apiKey: "cursor-agents-api-key",
  githubToken: "cursor-agents-github-token",
  grid: "cursor-agents-grid",
  repos: "cursor-agents-repos",
  reposTimestamp: "cursor-agents-repos-ts",
  branches: "cursor-agents-branches",
  drafts: "cursor-agents-drafts",
} as const;

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.apiKey);
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEYS.apiKey, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(KEYS.apiKey);
}

export function getGithubToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.githubToken);
}

export function setGithubToken(token: string): void {
  localStorage.setItem(KEYS.githubToken, token);
}

export function clearGithubToken(): void {
  localStorage.removeItem(KEYS.githubToken);
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
