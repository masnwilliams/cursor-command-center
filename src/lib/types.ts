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

export type PrStatus = "open" | "merged" | "closed" | "draft";

export interface PrStatusResponse {
  status: PrStatus;
}

export interface GridItem {
  agentId: string;
  order: number;
}

export interface ReviewRequestPR {
  title: string;
  url: string;
  number: number;
  repo: string;
  author: string;
  updatedAt: string;
}

export interface ReviewRequestsResponse {
  prs: ReviewRequestPR[];
  total: number;
}

export interface PrFile {
  filename: string;
  status:
    | "added"
    | "modified"
    | "removed"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface PrFilesResponse {
  files: PrFile[];
}

// ── Hypeship types ──

export type HypeshipAgentType =
  | "cursor_cli"
  | "codex_cli"
  | "cursor_desktop"
  | "claude_code_cli";

export type HypeshipLaunchMode = "interactive" | "non_interactive";
export type HypeshipApprovalMode = "human_in_loop" | "auto_approve";

export type HypeshipWorkContextState =
  | "launching"
  | "working"
  | "archived"
  | "gone";

export interface HypeshipWorkContext {
  id: string;
  topic: string;
  summary: string;
  repositories: string[];
  branch_name?: string;
  initial_prompt: string;
  start_command: string;
  agent_type: HypeshipAgentType;
  launch_mode: HypeshipLaunchMode;
  approval_mode: HypeshipApprovalMode;
  launch_image: string;
  hypeman_name: string;
  hypeman_instance_id?: string;
  state: HypeshipWorkContextState;
  last_error?: string;
  shell_ws_url?: string;
  desktop_url?: string;
  shell_connect_command?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  last_heartbeat_at?: string;
}

export interface HypeshipWorkContextListResponse {
  work_contexts: HypeshipWorkContext[];
}

export interface HypeshipWorkContextResponse {
  work_context: HypeshipWorkContext;
}

export interface HypeshipCreateWorkContextRequest {
  repositories: string[];
  agent_type: HypeshipAgentType;
  initial_prompt: string;
  branch_name?: string;
  topic?: string;
  launch_image?: string;
  launch_mode?: HypeshipLaunchMode;
  approval_mode?: HypeshipApprovalMode;
}

export interface HypeshipUpdateStateRequest {
  state: "working" | "archived" | "gone";
  summary?: string;
}

export interface HypeshipHealthResponse {
  ok: boolean;
}

// ── Hypeship Prompt API types ──

export interface HypeshipPromptRequest {
  message: string;
  context?: {
    source?: string;
    channel_id?: string;
    thread_ts?: string;
    user_id?: string;
  };
}

export interface HypeshipPromptResponse {
  thread_id: string;
  agent?: {
    id: string;
    status: string;
    repositories?: string[];
    mode?: string;
  };
  message: string;
}

export interface HypeshipAgent {
  id: string;
  status: HypeshipWorkContextState;
  topic: string;
  summary: string;
  repositories: string[];
  agent_type: HypeshipAgentType;
  shell_ws_url?: string;
  desktop_url?: string;
  shell_connect_command?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
}

export interface HypeshipAgentListResponse {
  agents: HypeshipAgent[];
}

export interface HypeshipAgentResponse {
  agent: HypeshipAgent;
}

export interface HypeshipConversationTurn {
  role: string;
  content: string;
  timestamp: string;
}

export interface HypeshipConversationResponse {
  conversation: HypeshipConversationTurn[];
}
