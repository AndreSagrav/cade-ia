import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join } from 'path';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, realpathSync } from 'fs';
import net from 'net';
import crypto from 'crypto';
import { dirname } from 'path';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ReturnType<typeof spawn> | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let SERVER_PORT = 3001;
const PRELOAD_PATH = join(__dirname, 'preload.js');

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(preferred: number[]): Promise<number> {
  for (const p of preferred) {
    if (await isPortFree(p)) return p;
  }
  // fallback: scan a small range
  for (let p = 3001; p <= 3010; p++) {
    if (await isPortFree(p)) return p;
  }
  return 3001; // last resort
}

function resolveServerPath(): string {
  // When packaged, prefer the unpacked location so Node can execute it
  const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'dist-server', 'index.js');
  if (existsSync(unpacked)) return unpacked;
  // Fallback to relative path next to compiled files (dev/build env)
  return join(__dirname, '..', 'dist-server', 'index.js');
}

async function startServer() {
  // In production we avoid HTTP server and use IPC; nothing to do here.
  if (!isDev) return;

  const desired = Number(process.env.ELECTRON_SERVER_PORT || process.env.PORT || 3001);
  SERVER_PORT = await findAvailablePort([desired, 3002, 3003, 3004]);

  const serverPath = resolveServerPath();
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(SERVER_PORT) },
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
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
    // Load built static files without any HTTP server
    mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
const tokens = new Set<string>();
const AUTH_USER = process.env.AUTH_USER ?? '';
const AUTH_PASS = process.env.AUTH_PASS ?? '';

ipcMain.handle('auth:verify', async (_e, { token }: { token: string }) => {
  return { ok: tokens.has(token) || (!AUTH_USER && !AUTH_PASS) };
});

ipcMain.handle('auth:login', async (_e, { user, password }: { user: string; password: string }) => {
  if (AUTH_USER || AUTH_PASS) {
    if (user !== AUTH_USER || password !== AUTH_PASS) return { error: 'Credenciales inválidas' };
  }
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  return { token };
});

function isDir(p: string) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function listDirectories(path?: string) {
  if (!path) {
    if (process.platform === 'win32') {
      try {
        const out = require('child_process').execSync('wmic logicaldisk get name', { encoding: 'utf-8' });
        const drives = out.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length === 2 && l.endsWith(':')).map((d: string) => d + '\\');
        return { ok: true, items: drives.map((d: string) => ({ name: d, path: d })), parent: null, current: null };
      } catch {
        const drives = ['C:\\', 'D:\\', 'E:\\'].filter((d) => existsSync(d));
        return { ok: true, items: drives.map((d) => ({ name: d, path: d })), parent: null, current: null };
      }
    }
    return { ok: true, items: [{ name: '/', path: '/' }], parent: null, current: null };
  }
  if (!existsSync(path) || !isDir(path)) return { error: 'Directory not found' };
  const entries = readdirSync(path, { withFileTypes: true });
  const items = entries.filter(e => e.isDirectory()).filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => ({ name: e.name, path: join(path, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parent = dirname(path);
  const hasParent = parent && parent !== path && existsSync(parent);
  return { ok: true, items, parent: hasParent ? parent : null, current: path };
}

function buildTree(dir: string, depth: number, maxDepth: number, root: string): any[] {
  if (depth >= maxDepth) return [];
  if (!existsSync(dir) || !isDir(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const sorted = entries.sort((a, b) => (a.isDirectory() !== b.isDirectory() ? (a.isDirectory() ? -1 : 1) : a.name.localeCompare(b.name)));
  const items: any[] = [];
  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', '.svelte-kit', '.nuxt']).has(entry.name)) continue;
    const entryPath = join(dir, entry.name);
    const relativePath = require('path').relative(root, entryPath);
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

ipcMain.handle('files:resolve', async (_e, { name }: { name: string }) => {
  const p = require('path');
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

ipcMain.handle('files:tree', async (_e, { root, maxDepth = 5 }: { root: string; maxDepth?: number }) => {
  const p = require('path');
  let base: string | null = null;
  if (p.isAbsolute(root)) {
    if (!existsSync(root) || !isDir(root)) return { error: 'Directory not found', provided: root };
    base = realpathSync(root);
  } else {
    const { path: resolved, guessed } = await (ipcMain as any).invoke?.('files:resolve', { name: root }) ?? { path: root, guessed: true };
    if (guessed) return { error: 'Directory not found or not absolute', provided: root };
    base = resolved;
  }
  const items = buildTree(base!, 0, Math.min(8, maxDepth!), base!);
  return { ok: true, items, root };
});

ipcMain.handle('files:read', async (_e, { path, root }: { path: string; root: string }) => {
  const full = join(root, path);
  const content = readFileSync(full, 'utf-8');
  return { ok: true, content };
});

ipcMain.handle('files:write', async (_e, { path, content, root }: { path: string; content: string; root: string }) => {
  const full = join(root, path);
  writeFileSync(full, content, 'utf-8');
  return { ok: true, path };
});
