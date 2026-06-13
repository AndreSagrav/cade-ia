import { Router } from 'express';
import { exec } from 'child_process';
import { config } from '../config';
import { z } from 'zod';
export const terminalRouter = Router();
// Allowed commands whitelist (basic protection)
const BLOCKED_PATTERNS = [
    /rm\s+-rf\s+\//i,
    /format\s+[a-z]:/i,
    /del\s+\/[sf]/i,
    /shutdown/i,
    /mkfs/i,
];
const ALLOWED_BINARIES = new Set([
    'git', 'npm', 'yarn', 'pnpm',
    'node', 'tsc', 'vitest', 'vite',
    'pytest', 'python',
    'dir', 'ls', 'type', 'cat', 'echo'
]);
function isCommandSafe(cmd) {
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(cmd)))
        return false;
    const first = cmd.trim().split(/\s+/)[0].toLowerCase();
    return ALLOWED_BINARIES.has(first);
}
terminalRouter.post('/run', (req, res) => {
    if (!config.enableTerminal) {
        return res.status(403).json({ error: 'Terminal is disabled in this environment' });
    }
    const schema = z.object({ cmd: z.string().min(1).max(500), cwd: z.string().min(1).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid body' });
    const { cmd, cwd } = parsed.data;
    if (!cmd || typeof cmd !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid cmd' });
    }
    if (cmd.length > 500) {
        return res.status(400).json({ error: 'Command too long (max 500 chars)' });
    }
    if (!isCommandSafe(cmd)) {
        return res.status(403).json({ error: 'Command blocked for safety' });
    }
    const options = {
        timeout: 30000,
        maxBuffer: 1024 * 1024, // 1MB
        encoding: 'utf8',
        cwd: cwd || process.cwd(),
    };
    exec(cmd, options, (error, stdout, stderr) => {
        const code = error?.code ?? 0;
        res.json({
            stdout: stdout?.toString() ?? '',
            stderr: stderr?.toString() ?? '',
            code: typeof code === 'number' ? code : 1,
        });
    });
});
