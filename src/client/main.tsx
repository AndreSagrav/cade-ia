import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

// Bridge HTTP calls to IPC in Electron production (no local server)
try {
  const wapi: any = (typeof window !== 'undefined' ? (window as any).api : null);
  if (wapi && typeof window !== 'undefined') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        const path = (() => {
          try {
            const u = new URL(url, window.location.origin);
            return u.pathname;
          } catch {
            return url; // relative like '/api/...'
          }
        })();

        const isApi = path.startsWith('/api/');
        if (!isApi) return originalFetch(input as any, init);

        const method = (init?.method || 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(init.body as string) : {};

        // Auth
        if (path === '/api/auth/login' && method === 'POST' && wapi.auth?.login) {
          const res = await wapi.auth.login(body.user, body.password);
          return new Response(JSON.stringify(res), { status: res?.token ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
        }
        if (path === '/api/auth/verify' && method === 'POST' && wapi.auth?.verify) {
          const res = await wapi.auth.verify(body.token);
          return new Response(JSON.stringify(res), { status: res?.ok ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
        }

        // Files
        if (path === '/api/files/resolve' && method === 'POST' && wapi.files?.resolve) {
          const res = await wapi.files.resolve(body.name);
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (path === '/api/files/list-directories' && method === 'POST' && wapi.files?.listDirectories) {
          const res = await wapi.files.listDirectories(body.path);
          return new Response(JSON.stringify(res), { status: res?.ok ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (path === '/api/files/tree' && method === 'POST' && wapi.files?.tree) {
          const res = await wapi.files.tree(body.root, body.maxDepth);
          return new Response(JSON.stringify(res), { status: res?.ok ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
        }
        if (path === '/api/files/read' && method === 'POST' && wapi.files?.read) {
          const res = await wapi.files.read(body.path, body.root);
          return new Response(JSON.stringify(res), { status: res?.ok ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
        }
        if (path === '/api/files/write' && method === 'POST' && wapi.files?.write) {
          const res = await wapi.files.write(body.path, body.content, body.root);
          return new Response(JSON.stringify(res), { status: res?.ok ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        }

        // AI via IPC when available
        if (false && (path.startsWith('/api/ai/') || path === '/api/ai-unified/chat' || path === '/api/ai/agent') && wapi?.ai?.start) {
          const payload = body?.provider ? body : { provider: 'openrouter', model: body?.model || 'openrouter/auto', system: body?.system || '', messages: body?.messages || [], apiKey: (window as any)?.__OPENROUTER_KEY__ || '' };
          const session = await wapi.ai.start(payload);
          if (session?.error) return new Response(JSON.stringify({ error: session.error }), { status: 500, headers: { 'Content-Type': 'application/json' } });

          // Return a ReadableStream Response that listens to chunk/done events
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              const onChunk = (_e: any, m: any) => { if (m.sessionId !== session.sessionId || typeof m.text !== 'string') return; controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: m.text } }] })}\n\n`)); };
              const onDone = () => { controller.close(); cleanup(); };
              const onError = (_e: any, m: any) => { if (m.sessionId !== session.sessionId) return; controller.error(new Error(m.error || 'AI error')); cleanup(); };

              const off1 = wapi.ai.onChunk(session.sessionId, (t: string) => onChunk(null, { sessionId: session.sessionId, text: t }));
              const off2 = wapi.ai.onDone(session.sessionId, () => onDone());
              const off3 = wapi.ai.onError(session.sessionId, (err: string) => onError(null, { sessionId: session.sessionId, error: err }));
              const cleanup = () => { off1(); off2(); off3(); };
            }
          });
          return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
        }

        return originalFetch(input as any, init);
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message || 'IPC bridge failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    };
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
