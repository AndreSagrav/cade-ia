export const API_BASE_URL = (() => {
    try {
        const env = import.meta?.env?.VITE_API_BASE_URL;
        if (env)
            return env;
    }
    catch { }
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        if (protocol === 'http:' || protocol === 'https:')
            return '';
    }
    return 'http://localhost:3001';
})();
class ApiClient {
    async request(path, options) {
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
    async writeFile(data) {
        return this.request('/api/files/write', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async readFile(data) {
        return this.request('/api/files/read', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async getTree(data) {
        return this.request('/api/files/tree', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async runCommand(data) {
        return this.request('/api/terminal/run', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async resolveFolder(name) {
        return this.request('/api/files/resolve', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    }
    async listDirectories(path) {
        return this.request('/api/files/list-directories', {
            method: 'POST',
            body: JSON.stringify({ path }),
        });
    }
    streamAI(path, body, headers) {
        const controller = new AbortController();
        const attempt = async (tries = 0) => {
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
    streamAgent(body, headers = {}) {
        const controller = new AbortController();
        const attempt = async (tries = 0) => {
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
