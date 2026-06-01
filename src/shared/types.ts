// ═══════════════════════════════════════
// Shared types between client and server
// ═══════════════════════════════════════

export type AIProvider = 'claude' | 'openai' | 'gemini' | 'nvidia' | 'deepseek' | 'openrouter';

export interface AIModel {
  id: string;
  label: string;
  provider: AIProvider;
  apiModelId: string;
  maxTokens: number;
  contextWindow: number;
  cost: { input: number; output: number }; // per 1M tokens
  capabilities: ('code' | 'vision' | 'reasoning')[];
  tier: 'free' | 'paid' | 'premium';
  dailyLimit?: { type: 'requests' | 'tokens'; value: number; label: string };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokens?: { input: number; output: number };
  attachments?: Attachment[];
  agentChanges?: { path: string; oldContent: string; newContent: string }[];
  toolCalls?: ToolCall[];
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'text' | 'file';
  mime: string;
  content?: string; // text content or base64
  size: number;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
  children?: FileEntry[];
}

export interface OpenFile {
  path: string;
  content: string;
  language: string;
  modified: boolean;
  handle?: FileSystemFileHandle;
  /** Original content before AI preview (used to diff & revert) */
  originalContent?: string;
  /** ID of the PendingChange that owns this preview, if any */
  previewChangeId?: string;
}

export interface PendingChange {
  id: string;
  type: 'replace' | 'diff' | 'run';
  file?: string;
  content: string;
  original?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface APIKeys {
  claude: string;
  openai: string;
  gemini: string;
  nvidia: string;
  deepseek: string;
  openrouter: string;
}

export interface GitHubAccount {
  username: string;
  avatarUrl: string;
  token: string;
}

export interface ServerConfig {
  port: number;
  allowedOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

// API request/response types
export interface WriteFileRequest {
  path: string;
  content: string;
  root: string;
}

export interface ReadFileRequest {
  path: string;
  root: string;
}

export interface TreeRequest {
  root: string;
  maxDepth?: number;
}

export interface RunCommandRequest {
  cmd: string;
  cwd?: string;
}

export interface AIStreamRequest {
  messages: { role: string; content: string | object[] }[];
  model: string;
  system?: string;
  maxTokens?: number;
  stream?: boolean;
}

// ═══════════════════════════════════════
// Tool-use / Agentic loop types
// ═══════════════════════════════════════

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: string;
  fileChange?: { path: string; content: string; oldContent?: string };
}

export interface AgentRequest {
  messages: { role: string; content: string }[];
  model: string;
  provider: AIProvider;
  system: string;
  projectRoot: string;
  maxIterations?: number;
}

export interface Mention {
  id: string;
  type: 'file' | 'folder' | 'selection';
  path: string;       // path relativo al proyecto
  label: string;      // nombre corto para display
  content?: string;   // contenido resuelto (se llena al enviar)
}
