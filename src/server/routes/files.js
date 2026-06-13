import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, realpathSync, lstatSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve, dirname, relative, isAbsolute } from 'path';
import { z } from 'zod';
export const filesRouter = Router();
const SKIP_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build',
    '__pycache__', '.venv', '.svelte-kit', '.nuxt',
]);
// Validate path doesn't escape the root and isn't a symlink outside
function validatePath(root, filePath) {
    try {
        const normalizedRoot = realpathSync(resolve(root)).replace(/\\/g, '/');
        const abs = resolve(root, filePath);
        const absNorm = abs.replace(/\\/g, '/');
        if (!absNorm.startsWith(normalizedRoot))
            return null;
        // Ensure the real base (existing file or parent dir) is inside root (blocks symlink escapes)
        const basePath = existsSync(abs) ? abs : dirname(abs);
        const realBase = realpathSync(basePath).replace(/\\/g, '/');
        if (!realBase.startsWith(normalizedRoot))
            return null;
        // If file exists and is a symlink, ensure its target remains inside root
        if (existsSync(abs)) {
            try {
                const st = lstatSync(abs);
                if (st.isSymbolicLink()) {
                    const target = realpathSync(abs).replace(/\\/g, '/');
                    if (!target.startsWith(normalizedRoot))
                        return null;
                }
            }
            catch { }
        }
        return abs;
    }
    catch {
        return null;
    }
}
// Write file
filesRouter.post('/write', (req, res) => {
    const schema = z.object({ path: z.string().min(1).max(500), content: z.string(), root: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { path: filePath, content, root } = parsed.data;
    if (!filePath || content === undefined || !root) {
        return res.status(400).json({ error: 'Missing path, content, or root' });
    }
    const fullPath = validatePath(root, filePath);
    if (!fullPath) {
        return res.status(403).json({ error: 'Path traversal detected' });
    }
    try {
        const dir = dirname(fullPath);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(fullPath, content, 'utf-8');
        res.json({ ok: true, path: filePath });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Write failed';
        res.status(500).json({ error: message });
    }
});
// Read file
filesRouter.post('/read', (req, res) => {
    const schema = z.object({ path: z.string().min(1).max(500), root: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { path: filePath, root } = parsed.data;
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Read failed';
        res.status(500).json({ error: message });
    }
});
// File tree
filesRouter.post('/tree', (req, res) => {
    const schema = z.object({ root: z.string().min(1), maxDepth: z.number().int().min(1).max(8).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { root, maxDepth = 5 } = parsed.data;
    if (!root) {
        return res.status(400).json({ error: 'Missing root' });
    }
    try {
        let realRoot = null;
        if (isAbsolute(root)) {
            if (!existsSync(root)) {
                return res.status(404).json({ error: 'Directory not found', provided: root });
            }
            realRoot = realpathSync(root);
        }
        else {
            const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
            const candidates = [
                resolve(process.cwd(), root),
                resolve(home, 'Documents', root),
                resolve(home, 'Projects', root),
                resolve(home, 'Documents', 'PROYECTOS', root),
                resolve(home, 'Documentos', root),
                resolve(home, 'OneDrive', 'Documents', root),
                resolve(home, 'OneDrive', 'Documentos', root),
                resolve(home, 'OneDrive', 'Documentos', 'PROYECTOS', root),
                resolve(home, 'OneDrive', 'Documents', 'PROYECTOS', root),
                resolve(home, 'Desktop', root),
                resolve(home, 'Escritorio', root),
            ];
            for (const cand of candidates) {
                if (existsSync(cand)) {
                    try {
                        const st = statSync(cand);
                        if (st.isDirectory()) {
                            realRoot = realpathSync(cand);
                            break;
                        }
                    }
                    catch { }
                }
            }
            if (!realRoot) {
                return res.status(404).json({ error: 'Directory not found or not absolute', provided: root });
            }
        }
        const items = buildTree(realRoot, 0, Math.min(8, maxDepth), realRoot);
        res.json({ ok: true, items, root });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Tree failed';
        res.status(500).json({ error: message });
    }
});
// Resolve folder path
filesRouter.post('/resolve', (req, res) => {
    const schema = z.object({ name: z.string().min(1).max(260) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { name } = parsed.data;
    if (!name)
        return res.status(400).json({ error: 'Missing name' });
    // If it's an absolute path and exists, accept it directly
    try {
        if (isAbsolute(name) && existsSync(name)) {
            const st = statSync(name);
            if (st.isDirectory()) {
                return res.json({ path: realpathSync(name) });
            }
        }
    }
    catch { }
    // Try common locations
    const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
    const candidates = [
        resolve(process.cwd(), name),
        resolve(home, 'Documents', name),
        resolve(home, 'Projects', name),
        resolve(home, 'Documents', 'PROYECTOS', name),
        resolve(home, 'Documentos', name),
        resolve(home, 'OneDrive', 'Documents', name),
        resolve(home, 'OneDrive', 'Documentos', name),
        resolve(home, 'OneDrive', 'Documentos', 'PROYECTOS', name),
        resolve(home, 'OneDrive', 'Documents', 'PROYECTOS', name),
        resolve(home, 'Desktop', name),
        resolve(home, 'Escritorio', name),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            try {
                const st = statSync(candidate);
                if (st.isDirectory())
                    return res.json({ path: realpathSync(candidate) });
            }
            catch { }
        }
    }
    res.json({ path: name, guessed: true });
});
// List directories for folder picker
filesRouter.post('/list-directories', (req, res) => {
    const schema = z.object({ path: z.string().min(1).max(500).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { path: dirPath } = parsed.data;
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
                }
                catch {
                    // fallback
                    const drives = ['C:\\', 'D:\\', 'E:\\'].filter(d => existsSync(d));
                    return res.json({ ok: true, items: drives.map(d => ({ name: d, path: d })), parent: null });
                }
            }
            else {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list directories';
        res.status(500).json({ error: message });
    }
});
function buildTree(dir, depth, maxDepth, root) {
    if (depth >= maxDepth)
        return [];
    if (!existsSync(dir))
        return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    const items = [];
    // Sort: directories first, then alphabetical
    const sorted = entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory())
            return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    for (const entry of sorted) {
        if (entry.name.startsWith('.') && entry.name !== '.env')
            continue;
        if (SKIP_DIRS.has(entry.name))
            continue;
        const entryPath = join(dir, entry.name);
        const relativePath = relative(root, entryPath);
        if (entry.isDirectory()) {
            const children = buildTree(entryPath, depth + 1, maxDepth, root);
            items.push({ name: entry.name, path: relativePath, kind: 'directory', children });
        }
        else {
            try {
                const stat = statSync(entryPath);
                items.push({ name: entry.name, path: relativePath, kind: 'file', size: stat.size });
            }
            catch {
                items.push({ name: entry.name, path: relativePath, kind: 'file' });
            }
        }
    }
    return items;
}
