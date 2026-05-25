import { useState, useCallback, useEffect } from 'react';
import { GitBranch, RefreshCw, Check } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';

export function GitPanel() {
  const rootPath = useEditorStore((s) => s.rootPath);
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const [statusRes, branchRes] = await Promise.all([
        fetch('/api/git/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: rootPath }) }).then((r) => r.json()),
        fetch('/api/git/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: rootPath }) }).then((r) => r.json()),
      ]);
      setStatus(statusRes.output || statusRes.error || '');
      const currentBranch = (branchRes.output || '').split('\n').find((l: string) => l.startsWith('*'));
      setBranch(currentBranch ? currentBranch.replace('* ', '').trim() : '');
    } catch {
      setStatus('Error al obtener status');
    }
    setLoading(false);
  }, [rootPath]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleCommit = useCallback(async () => {
    if (!rootPath || !commitMsg.trim()) return;
    setLoading(true);
    await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: rootPath, message: commitMsg.trim() }),
    });
    setCommitMsg('');
    await fetchStatus();
  }, [rootPath, commitMsg, fetchStatus]);

  if (!rootPath) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Abre un proyecto para ver el estado de Git.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <GitBranch size={12} className="text-accent" />
          <span className="text-[11px] font-medium text-foreground">{branch || '...'}</span>
        </div>
        <button onClick={fetchStatus} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cambios</div>
        {status ? (
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{status}</pre>
        ) : (
          <p className="text-xs text-muted-foreground">Sin cambios pendientes</p>
        )}
      </div>

      <div className="border-t border-border p-3">
        <input
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
          placeholder="Mensaje de commit..."
          className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent placeholder:text-muted-foreground"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMsg.trim() || loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-40"
        >
          <Check size={12} /> Commit All
        </button>
      </div>
    </div>
  );
}
