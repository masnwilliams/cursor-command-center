import useSWR, { mutate } from "swr";
import type {
  Agent,
  AgentListResponse,
  ConversationResponse,
  FollowUpRequest,
  LaunchAgentRequest,
  MeResponse,
  ModelsResponse,
  PrStatusResponse,
  RepositoriesResponse,
  ReviewRequestsResponse,
} from "./types";
import {
  getApiKey,
  getGithubToken,
  getCachedRepos,
  setCachedRepos,
  clearCachedRepos,
  getReposFromCache,
  getCachedBranches,
  getBranchesFromCache,
  setCachedBranches,
} from "./storage";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = getApiKey();
  if (key) h["x-cursor-key"] = key;
  const ghToken = getGithubToken();
  if (ghToken) h["x-github-token"] = ghToken;
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

// PR review requests (polls every 2 minutes)
export function useReviewRequests() {
  return useSWR<ReviewRequestsResponse>(
    "/api/review-requests",
    fetcher<ReviewRequestsResponse>,
    { refreshInterval: 120_000, revalidateOnFocus: false },
  );
}

// PR status (from GitHub API, polls every 60s for agents with a PR)
export function usePrStatus(prUrl: string | undefined) {
  return useSWR<PrStatusResponse>(
    prUrl ? `/api/pr-status?url=${encodeURIComponent(prUrl)}` : null,
    fetcher<PrStatusResponse>,
    { revalidateOnFocus: false, dedupingInterval: 60_000, refreshInterval: 60_000 },
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
  return res.json();
}
