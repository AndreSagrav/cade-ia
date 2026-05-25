import { Router, Request, Response } from 'express';
import { exec, type ExecException, type ExecOptionsWithStringEncoding } from 'child_process';

export const terminalRouter = Router();

// Allowed commands whitelist (basic protection)
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /format\s+[a-z]:/i,
  /del\s+\/[sf]/i,
  /shutdown/i,
  /mkfs/i,
];

function isCommandSafe(cmd: string): boolean {
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(cmd));
}

terminalRouter.post('/run', (req: Request, res: Response) => {
  const { cmd, cwd } = req.body;

  if (!cmd || typeof cmd !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid cmd' });
  }

  if (cmd.length > 500) {
    return res.status(400).json({ error: 'Command too long (max 500 chars)' });
  }

  if (!isCommandSafe(cmd)) {
    return res.status(403).json({ error: 'Command blocked for safety' });
  }

  const options: ExecOptionsWithStringEncoding = {
    timeout: 30000,
    maxBuffer: 1024 * 1024, // 1MB
    encoding: 'utf8',
    cwd: cwd || process.cwd(),
  };

  exec(cmd, options, (error: ExecException | null, stdout: string, stderr: string) => {
    const code = error?.code ?? 0;
    res.json({
      stdout: stdout?.toString() ?? '',
      stderr: stderr?.toString() ?? '',
      code: typeof code === 'number' ? code : 1,
    });
  });
});

