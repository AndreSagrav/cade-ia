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
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokens?: { input: number; output: number };
  attachments?: Attachment[];
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
