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

gitRouter.post('/clone', async (req: Request, res: Response) => {
  const { url, destination } = req.body;
  if (!url || !destination) return res.status(400).json({ error: 'Faltan parámetros url o destination' });

  try {
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      exec(`git clone "${url}" "${destination}"`, { timeout: 60000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stdout: stdout?.toString(), stderr: stderr?.toString() });
        } else {
          resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
        }
      });
    });
    res.json({ ok: true, output: result.stdout || result.stderr });
  } catch (err: any) {
    res.json({ ok: false, error: err.stderr || err.error?.message || 'Error desconocido al clonar' });
  }
});

gitRouter.post('/init', async (req: Request, res: Response) => {
  const { cwd } = req.body;
  if (!cwd) return res.status(400).json({ error: 'Missing cwd' });
  const result = await runGit('init', cwd);
  res.json({ ok: true, output: result.stdout || result.stderr });
});

gitRouter.post('/push', async (req: Request, res: Response) => {
  const { cwd, token, remote = 'origin', branch } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });

  let pushCmd = `push ${remote}`;
  if (branch) pushCmd += ` ${branch}`;

  if (token) {
    // Inject token into remote URL for HTTPS auth
    const remoteUrl = await runGit(`config --get remote.${remote}.url`, cwd);
    const url = remoteUrl.stdout.trim();
    if (url.startsWith('https://')) {
      const authedUrl = url.replace('https://', `https://x-access-token:${token}@`);
      try {
        const result = await runGit(`push ${authedUrl} ${branch || 'HEAD'}`, cwd);
        res.json({ ok: true, output: result.stdout || result.stderr });
      } catch (e: any) {
        res.json({ ok: false, error: e.stderr || e.error?.message || 'Error en push' });
      }
    } else {
      try {
        const result = await runGit(pushCmd, cwd);
        res.json({ ok: true, output: result.stdout || result.stderr });
      } catch (e: any) {
        res.json({ ok: false, error: e.stderr || e.error?.message || 'Error en push' });
      }
    }
  } else {
    try {
      const result = await runGit(pushCmd, cwd);
      res.json({ ok: true, output: result.stdout || result.stderr });
    } catch (e: any) {
      res.json({ ok: false, error: e.stderr || e.error?.message || 'Error en push' });
    }
  }
});

gitRouter.post('/pull', async (req: Request, res: Response) => {
  const { cwd, token, remote = 'origin', branch } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });

  let pullCmd = `pull ${remote}`;
  if (branch) pullCmd += ` ${branch}`;

  if (token) {
    const remoteUrl = await runGit(`config --get remote.${remote}.url`, cwd);
    const url = remoteUrl.stdout.trim();
    if (url.startsWith('https://')) {
      const authedUrl = url.replace('https://', `https://x-access-token:${token}@`);
      try {
        const result = await runGit(`pull ${authedUrl} ${branch || 'HEAD'}`, cwd);
        res.json({ ok: true, output: result.stdout || result.stderr });
      } catch (e: any) {
        res.json({ ok: false, error: e.stderr || e.error?.message || 'Error en pull' });
      }
    } else {
      try {
        const result = await runGit(pullCmd, cwd);
        res.json({ ok: true, output: result.stdout || result.stderr });
      } catch (e: any) {
        res.json({ ok: false, error: e.stderr || e.error?.message || 'Error en pull' });
      }
    }
  } else {
    try {
      const result = await runGit(pullCmd, cwd);
      res.json({ ok: true, output: result.stdout || result.stderr });
    } catch (e: any) {
      res.json({ ok: false, error: e.stderr || e.error?.message || 'Error en pull' });
    }
  }
});

gitRouter.post('/remote/list', async (req: Request, res: Response) => {
  const { cwd } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });
  const result = await runGit('remote -v', cwd);
  res.json({ ok: true, output: result.stdout });
});

gitRouter.post('/remote/add', async (req: Request, res: Response) => {
  const { cwd, name = 'origin', url } = req.body;
  if (!cwd || !isGitRepo(cwd)) return res.json({ ok: false, error: 'Not a git repository' });
  if (!url) return res.status(400).json({ error: 'Missing remote url' });

  await runGit(`remote remove ${name}`, cwd);
  const result = await runGit(`remote add ${name} ${url}`, cwd);
  res.json({ ok: true, output: result.stdout || result.stderr || 'Remote added' });
});
