import type { WriteFileRequest, ReadFileRequest, TreeRequest, RunCommandRequest } from '@shared/types';

export const API_BASE_URL = (() => {
  try {
    const env = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
    if (env) return env;
  } catch {}
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    if (protocol === 'http:' || protocol === 'https:') return '';
  }
  return 'http://localhost:3001';
})();

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  async writeFile(data: WriteFileRequest) {
    return this.request<{ ok: boolean; path: string }>('/api/files/write', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async readFile(data: ReadFileRequest) {
    return this.request<{ ok: boolean; content: string }>('/api/files/read', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTree(data: TreeRequest) {
    return this.request<{ ok: boolean; items: unknown[]; root: string }>('/api/files/tree', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async runCommand(data: RunCommandRequest) {
    return this.request<{ stdout: string; stderr: string; code: number }>('/api/terminal/run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveFolder(name: string) {
    return this.request<{ path: string; guessed?: boolean }>('/api/files/resolve', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async listDirectories(path?: string) {
    return this.request<{ ok: boolean; items: { name: string; path: string }[]; parent: string | null; current: string | null }>('/api/files/list-directories', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  streamAI(
    path: string,
    body: object,
    headers: Record<string, string>,
  ): { response: Promise<Response>; abort: () => void } {
    const controller = new AbortController();
    const attempt = async (tries = 0): Promise<Response> => {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 429 && tries < 2) {
        const backoff = 500 * Math.pow(2, tries) + Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, backoff));
        return attempt(tries + 1);
      }
      return res;
    };
    const response = attempt();
    return { response, abort: () => controller.abort() };
  }

  /**
   * Stream the agentic loop endpoint.
   * Returns a ReadableStream of SSE events.
   */
  streamAgent(
    body: object,
    headers: Record<string, string> = {},
  ): { response: Promise<Response>; abort: () => void } {
    const controller = new AbortController();
    const attempt = async (tries = 0): Promise<Response> => {
      const res = await fetch(`${API_BASE_URL}/api/ai/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 429 && tries < 2) {
        const backoff = 500 * Math.pow(2, tries) + Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, backoff));
        return attempt(tries + 1);
      }
      return res;
    };
    const response = attempt();
    return { response, abort: () => controller.abort() };
  }
}

export const api = new ApiClient();
