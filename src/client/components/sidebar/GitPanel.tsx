import { useState, useCallback, useEffect } from 'react';
import { GitBranch, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Plus, FolderGit2, ExternalLink, ChevronDown, ChevronRight, AlertCircle, Github, Download } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useSettingsStore } from '@/store/settings-store';
import { useProject } from '@/lib/use-project';


interface GHUser { login: string; avatar_url: string; name: string; html_url: string }
interface GHRepo { name: string; full_name: string; html_url: string; clone_url: string; private: boolean; description: string; updated_at: string; default_branch: string }
interface ChangedFile { status: string; file: string }

const STATUS_COLORS: Record<string, string> = {
  M: '#eab308',   // modified = yellow
  A: '#22c55e',   // added = green
  D: '#ef4444',   // deleted = red
  '??': '#6b7280', // untracked = gray
  R: '#3b82f6',   // renamed = blue
  U: '#f97316',   // unmerged = orange
};

function parseStatus(raw: string): ChangedFile[] {
  if (!raw.trim()) return [];
  return raw.trim().split('\n').map(line => {
    const status = line.substring(0, 2).trim() || '??';
    const file = line.substring(3).trim();
    return { status, file };
  });
}

export function GitPanel() {
  const rootPath = useEditorStore((s) => s.rootPath);
  const settingsStore = useSettingsStore();
  const { handleFolderSelected } = useProject();
  const githubAccounts = settingsStore.githubAccounts || [];
  const activeGithubAccount = settingsStore.activeGithubAccount;
  const setActiveGithubAccount = settingsStore.setActiveGithubAccount;
  
  const activeAccount = githubAccounts.find(a => a.username === activeGithubAccount) || githubAccounts[0];
  const githubToken = activeAccount?.token || '';

  const [ghUser, setGhUser] = useState<GHUser | null>(null);
  const [branch, setBranch] = useState('');
  const [changes, setChanges] = useState<ChangedFile[]>([]);
  const [isGitRepo, setIsGitRepo] = useState(true);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showRepos, setShowRepos] = useState(false);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  // Fetch GitHub profile
  useEffect(() => {
    if (!githubToken) { setGhUser(null); return; }
    fetch('/api/github/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: githubToken }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setGhUser(d.user); else setGhUser(null); })
      .catch(() => setGhUser(null));
  }, [githubToken]);

  // Fetch git status
  const fetchStatus = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const [statusRes, branchRes] = await Promise.all([
        fetch('/api/git/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: rootPath }) }).then(r => r.json()),
        fetch('/api/git/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: rootPath }) }).then(r => r.json()),
      ]);

      if (statusRes.error === 'Not a git repository') {
        setIsGitRepo(false);
        setChanges([]);
        setBranch('');
      } else {
        setIsGitRepo(true);
        setChanges(parseStatus(statusRes.output || ''));
        const cur = (branchRes.output || '').split('\n').find((l: string) => l.startsWith('*'));
        setBranch(cur ? cur.replace('* ', '').trim() : 'main');
      }
    } catch {
      setIsGitRepo(false);
    }
    setLoading(false);
  }, [rootPath]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Init git
  const handleInit = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    await fetch('/api/git/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: rootPath }) });
    await fetchStatus();
  }, [rootPath, fetchStatus]);

  // Commit & Push
  const handleCommitPush = useCallback(async () => {
    if (!rootPath || !commitMsg.trim()) return;
    setPushLoading(true);
    setFeedback(null);
    try {
      // 1. Commit
      const commitRes = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: rootPath, message: commitMsg.trim() }),
      }).then(r => r.json());

      if (!commitRes.ok) {
        setFeedback({ type: 'err', msg: commitRes.error || commitRes.output || 'Error al hacer commit' });
        setPushLoading(false);
        return;
      }

      // 2. Auto-push
      if (githubToken) {
        const pushRes = await fetch('/api/git/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd: rootPath, token: githubToken, branch }),
        }).then(r => r.json());

        if (pushRes.ok) {
          setFeedback({ type: 'ok', msg: '✅ Commit & Push exitoso' });
        } else {
          setFeedback({ type: 'err', msg: `Commit OK pero push falló: ${pushRes.error || pushRes.output}` });
        }
      } else {
        setFeedback({ type: 'ok', msg: '✅ Commit exitoso (sin push — selecciona una cuenta de GitHub)' });
      }

      setCommitMsg('');
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message || 'Error' });
    }
    setPushLoading(false);
  }, [rootPath, commitMsg, githubToken, branch, fetchStatus]);

  // Pull
  const handlePull = useCallback(async () => {
    if (!rootPath) return;
    setPullLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: rootPath, token: githubToken || undefined, branch }),
      }).then(r => r.json());
      setFeedback({ type: res.ok ? 'ok' : 'err', msg: res.output || res.error || 'Done' });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message });
    }
    setPullLoading(false);
  }, [rootPath, githubToken, branch, fetchStatus]);

  // Fetch repos
  const fetchRepos = useCallback(async () => {
    if (!githubToken) return;
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken }),
      }).then(r => r.json());
      if (res.ok) setRepos(res.repos);
    } catch { /* ignore */ }
    setReposLoading(false);
  }, [githubToken]);

  // No project open
  if (!rootPath) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <FolderGit2 size={28} className="opacity-40" />
          <span>Abre un proyecto para usar Git</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-[12px]">
      {/* GitHub Connection */}
      <div className="flex flex-col gap-2 border-b px-3 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="flex items-center gap-2">
          {ghUser ? (
            <>
              <img src={ghUser.avatar_url} alt="" className="h-5 w-5 rounded-full" />
              <span className="flex-1 truncate text-[11px] font-medium">{ghUser.login}</span>
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: '#22c55e22', color: '#22c55e' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#22c55e' }} />
                Conectado
              </span>
            </>
          ) : (
            <>
              <Github size={14} className="opacity-50" />
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">GitHub no conectado</span>
              <button
                onClick={() => document.dispatchEvent(new CustomEvent('open-settings'))}
                className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/20 transition-colors"
              >
                Conectar
              </button>
            </>
          )}
        </div>
        
        {githubAccounts.length > 1 && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">Usando cuenta:</span>
            <select 
              value={activeGithubAccount || ''}
              onChange={(e) => setActiveGithubAccount(e.target.value)}
              className="flex-1 rounded border px-1.5 py-0.5 text-[10px] outline-none"
              style={{ background: 'hsl(var(--muted))', borderColor: 'hsl(var(--border))' }}
            >
              {githubAccounts.map(acc => (
                <option key={acc.username} value={acc.username}>{acc.username}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Not a git repo */}
      {!isGitRepo ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle size={24} className="text-muted-foreground opacity-50" />
          <p className="text-[11px] text-muted-foreground">Este proyecto no es un repositorio Git</p>
          <button
            onClick={handleInit}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold text-white transition-colors"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
          >
            <Plus size={12} /> Inicializar Git
          </button>
        </div>
      ) : (
        <>
          {/* Branch & refresh */}
          <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center gap-1.5">
              <GitBranch size={12} style={{ color: '#89b4fa' }} />
              <span className="text-[11px] font-semibold">{branch || '...'}</span>
            </div>
            <button onClick={fetchStatus} className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors" style={{ background: 'transparent' }}>
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Changed files */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Cambios ({changes.length})
              </span>
            </div>
            {changes.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-muted-foreground opacity-60">Sin cambios pendientes ✓</p>
            ) : (
              <div className="flex flex-col">
                {changes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-[5px] hover:bg-muted/30 transition-colors">
                    <span
                      className="h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{ background: STATUS_COLORS[c.status] || '#6b7280' }}
                    />
                    <span className="flex-1 truncate text-[11px]">{c.file}</span>
                    <span className="text-[9px] font-bold text-muted-foreground">{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className="mx-3 mb-1 rounded-md px-2 py-1 text-[10px]"
              style={{
                background: feedback.type === 'ok' ? '#22c55e18' : '#ef444418',
                color: feedback.type === 'ok' ? '#22c55e' : '#ef4444',
              }}
            >
              {feedback.msg}
            </div>
          )}

          {/* Commit & Push */}
          <div className="border-t p-3 space-y-2" style={{ borderColor: 'hsl(var(--border))' }}>
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommitPush()}
              placeholder="Mensaje de commit..."
              className="w-full rounded-md border px-2.5 py-1.5 text-[11px] outline-none transition-colors focus:border-accent"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleCommitPush}
                disabled={!commitMsg.trim() || pushLoading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold text-white transition-all disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #89b4fa, #cba6f7)' }}
              >
                {pushLoading ? <RefreshCw size={11} className="animate-spin" /> : <><ArrowUpFromLine size={11} /> Commit & Push</>}
              </button>
              <button
                onClick={handlePull}
                disabled={pullLoading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all"
                style={{ background: 'hsl(var(--muted) / 0.5)', color: 'hsl(var(--foreground))' }}
              >
                {pullLoading ? <RefreshCw size={11} className="animate-spin" /> : <><ArrowDownToLine size={11} /> Pull</>}
              </button>
            </div>
          </div>

      {/* My Repos (expandable) */}
      <div className="border-t" style={{ borderColor: 'hsl(var(--border))' }}>
        <button
          onClick={() => { setShowRepos(!showRepos); if (!showRepos && repos.length === 0) fetchRepos(); }}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showRepos ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Mis Repositorios
        </button>
        {showRepos && (
          <div className="max-h-[200px] overflow-y-auto pb-2">
            {reposLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : repos.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">No se encontraron repositorios</p>
            ) : (
              repos.map(repo => (
                <div key={repo.full_name} className="flex items-center gap-2 px-3 py-[6px] hover:bg-muted/30 transition-colors">
                  <FolderGit2 size={12} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-medium truncate">{repo.name}</span>
                      {repo.private && (
                        <span className="text-[8px] rounded px-1 py-px font-bold" style={{ background: '#eab30822', color: '#eab308' }}>
                          PRIV
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[9px] text-muted-foreground truncate">{repo.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        const defaultDir = rootPath 
                          ? rootPath.substring(0, Math.max(rootPath.lastIndexOf('/'), rootPath.lastIndexOf('\\'))) 
                          : 'C:/Users/Taller SK/Documents/PROYECTOS';
                        const parentDir = prompt(`¿En qué carpeta deseas clonar ${repo.name}?`, defaultDir);
                        if (!parentDir) return;
                        
                        const destination = `${parentDir}/${repo.name}`.replace(/\\/g, '/');
                        setReposLoading(true);
                        try {
                          let cloneUrl = repo.clone_url;
                          if (githubToken && cloneUrl.startsWith('https://')) {
                            cloneUrl = cloneUrl.replace('https://', `https://x-access-token:${githubToken}@`);
                          }
                          
                          const res = await fetch('/api/git/clone', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: cloneUrl, destination })
                          }).then(r => r.json());
                          
                          if (res.ok) {
                            handleFolderSelected(destination);
                          } else {
                            alert('Error clonando: ' + res.error);
                          }
                        } catch (e: any) {
                          alert('Error: ' + e.message);
                        }
                        setReposLoading(false);
                      }}
                      title="Clonar y Abrir Proyecto"
                      className="rounded p-1 text-accent hover:bg-accent/20 transition-colors"
                    >
                      <Download size={12} />
                    </button>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                      title="Ver en GitHub"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
