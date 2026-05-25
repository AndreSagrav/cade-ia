import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export const gitRouter = Router();

function runGit(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(`git ${cmd}`, { cwd, timeout: 15000, maxBuffer: 512 * 1024 }, (_error, stdout, stderr) => {
      resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
    });
  });
}

function isGitRepo(cwd: string): boolean {
  return existsSync(join(cwd, '.git'));
}

gitRouter.post('/status', async (req: Request, res: Response) => {
  const { cwd } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });

  const result = await runGit('status --porcelain', cwd);
  res.json({ ok: true, output: result.stdout });
});

gitRouter.post('/log', async (req: Request, res: Response) => {
  const { cwd, limit = 20 } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });

  const result = await runGit(`log --oneline -n ${limit}`, cwd);
  res.json({ ok: true, output: result.stdout });
});

gitRouter.post('/diff', async (req: Request, res: Response) => {
  const { cwd, file } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });

  const cmd = file ? `diff -- "${file}"` : 'diff';
  const result = await runGit(cmd, cwd);
  res.json({ ok: true, output: result.stdout });
});

gitRouter.post('/commit', async (req: Request, res: Response) => {
  const { cwd, message } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });
  if (!message) return res.status(400).json({ error: 'Missing commit message' });

  await runGit('add -A', cwd);
  const result = await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
  res.json({ ok: true, output: result.stdout || result.stderr });
});

gitRouter.post('/branch', async (req: Request, res: Response) => {
  const { cwd } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });

  const result = await runGit('branch -a', cwd);
  res.json({ ok: true, output: result.stdout });
});

