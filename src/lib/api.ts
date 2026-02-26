import useSWR, { mutate } from "swr";
import type {
  Agent,
  AgentListResponse,
  ConversationResponse,
  FollowUpRequest,
  LaunchAgentRequest,
  MeResponse,
  ModelsResponse,
  RepositoriesResponse,
} from "./types";
import { getApiKey, getCachedRepos, setCachedRepos } from "./storage";

function headers(): Record<string, string> {
  const key = getApiKey();
  if (!key) return {};
  return { "x-cursor-key": key, "Content-Type": "application/json" };
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
    { refreshInterval: 15_000 }
  );
}

// Single agent
export function useAgent(id: string | null) {
  const { data, ...rest } = useSWR<Agent>(
    id ? `/api/agents/${id}` : null,
    fetcher<Agent>,
    {
      refreshInterval: (data) => {
        if (!data) return 5_000;
        return data.status === "RUNNING" || data.status === "CREATING"
          ? 5_000
          : 0;
      },
    }
  );
  return { data, ...rest };
}

// Conversation
export function useConversation(id: string | null) {
  const { data, ...rest } = useSWR<ConversationResponse>(
    id ? `/api/agents/${id}/conversation` : null,
    fetcher<ConversationResponse>,
    { refreshInterval: 10_000 }
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

// Repositories (with localStorage cache)
export function useRepositories() {
  return useSWR<RepositoriesResponse>(
    "/api/repositories",
    async (url: string) => {
      const cached = getCachedRepos();
      if (cached) return { repositories: cached };
      const data = await fetcher<RepositoriesResponse>(url);
      setCachedRepos(data.repositories);
      return data;
    },
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
}

// Branches (from GitHub API)
export function useBranches(repoUrl: string | null) {
  return useSWR<{ branches: string[] }>(
    repoUrl ? `/api/branches?repo=${encodeURIComponent(repoUrl)}` : null,
    fetcher<{ branches: string[] }>,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
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
  body: FollowUpRequest
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

export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  mutate("/api/agents?limit=100");
}

export async function testConnection(): Promise<MeResponse> {
  const res = await fetch("/api/me", { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
