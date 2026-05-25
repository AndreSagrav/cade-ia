import type { AIModel } from './types';

export const AI_MODELS: Record<string, AIModel> = {
  'claude-sonnet': {
    id: 'claude-sonnet',
    label: 'Claude Sonnet 4',
    provider: 'claude',
    apiModelId: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    contextWindow: 200000,
    cost: { input: 3, output: 15 },
    capabilities: ['code', 'vision', 'reasoning'],
    tier: 'paid',
  },
  'claude-opus': {
    id: 'claude-opus',
    label: 'Claude Opus 4',
    provider: 'claude',
    apiModelId: 'claude-opus-4-20250514',
    maxTokens: 8192,
    contextWindow: 200000,
    cost: { input: 15, output: 75 },
    capabilities: ['code', 'vision', 'reasoning'],
    tier: 'premium',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    apiModelId: 'gpt-4o',
    maxTokens: 4096,
    contextWindow: 128000,
    cost: { input: 2.5, output: 10 },
    capabilities: ['code', 'vision'],
    tier: 'paid',
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    apiModelId: 'gemini-2.5-flash',
    maxTokens: 8192,
    contextWindow: 1000000,
    cost: { input: 0.075, output: 0.3 },
    capabilities: ['code', 'vision', 'reasoning'],
    tier: 'paid',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'gemini',
    apiModelId: 'gemini-2.5-pro',
    maxTokens: 8192,
    contextWindow: 1000000,
    cost: { input: 1.25, output: 10 },
    capabilities: ['code', 'vision', 'reasoning'],
    tier: 'paid',
  },
  'deepseek-v3': {
    id: 'deepseek-v3',
    label: 'DeepSeek V3',
    provider: 'deepseek',
    apiModelId: 'deepseek-chat',
    maxTokens: 8192,
    contextWindow: 64000,
    cost: { input: 0.27, output: 1.1 },
    capabilities: ['code', 'reasoning'],
    tier: 'paid',
  },
  'deepseek-r1': {
    id: 'deepseek-r1',
    label: 'DeepSeek R1',
    provider: 'deepseek',
    apiModelId: 'deepseek-reasoner',
    maxTokens: 8192,
    contextWindow: 64000,
    cost: { input: 0.55, output: 2.19 },
    capabilities: ['code', 'reasoning'],
    tier: 'paid',
  },
  'or-deepseek-r1': {
    id: 'or-deepseek-r1',
    label: 'DeepSeek R1 (OR)',
    provider: 'openrouter',
    apiModelId: 'deepseek/deepseek-r1',
    maxTokens: 8192,
    contextWindow: 64000,
    cost: { input: 0.55, output: 2.19 },
    capabilities: ['code', 'reasoning'],
    tier: 'free',
  },
  'or-qwen3': {
    id: 'or-qwen3',
    label: 'Qwen3 235B (OR)',
    provider: 'openrouter',
    apiModelId: 'qwen/qwen3-235b-a22b',
    maxTokens: 8192,
    contextWindow: 128000,
    cost: { input: 0.5, output: 1.5 },
    capabilities: ['code', 'reasoning'],
    tier: 'free',
  },
  'nvidia-llama': {
    id: 'nvidia-llama',
    label: 'Llama 3.1 405B (NVIDIA)',
    provider: 'nvidia',
    apiModelId: 'meta/llama-3.1-405b-instruct',
    maxTokens: 4096,
    contextWindow: 128000,
    cost: { input: 0, output: 0 },
    capabilities: ['code'],
    tier: 'free',
  },
};

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS[id];
}

export function getModelsByProvider(provider: string): AIModel[] {
  return Object.values(AI_MODELS).filter((m) => m.provider === provider);
}

export function getFreeModels(): AIModel[] {
  return Object.values(AI_MODELS).filter((m) => m.tier === 'free');
}
