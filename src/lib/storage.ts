import type { GridItem, Repository } from "./types";

const KEYS = {
  apiKey: "cursor-agents-api-key",
  grid: "cursor-agents-grid",
  repos: "cursor-agents-repos",
  reposTimestamp: "cursor-agents-repos-ts",
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
