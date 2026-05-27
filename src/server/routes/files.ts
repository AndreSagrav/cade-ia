import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve, dirname, relative } from 'path';

export const filesRouter = Router();

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  '__pycache__', '.venv', '.svelte-kit', '.nuxt',
]);

// Validate path doesn't escape the root
function validatePath(root: string, filePath: string): string | null {
  const resolved = resolve(root, filePath);
  const normalizedRoot = resolve(root);
  if (!resolved.startsWith(normalizedRoot)) return null;
  return resolved;
}

// Write file
filesRouter.post('/write', (req: Request, res: Response) => {
  const { path: filePath, content, root } = req.body;
  if (!filePath || content === undefined || !root) {
    return res.status(400).json({ error: 'Missing path, content, or root' });
  }

  const fullPath = validatePath(root, filePath);
  if (!fullPath) {
    return res.status(403).json({ error: 'Path traversal detected' });
  }

  try {
    const dir = dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Write failed';
    res.status(500).json({ error: message });
  }
});

// Read file
filesRouter.post('/read', (req: Request, res: Response) => {
  const { path: filePath, root } = req.body;
  if (!filePath || !root) {
    return res.status(400).json({ error: 'Missing path or root' });
  }

  const fullPath = validatePath(root, filePath);
  if (!fullPath) {
    return res.status(403).json({ error: 'Path traversal detected' });
  }

  try {
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = readFileSync(fullPath, 'utf-8');
    res.json({ ok: true, content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Read failed';
    res.status(500).json({ error: message });
  }
});

// File tree
filesRouter.post('/tree', (req: Request, res: Response) => {
  const { root, maxDepth = 5 } = req.body;
  if (!root) {
    return res.status(400).json({ error: 'Missing root' });
  }

  try {
    const items = buildTree(root, 0, maxDepth);
    res.json({ ok: true, items, root });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tree failed';
    res.status(500).json({ error: message });
  }
});

// Resolve folder path
filesRouter.post('/resolve', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  // Try common locations
  const candidates = [
    resolve(process.cwd(), name),
    resolve(process.env.HOME ?? process.env.USERPROFILE ?? '', 'Documents', name),
    resolve(process.env.HOME ?? process.env.USERPROFILE ?? '', 'Projects', name),
    resolve(process.env.HOME ?? process.env.USERPROFILE ?? '', 'Documents', 'PROYECTOS', name),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return res.json({ path: candidate });
    }
  }

  res.json({ path: name, guessed: true });
});

// List directories for folder picker
filesRouter.post('/list-directories', (req: Request, res: Response) => {
  const { path: dirPath } = req.body;

  try {
    if (!dirPath) {
      // Return root drives for Windows, or / for Unix
      if (process.platform === 'win32') {
        try {
          const output = execSync('wmic logicaldisk get name', { encoding: 'utf-8' });
          const drives = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length === 2 && line.endsWith(':'))
            .map(drive => drive + '\\');
          return res.json({ ok: true, items: drives.map(d => ({ name: d, path: d })), parent: null });
        } catch {
          // fallback
          const drives = ['C:\\', 'D:\\', 'E:\\'].filter(d => existsSync(d));
          return res.json({ ok: true, items: drives.map(d => ({ name: d, path: d })), parent: null });
        }
      } else {
        return res.json({ ok: true, items: [{ name: '/', path: '/' }], parent: null });
      }
    }

    if (!existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const stat = statSync(dirPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const entries = readdirSync(dirPath, { withFileTypes: true });
    const items = entries
      .filter(e => e.isDirectory())
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => ({
        name: e.name,
        path: join(dirPath, e.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = dirname(dirPath);
    const hasParent = parent && parent !== dirPath && existsSync(parent);

    res.json({ ok: true, items, parent: hasParent ? parent : null, current: dirPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list directories';
    res.status(500).json({ error: message });
  }
});

function buildTree(dir: string, depth: number, maxDepth: number): object[] {
  if (depth >= maxDepth) return [];
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const items: object[] = [];

  // Sort: directories first, then alphabetical
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const entryPath = join(dir, entry.name);
    const relativePath = relative(dir, entryPath);

    if (entry.isDirectory()) {
      const children = buildTree(entryPath, depth + 1, maxDepth);
      items.push({ name: entry.name, path: relativePath, kind: 'directory', children });
    } else {
      try {
        const stat = statSync(entryPath);
        items.push({ name: entry.name, path: relativePath, kind: 'file', size: stat.size });
      } catch {
        items.push({ name: entry.name, path: relativePath, kind: 'file' });
      }
    }
  }

  return items;
}
