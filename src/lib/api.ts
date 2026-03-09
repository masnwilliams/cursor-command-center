import useSWR, { mutate } from "swr";
import type {
  Agent,
  AgentListResponse,
  ArtifactDownloadResponse,
  ArtifactsResponse,
  ConversationResponse,
  FollowUpRequest,
  LaunchAgentRequest,
  MeResponse,
  ModelsResponse,
  PrFilesResponse,
  PrStatusResponse,
  RepositoriesResponse,
  ReviewRequestsResponse,
  HypeshipWorkerListResponse,
  HypeshipWorkerResponse,
  HypeshipCreateWorkerRequest,
  HypeshipUpdateWorkerStateRequest,
  HypeshipConversationResponse,
  HypeshipSendMessageResponse,
  HypeshipHealthResponse,
  HypeshipPromptRequest,
  HypeshipPromptResponse,
  HypeshipSecretListResponse,
  HypeshipSecretResponse,
  HypeshipUserResponse,
  HypeshipIdentityListResponse,
  HypeshipAuthConfig,
  HypeshipAgentListResponse,
  HypeshipAgentDetailResponse,
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

// Artifacts (fetched once when panel is opened)
export function useArtifacts(id: string | null) {
  return useSWR<ArtifactsResponse>(
    id ? `/api/agents/${id}/artifacts` : null,
    fetcher<ArtifactsResponse>,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
}

export async function getArtifactDownloadUrl(
  agentId: string,
  artifactPath: string,
): Promise<ArtifactDownloadResponse> {
  const url = `/api/agents/${agentId}/artifacts/download?path=${encodeURIComponent(artifactPath)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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

export function useHypeshipAgents() {
  return useSWR<HypeshipAgentListResponse>(
    "/api/hypeship/agents",
    hypeshipFetcher<HypeshipAgentListResponse>,
    { refreshInterval: 10_000 },
  );
}

export function useHypeshipAgent(id: string | null) {
  return useSWR<HypeshipAgentDetailResponse>(
    id ? `/api/hypeship/agents/${id}` : null,
    hypeshipFetcher<HypeshipAgentDetailResponse>,
    { refreshInterval: 3_000 },
  );
}

export function useHypeshipWorkers(includeArchived = false) {
  return useSWR<HypeshipWorkerListResponse>(
    `/api/hypeship/agents?include_archived=${includeArchived}`,
    hypeshipFetcher<HypeshipWorkerListResponse>,
    { refreshInterval: 10_000 },
  );
}

export function useHypeshipWorker(id: string | null) {
  return useSWR<HypeshipWorkerResponse>(
    id ? `/api/hypeship/agents/${id}` : null,
    hypeshipFetcher<HypeshipWorkerResponse>,
    {
      refreshInterval: (data) => {
        if (!data) return 3_000;
        const state = data.agent.state;
        return state === "launching" || state === "working" ? 5_000 : 0;
      },
    },
  );
}

export function useHypeshipConversation(id: string | null, active = true) {
  return useSWR<HypeshipConversationResponse>(
    id ? `/api/hypeship/agents/${id}/conversation` : null,
    hypeshipFetcher<HypeshipConversationResponse>,
    { refreshInterval: active ? 3_000 : 0 },
  );
}

export async function createHypeshipWorker(
  body: HypeshipCreateWorkerRequest,
): Promise<HypeshipWorkerResponse> {
  const res = await fetch("/api/hypeship/agents", {
    method: "POST",
    headers: hypeshipHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/agents"),
    undefined,
    { revalidate: true },
  );
  return data;
}

export async function sendHypeshipMessage(
  id: string,
  content: string,
): Promise<HypeshipSendMessageResponse> {
  const res = await fetch(`/api/hypeship/agents/${id}/message`, {
    method: "POST",
    headers: hypeshipHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(`/api/hypeship/agents/${id}/conversation`);
  return data;
}

export async function updateHypeshipWorkerState(
  id: string,
  body: HypeshipUpdateWorkerStateRequest,
): Promise<HypeshipWorkerResponse> {
  const res = await fetch(`/api/hypeship/agents/${id}/state`, {
    method: "PATCH",
    headers: hypeshipHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(`/api/hypeship/agents/${id}`);
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/agents"),
    undefined,
    { revalidate: true },
  );
  return data;
}

export async function sendHypeshipPrompt(
  body: HypeshipPromptRequest,
): Promise<HypeshipPromptResponse> {
  const res = await fetch("/api/hypeship/agents", {
    method: "POST",
    headers: hypeshipHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/agents"),
    undefined,
    { revalidate: true },
  );
  return data;
}

export async function sendHypeshipFollowUp(
  agentId: string,
  message: string,
): Promise<HypeshipPromptResponse> {
  const res = await fetch(`/api/hypeship/agents/${agentId}/follow-up`, {
    method: "POST",
    headers: hypeshipHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function stopHypeshipAgent(agentId: string): Promise<{ id: string }> {
  const res = await fetch(`/api/hypeship/agents/${agentId}/stop`, {
    method: "POST",
    headers: hypeshipHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/agents"),
    undefined,
    { revalidate: true },
  );
  return data;
}

export async function resetHypeshipOrchestrator(): Promise<{ status: string }> {
  const res = await fetch("/api/hypeship/orchestrators/reset", {
    method: "POST",
    headers: hypeshipHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Hypeship Settings ──

export async function getHypeshipSettingsLink(): Promise<{ url: string; expires_in: number }> {
  const res = await fetch("/api/hypeship/settings/link", {
    method: "POST",
    headers: hypeshipHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Hypeship Secrets ──

export function useHypeshipSecrets(scope?: string, userId?: string) {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (userId) params.set("user_id", userId);
  const qs = params.toString();
  return useSWR<HypeshipSecretListResponse>(
    `/api/hypeship/secrets${qs ? `?${qs}` : ""}`,
    hypeshipFetcher<HypeshipSecretListResponse>,
    { refreshInterval: 30_000 },
  );
}

export async function createHypeshipSecret(
  name: string,
  value: string,
  scope: "team" | "user",
  userId?: string,
): Promise<HypeshipSecretResponse> {
  const res = await fetch("/api/hypeship/secrets", {
    method: "POST",
    headers: hypeshipHeaders(),
    body: JSON.stringify({ name, value, scope, user_id: userId }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/secrets"),
    undefined,
    { revalidate: true },
  );
  return data;
}

export async function deleteHypeshipSecret(
  name: string,
  scope?: string,
  userId?: string,
): Promise<void> {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (userId) params.set("user_id", userId);
  const qs = params.toString();
  const res = await fetch(
    `/api/hypeship/secrets/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`,
    { method: "DELETE", headers: hypeshipHeaders() },
  );
  if (!res.ok) throw new Error(await res.text());
  mutate(
    (key: string) =>
      typeof key === "string" && key.startsWith("/api/hypeship/secrets"),
    undefined,
    { revalidate: true },
  );
}

// ── Hypeship Users & Identities ──

export function useHypeshipUser() {
  return useSWR<HypeshipUserResponse>(
    "/api/hypeship/users/me",
    hypeshipFetcher<HypeshipUserResponse>,
    { revalidateOnFocus: false },
  );
}

export function useHypeshipIdentities() {
  return useSWR<HypeshipIdentityListResponse>(
    "/api/hypeship/users/me/identities",
    hypeshipFetcher<HypeshipIdentityListResponse>,
    { revalidateOnFocus: false },
  );
}

export async function unlinkHypeshipIdentity(provider: string): Promise<void> {
  const res = await fetch(
    `/api/hypeship/users/me/identities/${encodeURIComponent(provider)}`,
    { method: "DELETE", headers: hypeshipHeaders() },
  );
  if (!res.ok) throw new Error(await res.text());
  mutate("/api/hypeship/users/me/identities");
}

// ── Hypeship Auth Config ──

export async function getHypeshipAuthConfig(): Promise<HypeshipAuthConfig> {
  const res = await fetch("/api/hypeship/auth/config", {
    headers: hypeshipHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
