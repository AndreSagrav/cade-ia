import type { WriteFileRequest, ReadFileRequest, TreeRequest, RunCommandRequest } from '@shared/types';

// In Electron production mode, the frontend is loaded via file:// protocol,
// so relative API calls (e.g. /api/files/tree) would fail. We detect this
// and point all calls to the embedded Express server on port 7001.
const isElectronProd = window.location.protocol === 'file:';
export const BASE_URL = isElectronProd ? 'http://localhost:7001' : '';

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
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
    const response = fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
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
    const response = fetch(`${BASE_URL}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { response, abort: () => controller.abort() };
  }
}

export const api = new ApiClient();
