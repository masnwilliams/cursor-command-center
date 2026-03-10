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

export interface Artifact {
  absolutePath: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface ArtifactsResponse {
  artifacts: Artifact[];
}

export interface ArtifactDownloadResponse {
  url: string;
  expiresAt: string;
}

// ── Hypeship types ──
export type HypeshipAgentType = "codex_cli" | "claude_code_cli";

export type HypeshipWorkerState =
  | "launching"
  | "working"
  | "archived"
  | "gone";

export type HypeshipAgentStatus = "pending" | "running" | "finished" | "stopped" | "error";

export type HypeshipLaunchMode = "interactive" | "non_interactive";
export type HypeshipApprovalMode = "auto_approve" | "human_in_loop";

export interface HypeshipWorker {
  id: string;
  topic: string;
  summary: string;
  branch_name?: string;
  orchestrator_id?: string;
  initial_prompt: string;
  start_command: string;
  agent_type: HypeshipAgentType;
  launch_mode: HypeshipLaunchMode;
  approval_mode: HypeshipApprovalMode;
  launch_image: string;
  hypeman_name: string;
  hypeman_instance_id?: string;
  state: HypeshipWorkerState;
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

export interface HypeshipWorkerListResponse {
  agents: HypeshipWorker[];
}

export interface HypeshipWorkerResponse {
  agent: HypeshipWorker;
}

export interface HypeshipCreateWorkerRequest {
  agent_type: HypeshipAgentType;
  initial_prompt: string;
  branch_name?: string;
  topic?: string;
  launch_image?: string;
  env_vars?: Record<string, string>;
  setup_command?: string;
  mode?: "read" | "write";
}

export interface HypeshipUpdateWorkerStateRequest {
  state: "working" | "archived" | "gone";
  summary?: string;
}

export interface HypeshipAgentSummary {
  id: string;
  source: string;
  preview: string;
  message_count: number;
  status: HypeshipAgentStatus;
  created_at: string;
  updated_at: string;
}

export interface HypeshipAgentListResponse {
  agents: HypeshipAgentSummary[];
}

export interface HypeshipAgentDetail {
  id: string;
  source: string;
  messages: HypeshipConversationTurn[];
  created_at: string;
  updated_at: string;
}

export interface HypeshipAgentDetailResponse {
  agent: HypeshipAgentDetail;
}

export interface HypeshipConversationTurn {
  role: string;
  content: string;
  source?: string;
  worker_id?: string;
  status?: string;
  detail?: HypeshipConversationTurn[];
  timestamp: string;
}

export interface HypeshipConversationResponse {
  conversation: HypeshipConversationTurn[];
}

export interface HypeshipSendMessageRequest {
  content: string;
}

export interface HypeshipSendMessageResponse {
  status: string;
  agent_id: string;
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
  agent_id: string;
  message: string;
}

// ── Hypeship User & Identity types ──

export interface HypeshipUser {
  id: string;
  display_name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface HypeshipUserResponse {
  user: HypeshipUser;
}

export interface HypeshipUserIdentity {
  id: string;
  user_id: string;
  provider: string;
  provider_id: string;
  metadata?: Record<string, unknown>;
  has_token: boolean;
  created_at: string;
}

export interface HypeshipIdentityListResponse {
  identities: HypeshipUserIdentity[];
}

// ── Hypeship Secrets types ──

export interface HypeshipSecret {
  id: string;
  name: string;
  scope: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface HypeshipSecretListResponse {
  secrets: HypeshipSecret[];
}

export interface HypeshipSecretResponse {
  secret: HypeshipSecret;
}

export interface HypeshipCreateSecretRequest {
  name: string;
  value: string;
  scope: "team" | "user";
  user_id?: string;
}

// ── Hypeship Auth Config types ──

export interface HypeshipAuthConfig {
  providers: { type: string; client_id: string }[];
}
