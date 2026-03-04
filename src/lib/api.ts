import useSWR, { mutate } from "swr";
import type {
  Agent,
  AgentListResponse,
  ConversationResponse,
  FollowUpRequest,
  LaunchAgentRequest,
  MeResponse,
  ModelsResponse,
  PrFilesResponse,
  PrStatusResponse,
  RepositoriesResponse,
  ReviewRequestsResponse,
  HypeshipWorkContextListResponse,
  HypeshipWorkContextResponse,
  HypeshipCreateWorkContextRequest,
  HypeshipUpdateStateRequest,
  HypeshipHealthResponse,
} from "./types";
import {
  getApiKey,
  getGithubToken,
  getGithubLogin,
  setGithubLogin,
  getCachedRepos,
  setCachedRepos,
  clearCachedRepos,
  getReposFromCache,
  getCachedBranches,
  getBranchesFromCache,
  setCachedBranches,
  getHypeshipApiUrl,
  getHypeshipJwt,
} from "./storage";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = getApiKey();
  if (key) h["x-cursor-key"] = key;
  const ghToken = getGithubToken();
  if (ghToken) h["x-github-token"] = ghToken;
  const ghLogin = getGithubLogin();
  if (ghLogin) h["x-github-login"] = ghLogin;
  return h;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// Agents list
export function useAgents(limit = 100) {
  return useSWR<AgentListResponse>(
    `/api/agents?limit=${limit}`,
    fetcher<AgentListResponse>,
    { refreshInterval: 15_000 },
  );
}

// Single agent
export function useAgent(id: string | null) {
  const { data, ...rest } = useSWR<Agent>(
    id ? `/api/agents/${id}` : null,
    fetcher<Agent>,
    {
      refreshInterval: (data) => {
        if (!data) return 2_000;
        return data.status === "RUNNING" || data.status === "CREATING"
          ? 2_000
          : 0;
      },
    },
  );
  return { data, ...rest };
}

// Conversation — polls fast while agent is active, stops when done
export function useConversation(id: string | null, active = true) {
  const { data, ...rest } = useSWR<ConversationResponse>(
    id ? `/api/agents/${id}/conversation` : null,
    fetcher<ConversationResponse>,
    { refreshInterval: active ? 2_000 : 0 },
  );
  return { data, ...rest };
}

// Me
export function useMe() {
  return useSWR<MeResponse>("/api/me", fetcher<MeResponse>, {
    revalidateOnFocus: false,
  });
}

// Models
export function useModels() {
  return useSWR<ModelsResponse>("/api/models", fetcher<ModelsResponse>, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
  });
}

// Repositories (stale-while-revalidate via localStorage)
export function useRepositories() {
  const result = useSWR<RepositoriesResponse>(
    "/api/repositories",
    async (url: string) => {
      const cached = getCachedRepos();
      if (cached) return { repositories: cached };
      const data = await fetcher<RepositoriesResponse>(url);
      setCachedRepos(data.repositories);
      return data;
    },
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const stale = typeof window !== "undefined" ? getReposFromCache() : null;
  const data = result.data ?? (stale ? { repositories: stale } : undefined);

  function refresh() {
    clearCachedRepos();
    result.mutate();
  }

  return { ...result, data, refresh };
}

// Branches (stale-while-revalidate via localStorage)
export function useBranches(repoUrl: string | null) {
  const result = useSWR<{ branches: string[] }>(
    repoUrl ? `/api/branches?repo=${encodeURIComponent(repoUrl)}` : null,
    async (url: string) => {
      if (repoUrl) {
        const cached = getCachedBranches(repoUrl);
        if (cached) return { branches: cached };
      }
      const data = await fetcher<{ branches: string[] }>(url);
      if (repoUrl) setCachedBranches(repoUrl, data.branches);
      return data;
    },
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const stale = repoUrl ? getBranchesFromCache(repoUrl) : null;
  const data = result.data ?? (stale ? { branches: stale } : undefined);

  return { ...result, data };
}

// PR review requests (polls every 60s)
export function useReviewRequests() {
  return useSWR<ReviewRequestsResponse>(
    "/api/review-requests",
    fetcher<ReviewRequestsResponse>,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
}

// PR status (from GitHub API, polls every 30s — mutations trigger instant revalidation)
export function usePrStatus(prUrl: string | undefined) {
  return useSWR<PrStatusResponse>(
    prUrl ? `/api/pr-status?url=${encodeURIComponent(prUrl)}` : null,
    fetcher<PrStatusResponse>,
    { revalidateOnFocus: false, dedupingInterval: 30_000, refreshInterval: 30_000 },
  );
}

// PR files (from GitHub API, fetched once when expanded)
export function usePrFiles(prUrl: string | undefined | null) {
  return useSWR<PrFilesResponse>(
    prUrl ? `/api/pr-files?url=${encodeURIComponent(prUrl)}` : null,
    fetcher<PrFilesResponse>,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
}

// Mutations
export async function launchAgent(body: LaunchAgentRequest): Promise<Agent> {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const agent = await res.json();
  mutate("/api/agents?limit=100");
  return agent;
}

export async function sendFollowUp(
  id: string,
  body: FollowUpRequest,
): Promise<void> {
  const res = await fetch(`/api/agents/${id}/followup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  mutate(`/api/agents/${id}/conversation`);
  mutate(`/api/agents/${id}`);
}

export async function stopAgent(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${id}/stop`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  mutate(`/api/agents/${id}`);
  mutate("/api/agents?limit=100");
}


export async function mergePr(
  prUrl: string,
  mergeMethod: "squash" | "merge" | "rebase" = "squash",
): Promise<{ merged: boolean; sha: string }> {
  const res = await fetch("/api/pr-merge", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prUrl, mergeMethod }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `merge failed (${res.status})`);
  }
  const data = await res.json();
  mutate(
    `/api/pr-status?url=${encodeURIComponent(prUrl)}`,
    { status: "merged" },
    { revalidate: false },
  );
  return data;
}

export async function markPrReady(prUrl: string): Promise<void> {
  const res = await fetch("/api/pr-ready", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prUrl }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `mark ready failed (${res.status})`);
  }
  mutate(
    `/api/pr-status?url=${encodeURIComponent(prUrl)}`,
    { status: "open" },
    { revalidate: false },
  );
}

export async function addPrReviewers(
  prUrl: string,
  reviewers: string[],
): Promise<void> {
  const res = await fetch("/api/pr-reviewers", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prUrl, reviewers }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `add reviewers failed (${res.status})`);
  }
}

export async function testConnection(): Promise<MeResponse> {
  const res = await fetch("/api/me", { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function testGithubToken(): Promise<{ login: string }> {
  const res = await fetch("/api/github-test", { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data.login) setGithubLogin(data.login);
  return data;
}

// ── Hypeship ──

function hypeshipHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const url = getHypeshipApiUrl();
  if (url) h["x-hypeship-url"] = url;
  const jwt = getHypeshipJwt();
  if (jwt) h["x-hypeship-jwt"] = jwt;
  return h;
}

async function hypeshipFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: hypeshipHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export async function testHypeshipConnection(): Promise<HypeshipHealthResponse> {
  const res = await fetch("/api/hypeship/healthz", {
    headers: hypeshipHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useHypeshipWorkContexts(includeArchived = false) {
  return useSWR<HypeshipWorkContextListResponse>(
    `/api/hypeship/work-contexts?include_archived=${includeArchived}`,
    hypeshipFetcher<HypeshipWorkContextListResponse>,
    { refreshInterval: 10_000 },
  );
}

export function useHypeshipWorkContext(id: string | null) {
  return useSWR<HypeshipWorkContextResponse>(
    id ? `/api/hypeship/work-contexts/${id}` : null,
    hypeshipFetcher<HypeshipWorkContextResponse>,
    {
      refreshInterval: (data) => {
        if (!data) return 3_000;
        const state = data.work_context.state;
        return state === "launching" || state === "working" ? 5_000 : 0;
      },
    },
  );
}

export async function createHypeshipWorkContext(
  body: HypeshipCreateWorkContextRequest,
): Promise<HypeshipWorkContextResponse> {
  const res = await fetch("/api/hypeship/work-contexts", {
    method: "POST",
    headers: hypeshipHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/work-contexts"),
    undefined,
    { revalidate: true },
  );
  return data;
}

export async function updateHypeshipWorkContextState(
  id: string,
  body: HypeshipUpdateStateRequest,
): Promise<HypeshipWorkContextResponse> {
  const res = await fetch(`/api/hypeship/work-contexts/${id}`, {
    method: "PATCH",
    headers: hypeshipHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(`/api/hypeship/work-contexts/${id}`);
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/work-contexts"),
    undefined,
    { revalidate: true },
  );
  return data;
}
