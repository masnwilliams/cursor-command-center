export type AgentStatus =
  | "CREATING"
  | "RUNNING"
  | "FINISHED"
  | "STOPPED"
  | "ERROR";

export interface AgentSource {
  repository: string;
  ref?: string;
  prUrl?: string;
}

export interface AgentTarget {
  branchName?: string;
  url?: string;
  prUrl?: string;
  autoCreatePr: boolean;
  openAsCursorGithubApp: boolean;
  skipReviewerRequest: boolean;
  autoBranch?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  source: AgentSource;
  target: AgentTarget;
  summary?: string;
  createdAt: string;
  linesAdded?: number;
  linesRemoved?: number;
  filesChanged?: number;
}

export interface AgentListResponse {
  agents: Agent[];
  nextCursor?: string;
}

export interface ConversationMessage {
  id: string;
  type: "user_message" | "assistant_message";
  text: string;
}

export interface ConversationResponse {
  id: string;
  messages: ConversationMessage[];
}

export interface MeResponse {
  apiKeyName: string;
  createdAt: string;
  userEmail: string;
}

export interface ModelsResponse {
  models: string[];
}

export interface Repository {
  owner: string;
  name: string;
  repository: string;
}

export interface RepositoriesResponse {
  repositories: Repository[];
}

export interface LaunchAgentRequest {
  prompt: {
    text: string;
    images?: { data: string; dimension: { width: number; height: number } }[];
  };
  model?: string;
  source: {
    repository?: string;
    ref?: string;
    prUrl?: string;
  };
  target?: {
    autoCreatePr?: boolean;
    openAsCursorGithubApp?: boolean;
    skipReviewerRequest?: boolean;
    branchName?: string;
    autoBranch?: boolean;
  };
}

export interface FollowUpRequest {
  prompt: {
    text: string;
    images?: { data: string; dimension: { width: number; height: number } }[];
  };
}

export interface GridItem {
  agentId: string;
  order: number;
}
