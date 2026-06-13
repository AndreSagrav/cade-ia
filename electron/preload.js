const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  files: {
    tree: (root, maxDepth) => ipcRenderer.invoke('files:tree', { root, maxDepth }),
    read: (path, root) => ipcRenderer.invoke('files:read', { path, root }),
    write: (path, content, root) => ipcRenderer.invoke('files:write', { path, content, root }),
    resolve: (name) => ipcRenderer.invoke('files:resolve', { name }),
    listDirectories: (path) => ipcRenderer.invoke('files:list-directories', { path }),
  },
  auth: {
    verify: (token) => ipcRenderer.invoke('auth:verify', { token }),
    login: (user, password) => ipcRenderer.invoke('auth:login', { user, password }),
  },
  ai: {
    start: (payload) => ipcRenderer.invoke('ai:stream-start', payload),
    abort: (sessionId) => ipcRenderer.invoke('ai:stream-abort', { sessionId }),
    onChunk: (sessionId, cb) => {
      const handler = (_e, m) => { if (m.sessionId === sessionId && typeof m.text === 'string') cb(m.text); };
      ipcRenderer.on('ai:stream:chunk', handler);
      return () => ipcRenderer.removeListener('ai:stream:chunk', handler);
    },
    onDone: (sessionId, cb) => {
      const handler = (_e, m) => { if (m.sessionId === sessionId) cb(); };
      ipcRenderer.on('ai:stream:done', handler);
      return () => ipcRenderer.removeListener('ai:stream:done', handler);
    },
    onError: (sessionId, cb) => {
      const handler = (_e, m) => { if (m.sessionId === sessionId) cb(m.error); };
      ipcRenderer.on('ai:stream:error', handler);
      return () => ipcRenderer.removeListener('ai:stream:error', handler);
    },
    onHeartbeat: (sessionId, cb) => {
      const handler = (_e, m) => { if (m.sessionId === sessionId) cb(); };
      ipcRenderer.on('ai:stream:heartbeat', handler);
      return () => ipcRenderer.removeListener('ai:stream:heartbeat', handler);
    },
  },
  terminal: {
    start: (root, shell, env) => ipcRenderer.invoke('terminal:start', { root, shell, env }),
    input: (sessionId, data) => ipcRenderer.invoke('terminal:input', { sessionId, data }),
    kill: (sessionId) => ipcRenderer.invoke('terminal:kill', { sessionId }),
    onData: (sessionId, cb) => {
      const handler = (_e, m) => { if (m.sessionId === sessionId && typeof m.data === 'string') cb(m.data); };
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    onExit: (sessionId, cb) => {
      const handler = (_e, m) => { if (m.sessionId === sessionId) cb(m.code); };
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
  },
  shell: {
    run: (command, args, root, env, timeoutMs) => ipcRenderer.invoke('shell:run', { command, args, root, env, timeoutMs }),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', { url }),
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStatus: (cb) => {
      const handler = (_e, m) => { cb(m); };
      ipcRenderer.on('updates:status', handler);
      return () => ipcRenderer.removeListener('updates:status', handler);
    },
  },
});
