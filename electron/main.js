import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join, dirname as pathDirname, relative as pathRelative } from 'path';
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import net from 'net';
import crypto from 'crypto';
import https from 'https';
import dns from 'dns';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathDirname(__filename);

let mainWindow = null;
let serverProcess = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let SERVER_PORT = 3001;
const PRELOAD_PATH = join(__dirname, 'preload.js');

// Force IPv4-first DNS to prevent ENOTFOUND on Windows networks with broken IPv6
dns.setDefaultResultOrder('ipv4first');

// Keep-alive agent with IPv4-only lookup to avoid DNS issues
const KEEP_ALIVE_AGENT = new https.Agent({
  keepAlive: true,
  family: 4,
});
// Optional autoUpdater placeholder (disabled at runtime)
let AutoUpdaterRef = null;

function resolveServerPath() {
  const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'dist-server', 'index.js');
  if (existsSync(unpacked)) return unpacked;
  return join(__dirname, '..', 'dist-server', 'index.js');
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(preferred) {
  for (const p of preferred) {
    if (await isPortFree(p)) return p;
  }
  for (let p = 3001; p <= 3010; p++) {
    if (await isPortFree(p)) return p;
  }
  return 3001;
}

async function startServer() {
  const desired = Number(process.env.ELECTRON_SERVER_PORT || process.env.PORT || 3001);
  SERVER_PORT = await findAvailablePort([desired, 3002, 3003, 3004]);

  const serverPath = resolveServerPath();
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(SERVER_PORT) },
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'CodeAI Studio',
    backgroundColor: '#181b1f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: PRELOAD_PATH,
    },
  });

  if (isDev) {
    const devPort = Number(process.env.VITE_DEV_PORT || process.env.FRONTEND_PORT || 5173);
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Load from local server so API calls use HTTP (avoids IPC DNS issues)
    await new Promise(r => setTimeout(r, 800)); // give server time to start
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Auto-update: lazy-load electron-updater safely
  if (!isDev) {
    try {
      const { autoUpdater } = await import('electron-updater');
      AutoUpdaterRef = autoUpdater;
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    } catch {
      // electron-updater not available; silently skip
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

// ── IPC handlers (production, no HTTP) ──────────────────────────────
const tokens = new Set();
const AUTH_USER = process.env.AUTH_USER ?? '';
const AUTH_PASS = process.env.AUTH_PASS ?? '';

ipcMain.handle('auth:verify', async (_e, { token }) => {
  return { ok: tokens.has(token) || (!AUTH_USER && !AUTH_PASS) };
});

ipcMain.handle('auth:login', async (_e, { user, password }) => {
  if (AUTH_USER || AUTH_PASS) {
    if (user !== AUTH_USER || password !== AUTH_PASS) return { error: 'Credenciales inválidas' };
  }
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  return { token };
});

function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }

function listDirectories(path) {
  if (!path) {
    if (process.platform === 'win32') {
      try {
        const out = execSync('wmic logicaldisk get name', { encoding: 'utf-8' });
        const drives = out.split('\n').map(l => l.trim()).filter(l => l.length === 2 && l.endsWith(':')).map(d => d + '\\');
        const home = process.env.USERPROFILE || process.env.HOME || '';
        let oneDriveRoots = [];
        try {
          const homeEntries = existsSync(home) ? readdirSync(home, { withFileTypes: true }) : [];
          oneDriveRoots = homeEntries.filter(d => d.isDirectory() && /onedrive/i.test(d.name)).map(d => join(home, d.name));
        } catch {}
        const quickCandidates = [
          join(home, 'Documents'),
          join(home, 'Documentos'),
          join(home, 'Desktop'),
          join(home, 'Escritorio'),
          ...oneDriveRoots.map(r => join(r, 'Documents')),
          ...oneDriveRoots.map(r => join(r, 'Documentos')),
          join(home, 'OneDrive', 'Documents'),
          join(home, 'OneDrive', 'Documentos'),
          // PROYECTOS comunes
          join(home, 'Documents', 'PROYECTOS'),
          join(home, 'Documentos', 'PROYECTOS'),
          ...oneDriveRoots.map(r => join(r, 'Documents', 'PROYECTOS')),
          ...oneDriveRoots.map(r => join(r, 'Documentos', 'PROYECTOS')),
          join(home, 'OneDrive', 'Documents', 'PROYECTOS'),
          join(home, 'OneDrive', 'Documentos', 'PROYECTOS'),
        ];
        const seen = new Set();
        const quicks = quickCandidates
          .filter(p => !!p && existsSync(p) && isDir(p))
          .map(p => ({ name: p.split('\\').pop() || p, path: p }))
          .filter(it => { if (seen.has(it.path)) return false; seen.add(it.path); return true; });
        const driveItems = drives.map(d => ({ name: d, path: d }));
        return { ok: true, items: [...quicks, ...driveItems], parent: null, current: null };
      } catch {
        const drives = ['C:\\', 'D:\\', 'E:\\'].filter(d => existsSync(d));
        const home = process.env.USERPROFILE || process.env.HOME || '';
        let oneDriveRoots = [];
        try {
          const homeEntries = existsSync(home) ? readdirSync(home, { withFileTypes: true }) : [];
          oneDriveRoots = homeEntries.filter(d => d.isDirectory() && /onedrive/i.test(d.name)).map(d => join(home, d.name));
        } catch {}
        const quickCandidates = [
          join(home, 'Documents'),
          join(home, 'Documentos'),
          join(home, 'Desktop'),
          join(home, 'Escritorio'),
          ...oneDriveRoots.map(r => join(r, 'Documents')),
          ...oneDriveRoots.map(r => join(r, 'Documentos')),
          join(home, 'OneDrive', 'Documents'),
          join(home, 'OneDrive', 'Documentos'),
          // PROYECTOS comunes
          join(home, 'Documents', 'PROYECTOS'),
          join(home, 'Documentos', 'PROYECTOS'),
          ...oneDriveRoots.map(r => join(r, 'Documents', 'PROYECTOS')),
          ...oneDriveRoots.map(r => join(r, 'Documentos', 'PROYECTOS')),
          join(home, 'OneDrive', 'Documents', 'PROYECTOS'),
          join(home, 'OneDrive', 'Documentos', 'PROYECTOS'),
        ];
        const seen = new Set();
        const quicks = quickCandidates
          .filter(p => !!p && existsSync(p) && isDir(p))
          .map(p => ({ name: p.split('\\').pop() || p, path: p }))
          .filter(it => { if (seen.has(it.path)) return false; seen.add(it.path); return true; });
        const driveItems = drives.map(d => ({ name: d, path: d }));
        return { ok: true, items: [...quicks, ...driveItems], parent: null, current: null };
      }
    }
    return { ok: true, items: [{ name: '/', path: '/' }], parent: null, current: null };
  }
  if (!existsSync(path) || !isDir(path)) return { error: 'Directory not found' };
  const entries = readdirSync(path, { withFileTypes: true });
  const items = entries.filter(e => e.isDirectory()).filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => ({ name: e.name, path: join(path, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parent = pathDirname(path);
  const hasParent = parent && parent !== path && existsSync(parent);
  return { ok: true, items, parent: hasParent ? parent : null, current: path };
}

function buildTree(dir, depth, maxDepth, root) {
  if (depth >= maxDepth) return [];
  if (!existsSync(dir) || !isDir(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const sorted = entries.sort((a, b) => (a.isDirectory() !== b.isDirectory() ? (a.isDirectory() ? -1 : 1) : a.name.localeCompare(b.name)));
  const items = [];
  const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', '.svelte-kit', '.nuxt']);
  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (SKIP.has(entry.name)) continue;
    const entryPath = join(dir, entry.name);
    const relativePath = pathRelative(root, entryPath);
    if (entry.isDirectory()) {
      const children = buildTree(entryPath, depth + 1, maxDepth, root);
      items.push({ name: entry.name, path: relativePath, kind: 'directory', children });
    } else {
      try { items.push({ name: entry.name, path: relativePath, kind: 'file', size: statSync(entryPath).size }); }
      catch { items.push({ name: entry.name, path: relativePath, kind: 'file' }); }
    }
  }
  return items;
}

ipcMain.handle('files:list-directories', async (_e, { path }) => listDirectories(path));

ipcMain.handle('files:resolve', async (_e, { name }) => {
  const p = await import('path');
  const isAbs = p.isAbsolute(name);
  if (isAbs && existsSync(name) && isDir(name)) return { path: realpathSync(name) };
  const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const candidates = [
    p.resolve(process.cwd(), name),
    p.resolve(home, 'Documents', name),
    p.resolve(home, 'Projects', name),
    p.resolve(home, 'Documents', 'PROYECTOS', name),
    p.resolve(home, 'Documentos', name),
    p.resolve(home, 'OneDrive', 'Documents', name),
    p.resolve(home, 'OneDrive', 'Documentos', name),
    p.resolve(home, 'OneDrive', 'Documentos', 'PROYECTOS', name),
    p.resolve(home, 'OneDrive', 'Documents', 'PROYECTOS', name),
    p.resolve(home, 'Desktop', name),
    p.resolve(home, 'Escritorio', name),
  ];
  for (const cand of candidates) if (existsSync(cand) && isDir(cand)) return { path: realpathSync(cand) };
  return { path: name, guessed: true };
});

ipcMain.handle('files:tree', async (_e, { root, maxDepth = 5 }) => {
  const p = await import('path');
  let base = null;
  if (p.isAbsolute(root)) {
    if (!existsSync(root) || !isDir(root)) return { error: 'Directory not found', provided: root };
    base = realpathSync(root);
  } else {
    const { path: resolved, guessed } = await ipcMain.invoke('files:resolve', { name: root });
    if (guessed) return { error: 'Directory not found or not absolute', provided: root };
    base = resolved;
  }
  const items = buildTree(base, 0, Math.min(8, maxDepth), base);
  return { ok: true, items, root };
});

ipcMain.handle('files:read', async (_e, { path, root }) => {
  const full = join(root, path);
  const content = readFileSync(full, 'utf-8');
  return { ok: true, content };
});

ipcMain.handle('files:write', async (_e, { path, content, root }) => {
  const full = join(root, path);
  writeFileSync(full, content, 'utf-8');
  return { ok: true, path };
});

// ── AI streaming (providers + OpenRouter fallback) ───────────────────
const AI_SESSIONS = new Map();
const USER_KEYS_CACHE = new Map();

async function getUserProviderKeys(username) {
  if (!username) return {};
  if (USER_KEYS_CACHE.has(username)) return USER_KEYS_CACHE.get(username);
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return {};
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('ai_api_keys')
      .select('*')
      .eq('username', username)
      .single();
    if (error || !data) return {};
    const map = {};
    for (const k of ['claude','openai','gemini','deepseek','nvidia','openrouter']) {
      if (typeof data[k] === 'string' && data[k]) map[k] = data[k];
    }
    USER_KEYS_CACHE.set(username, map);
    return map;
  } catch {
    return {};
  }
}

function streamOpenRouter({ model, system, messages, apiKey }) {
  const reqBody = { model, messages: [{ role: 'system', content: system }, ...messages], stream: true };
  const data = JSON.stringify(reqBody);
  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENROUTER_API_KEY || ''}`,
      'Accept': 'text/event-stream',
      'X-Title': 'CodeAI Studio',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return { options, data };
}

function toGeminiContents(system, messages) {
  const contents = [];
  if (system) {
    // systemInstruction handled separately in body
  }
  for (const m of messages) {
    if (!m || !m.role || !m.content) continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: m.content }] });
  }
  return contents;
}

function streamGemini({ model, system, messages, apiKey }) {
  const body = {
    contents: toGeminiContents(system, messages),
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: { temperature: 0.2 },
  };
  const data = JSON.stringify(body);
  const key = apiKey || process.env.GEMINI_API_KEY || '';
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(key)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return { options, data };
}

function streamDeepSeek({ model, system, messages, apiKey }) {
  const reqBody = { model, messages: [{ role: 'system', content: system }, ...messages], stream: true };
  const data = JSON.stringify(reqBody);
  const options = {
    hostname: 'api.deepseek.com',
    path: '/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.DEEPSEEK_API_KEY || ''}`,
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return { options, data };
}

function streamNvidia({ model, system, messages, apiKey }) {
  // NVIDIA NIM OpenAI-compatible chat completions
  const reqBody = { model, messages: [{ role: 'system', content: system }, ...messages], stream: true };
  const data = JSON.stringify(reqBody);
  const options = {
    hostname: 'integrate.api.nvidia.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.NVIDIA_API_KEY || ''}`,
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return { options, data };
}

function streamOpenAI({ model, system, messages, apiKey }) {
  const reqBody = { model, messages: [{ role: 'system', content: system }, ...messages], stream: true };
  const data = JSON.stringify(reqBody);
  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY || ''}`,
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return { options, data };
}

function toAnthropicMessages(messages) {
  // Convert [{role, content}] to Anthropic message format
  const out = [];
  for (const m of messages) {
    if (!m || !m.role || !m.content) continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    out.push({ role, content: m.content });
  }
  return out;
}

function streamAnthropic({ model, system, messages, apiKey }) {
  const body = {
    model,
    system,
    max_tokens: 1024,
    messages: toAnthropicMessages(messages),
    stream: true,
  };
  const data = JSON.stringify(body);
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return { options, data };
}

ipcMain.handle('ai:stream-start', async (event, payload) => {
  const webContents = event.sender;
  const sessionId = crypto.randomBytes(8).toString('hex');
  try {
    const { provider, model, system, messages, apiKey, username } = payload || {};

    // Resolve API key quickly: prefer renderer-provided, then env; only hit Supabase if needed
    const envKeyFor = (prov) => (
      prov === 'openai' ? (process.env.OPENAI_API_KEY || '') :
      (prov === 'claude' || prov === 'anthropic') ? (process.env.ANTHROPIC_API_KEY || '') :
      prov === 'gemini' ? (process.env.GEMINI_API_KEY || '') :
      prov === 'deepseek' ? (process.env.DEEPSEEK_API_KEY || '') :
      prov === 'nvidia' ? (process.env.NVIDIA_API_KEY || '') :
      (process.env.OPENROUTER_API_KEY || '')
    );
    let userKeysPromise = null;
    const resolveKey = async (prov) => {
      if (apiKey) return apiKey;
      const envK = envKeyFor(prov);
      if (envK) return envK;
      if (!username) return '';
      if (!userKeysPromise) userKeysPromise = getUserProviderKeys(username);
      const raced = await Promise.race([
        userKeysPromise,
        new Promise((r) => setTimeout(() => r({}), 1200)),
      ]);
      const k = prov === 'openai' ? raced.openai
        : (prov === 'claude' || prov === 'anthropic') ? raced.claude
        : prov === 'gemini' ? raced.gemini
        : prov === 'deepseek' ? raced.deepseek
        : prov === 'nvidia' ? raced.nvidia
        : raced.openrouter;
      return k || '';
    };
    let builder;
    if (provider === 'openai') builder = streamOpenAI({ model, system, messages, apiKey: await resolveKey('openai') });
    else if (provider === 'claude' || provider === 'anthropic') builder = streamAnthropic({ model, system, messages, apiKey: await resolveKey('claude') });
    else if (provider === 'gemini') builder = streamGemini({ model, system, messages, apiKey: await resolveKey('gemini') });
    else if (provider === 'deepseek') builder = streamDeepSeek({ model, system, messages, apiKey: await resolveKey('deepseek') });
    else if (provider === 'nvidia') builder = streamNvidia({ model, system, messages, apiKey: await resolveKey('nvidia') });
    else builder = streamOpenRouter({ model, system, messages, apiKey: await resolveKey('openrouter') });
    const { options, data } = builder;
    const hb = setInterval(() => { try { webContents.send('ai:stream:heartbeat', { sessionId }); } catch {} }, 1500);
    const req = https.request({ ...options, agent: KEEP_ALIVE_AGENT }, (res) => {
      res.setEncoding('utf8');
      const status = res.statusCode || 0;
      if (status >= 400) {
        let errBuf = '';
        res.on('data', (c) => { errBuf += String(c || ''); });
        res.on('end', () => {
          let detail = '';
          try { const j = JSON.parse(errBuf); if (j?.error?.message) detail = j.error.message; else if (j?.message) detail = j.message; } catch {}
          let msg = `HTTP ${status}`;
          if (status === 410) msg = `⚠️ El modelo ya no está disponible en este proveedor (HTTP 410 Gone).\n\nProbablemente fue removido o renombrado. Seleccioná otro modelo en el selector arriba del chat.`;
          else if (status === 401) msg = `🔐 Error de autenticación (HTTP 401). Verificá tu API key en Configuración.`;
          else if (status === 429) msg = `⏳ Límite de tasa excedido (HTTP 429). Esperá unos segundos o cambiá de modelo.`;
          else if (status === 500) msg = `🔥 Error interno del servidor (HTTP 500). El proveedor tiene problemas. Intentá más tarde.`;
          else if (status === 503) msg = `🔧 Servicio no disponible (HTTP 503). El proveedor está en mantenimiento.`;
          else if (detail) msg += `: ${detail}`;
          webContents.send('ai:stream:error', { sessionId, error: msg });
        });
        return;
      }
      res.on('data', (chunk) => {
        const lines = String(chunk).split('\n');
        for (const raw of lines) {
          let line = raw.trim();
          if (!line) continue;
          if (line === '[DONE]') continue;
          // Support both 'data: {...}' and raw '{...}'
          if (line.startsWith('data:')) line = line.slice(5).trim();
          try {
            const json = JSON.parse(line);
            let delta = '';
            // OpenAI/OpenRouter/DeepSeek/NVIDIA
            delta = json.choices?.[0]?.delta?.content || delta;
            // Anthropic
            if (!delta && (json.type === 'content_block_delta') && json.delta?.text) delta = json.delta.text;
            // Gemini
            if (!delta && json.candidates?.[0]?.content?.parts?.[0]?.text) delta = json.candidates[0].content.parts[0].text;
            if (delta) webContents.send('ai:stream:chunk', { sessionId, text: delta });
          } catch {}
        }
      });
      res.on('end', () => { try { clearInterval(hb); } catch {}; webContents.send('ai:stream:done', { sessionId }); });
    });
    req.on('error', (err) => {
      try { clearInterval(hb); } catch {}
      let msg = err.message;
      if (err.code === 'ENOTFOUND') {
        msg = `❌ No se pudo resolver ${options.hostname}.\n\nTu red no puede contactar este proveedor. Probá:\n• Usar otro modelo (ej: NVIDIA o Gemini)\n• Desactivar IPv6 en tu adaptador de red\n• Ejecutar: ipconfig /flushdns`;
      }
      webContents.send('ai:stream:error', { sessionId, error: msg });
    });
    req.setTimeout(45000, () => { try { clearInterval(hb); } catch {}; try { req.destroy(new Error('timeout')); } catch {}; webContents.send('ai:stream:error', { sessionId, error: 'Timeout' }); });
    req.write(data);
    req.end();
    AI_SESSIONS.set(sessionId, req);
    return { sessionId };
  } catch (e) {
    webContents.send('ai:stream:error', { sessionId, error: (e?.message || 'AI stream failed') });
    return { error: String(e?.message || e) };
  }
});

ipcMain.handle('ai:stream-abort', async (event, { sessionId }) => {
  const req = AI_SESSIONS.get(sessionId);
  if (req) {
    try { req.destroy(new Error('aborted')); } catch {}
    AI_SESSIONS.delete(sessionId);
  }
  return { ok: true };
});

// ── Terminal IPC (real console control) ──────────────────────────────
const TERMINAL_SESSIONS = new Map();

function insideRoot(root, target) {
  try {
    const base = realpathSync(root).replace(/\\/g, '/');
    const abs = realpathSync(target).replace(/\\/g, '/');
    return abs.startsWith(base);
  } catch { return false; }
}

ipcMain.handle('terminal:start', async (event, { root, shell, env }) => {
  const webContents = event.sender;
  try {
    if (!root || !existsSync(root) || !isDir(root)) return { error: 'Invalid root' };
    const safeCwd = realpathSync(root);
    const isWin = process.platform === 'win32';
    const cmd = shell || (isWin ? 'powershell.exe' : process.env.SHELL || 'bash');
    const args = isWin ? ['-NoLogo', '-NoExit', '-Command', '-'] : ['-l'];
    const child = spawn(cmd, args, { cwd: safeCwd, env: { ...process.env, ...(env || {}) }, stdio: 'pipe' });
    const sessionId = crypto.randomBytes(8).toString('hex');
    TERMINAL_SESSIONS.set(sessionId, child);
    child.stdout?.on('data', (d) => { webContents.send('terminal:data', { sessionId, data: d.toString() }); });
    child.stderr?.on('data', (d) => { webContents.send('terminal:data', { sessionId, data: d.toString() }); });
    child.on('close', (code) => { webContents.send('terminal:exit', { sessionId, code }); TERMINAL_SESSIONS.delete(sessionId); });
    return { sessionId };
  } catch (e) {
    return { error: e?.message || 'Failed to start terminal' };
  }
});

ipcMain.handle('terminal:input', async (_event, { sessionId, data }) => {
  const child = TERMINAL_SESSIONS.get(sessionId);
  if (!child) return { error: 'No such session' };
  try { child.stdin?.write(data); return { ok: true }; } catch (e) { return { error: e?.message || 'write failed' }; }
});

ipcMain.handle('terminal:kill', async (_event, { sessionId }) => {
  const child = TERMINAL_SESSIONS.get(sessionId);
  if (!child) return { ok: true };
  try { child.kill(); } catch {}
  TERMINAL_SESSIONS.delete(sessionId);
  return { ok: true };
});

// One-off safe shell run (for installing skills by command)
ipcMain.handle('shell:run', async (_event, { command, args = [], root, env, timeoutMs = 120000 }) => {
  try {
    if (!command) return { error: 'Missing command' };
    const cwd = (root && existsSync(root) && isDir(root)) ? realpathSync(root) : process.cwd();
    const child = spawn(command, args, { cwd, env: { ...process.env, ...(env || {}) } });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    const done = new Promise((resolve) => child.on('close', (code) => resolve({ code })));
    const to = setTimeout(() => { try { child.kill(); } catch {}; }, Math.max(10000, timeoutMs));
    const { code } = await done; clearTimeout(to);
    return { code, stdout: out, stderr: err };
  } catch (e) {
    return { error: e?.message || 'shell run failed' };
  }
});

// Open external links for skill installers
ipcMain.handle('shell:open-external', async (_e, { url }) => {
  try { if (url && /^https?:\/\//i.test(url)) await shell.openExternal(url); return { ok: true }; } catch (e) { return { error: e?.message || 'open failed' }; }
});

// ── Updater IPC ───────────────────────────────────────────────────
try { ipcMain.removeHandler('updates:check'); } catch {}
ipcMain.handle('updates:check', async () => {
  if (!AutoUpdaterRef) return { available: false, error: 'Updater not available' };
  try {
    const result = await AutoUpdaterRef.checkForUpdates();
    return {
      available: result?.updateInfo?.version && result.updateInfo.version !== app.getVersion(),
      version: result?.updateInfo?.version || null,
    };
  } catch (e) {
    return { available: false, error: e?.message || 'Check failed' };
  }
});

try { ipcMain.removeHandler('updates:install'); } catch {}
ipcMain.handle('updates:install', async () => {
  if (!AutoUpdaterRef) return { error: 'Updater not available' };
  try {
    AutoUpdaterRef.quitAndInstall(false, true);
    return { ok: true };
  } catch (e) {
    return { error: e?.message || 'Install failed' };
  }
});

/* ── Browser automation (Electron Chromium) ────────────────────────── */
const browserWindows = new Map();

ipcMain.handle('browser:open', async (_e, { url, width = 1280, height = 800 }) => {
  const id = crypto.randomBytes(6).toString('hex');
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  await win.loadURL(url);
  browserWindows.set(id, win);
  return { id, url };
});

ipcMain.handle('browser:screenshot', async (_e, { id }) => {
  const win = browserWindows.get(id);
  if (!win) return { error: 'Browser not found' };
  const image = await win.capturePage();
  const dataUrl = image.toDataURL();
  return { image: dataUrl };
});

ipcMain.handle('browser:evaluate', async (_e, { id, script }) => {
  const win = browserWindows.get(id);
  if (!win) return { error: 'Browser not found' };
  const result = await win.webContents.executeJavaScript(script);
  return { result: String(result) };
});

ipcMain.handle('browser:close', async (_e, { id }) => {
  const win = browserWindows.get(id);
  if (win) { win.destroy(); browserWindows.delete(id); }
  return { ok: true };
});
