import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { GitBranch, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Plus, FolderGit2, ExternalLink, ChevronDown, ChevronRight, AlertCircle, Github, Download } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useSettingsStore } from '@/store/settings-store';
import { useProject } from '@/lib/use-project';
const STATUS_COLORS = {
    M: '#eab308', // modified = yellow
    A: '#22c55e', // added = green
    D: '#ef4444', // deleted = red
    '??': '#6b7280', // untracked = gray
    R: '#3b82f6', // renamed = blue
    U: '#f97316', // unmerged = orange
};
function parseStatus(raw) {
    if (!raw.trim())
        return [];
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
    const [ghUser, setGhUser] = useState(null);
    const [branch, setBranch] = useState('');
    const [changes, setChanges] = useState([]);
    const [isGitRepo, setIsGitRepo] = useState(true);
    const [commitMsg, setCommitMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pullLoading, setPullLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [showRepos, setShowRepos] = useState(false);
    const [repos, setRepos] = useState([]);
    const [reposLoading, setReposLoading] = useState(false);
    // Fetch GitHub profile
    useEffect(() => {
        if (!githubToken) {
            setGhUser(null);
            return;
        }
        fetch('/api/github/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: githubToken }),
        })
            .then(r => r.json())
            .then(d => { if (d.ok)
            setGhUser(d.user);
        else
            setGhUser(null); })
            .catch(() => setGhUser(null));
    }, [githubToken]);
    // Fetch git status
    const fetchStatus = useCallback(async () => {
        if (!rootPath)
            return;
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
            }
            else {
                setIsGitRepo(true);
                setChanges(parseStatus(statusRes.output || ''));
                const cur = (branchRes.output || '').split('\n').find((l) => l.startsWith('*'));
                setBranch(cur ? cur.replace('* ', '').trim() : 'main');
            }
        }
        catch {
            setIsGitRepo(false);
        }
        setLoading(false);
    }, [rootPath]);
    useEffect(() => { fetchStatus(); }, [fetchStatus]);
    // Init git
    const handleInit = useCallback(async () => {
        if (!rootPath)
            return;
        setLoading(true);
        await fetch('/api/git/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: rootPath }) });
        await fetchStatus();
    }, [rootPath, fetchStatus]);
    // Commit & Push
    const handleCommitPush = useCallback(async () => {
        if (!rootPath || !commitMsg.trim())
            return;
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
                }
                else {
                    setFeedback({ type: 'err', msg: `Commit OK pero push falló: ${pushRes.error || pushRes.output}` });
                }
            }
            else {
                setFeedback({ type: 'ok', msg: '✅ Commit exitoso (sin push — selecciona una cuenta de GitHub)' });
            }
            setCommitMsg('');
            await fetchStatus();
        }
        catch (err) {
            setFeedback({ type: 'err', msg: err.message || 'Error' });
        }
        setPushLoading(false);
    }, [rootPath, commitMsg, githubToken, branch, fetchStatus]);
    // Pull
    const handlePull = useCallback(async () => {
        if (!rootPath)
            return;
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
        }
        catch (err) {
            setFeedback({ type: 'err', msg: err.message });
        }
        setPullLoading(false);
    }, [rootPath, githubToken, branch, fetchStatus]);
    // Fetch repos
    const fetchRepos = useCallback(async () => {
        if (!githubToken)
            return;
        setReposLoading(true);
        try {
            const res = await fetch('/api/github/repos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: githubToken }),
            }).then(r => r.json());
            if (res.ok)
                setRepos(res.repos);
        }
        catch { /* ignore */ }
        setReposLoading(false);
    }, [githubToken]);
    // No project open
    if (!rootPath) {
        return (_jsx("div", { className: "flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx(FolderGit2, { size: 28, className: "opacity-40" }), _jsx("span", { children: "Abre un proyecto para usar Git" })] }) }));
    }
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden text-[12px]", children: [_jsxs("div", { className: "flex flex-col gap-2 border-b px-3 py-2", style: { borderColor: 'hsl(var(--border))' }, children: [_jsx("div", { className: "flex items-center gap-2", children: ghUser ? (_jsxs(_Fragment, { children: [_jsx("img", { src: ghUser.avatar_url, alt: "", className: "h-5 w-5 rounded-full" }), _jsx("span", { className: "flex-1 truncate text-[11px] font-medium", children: ghUser.login }), _jsxs("span", { className: "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", style: { background: '#22c55e22', color: '#22c55e' }, children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full", style: { background: '#22c55e' } }), "Conectado"] })] })) : (_jsxs(_Fragment, { children: [_jsx(Github, { size: 14, className: "opacity-50" }), _jsx("span", { className: "flex-1 text-[11px] font-medium text-muted-foreground", children: "GitHub no conectado" }), _jsx("button", { onClick: () => document.dispatchEvent(new CustomEvent('open-settings')), className: "rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/20 transition-colors", children: "Conectar" })] })) }), githubAccounts.length > 1 && (_jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("span", { className: "text-[10px] text-muted-foreground", children: "Usando cuenta:" }), _jsx("select", { value: activeGithubAccount || '', onChange: (e) => setActiveGithubAccount(e.target.value), className: "flex-1 rounded border px-1.5 py-0.5 text-[10px] outline-none", style: { background: 'hsl(var(--muted))', borderColor: 'hsl(var(--border))' }, children: githubAccounts.map(acc => (_jsx("option", { value: acc.username, children: acc.username }, acc.username))) })] }))] }), !isGitRepo ? (_jsxs("div", { className: "flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center", children: [_jsx(AlertCircle, { size: 24, className: "text-muted-foreground opacity-50" }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "Este proyecto no es un repositorio Git" }), _jsxs("button", { onClick: handleInit, disabled: loading, className: "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold text-white transition-colors", style: { background: 'linear-gradient(135deg, #22c55e, #16a34a)' }, children: [_jsx(Plus, { size: 12 }), " Inicializar Git"] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between border-b px-3 py-1.5", style: { borderColor: 'hsl(var(--border))' }, children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(GitBranch, { size: 12, style: { color: '#89b4fa' } }), _jsx("span", { className: "text-[11px] font-semibold", children: branch || '...' })] }), _jsx("button", { onClick: fetchStatus, className: "rounded p-1 text-muted-foreground hover:text-foreground transition-colors", style: { background: 'transparent' }, children: _jsx(RefreshCw, { size: 11, className: loading ? 'animate-spin' : '' }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [_jsx("div", { className: "px-3 py-1.5", children: _jsxs("span", { className: "text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground", children: ["Cambios (", changes.length, ")"] }) }), changes.length === 0 ? (_jsx("p", { className: "px-3 py-2 text-[11px] text-muted-foreground opacity-60", children: "Sin cambios pendientes \u2713" })) : (_jsx("div", { className: "flex flex-col", children: changes.map((c, i) => (_jsxs("div", { className: "flex items-center gap-2 px-3 py-[5px] hover:bg-muted/30 transition-colors", children: [_jsx("span", { className: "h-[6px] w-[6px] shrink-0 rounded-full", style: { background: STATUS_COLORS[c.status] || '#6b7280' } }), _jsx("span", { className: "flex-1 truncate text-[11px]", children: c.file }), _jsx("span", { className: "text-[9px] font-bold text-muted-foreground", children: c.status })] }, i))) }))] }), feedback && (_jsx("div", { className: "mx-3 mb-1 rounded-md px-2 py-1 text-[10px]", style: {
                            background: feedback.type === 'ok' ? '#22c55e18' : '#ef444418',
                            color: feedback.type === 'ok' ? '#22c55e' : '#ef4444',
                        }, children: feedback.msg })), _jsxs("div", { className: "border-t p-3 space-y-2", style: { borderColor: 'hsl(var(--border))' }, children: [_jsx("input", { value: commitMsg, onChange: (e) => setCommitMsg(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleCommitPush(), placeholder: "Mensaje de commit...", className: "w-full rounded-md border px-2.5 py-1.5 text-[11px] outline-none transition-colors focus:border-accent", style: { borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' } }), _jsxs("div", { className: "flex gap-1.5", children: [_jsx("button", { onClick: handleCommitPush, disabled: !commitMsg.trim() || pushLoading, className: "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold text-white transition-all disabled:opacity-30", style: { background: 'linear-gradient(135deg, #89b4fa, #cba6f7)' }, children: pushLoading ? _jsx(RefreshCw, { size: 11, className: "animate-spin" }) : _jsxs(_Fragment, { children: [_jsx(ArrowUpFromLine, { size: 11 }), " Commit & Push"] }) }), _jsx("button", { onClick: handlePull, disabled: pullLoading, className: "flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all", style: { background: 'hsl(var(--muted) / 0.5)', color: 'hsl(var(--foreground))' }, children: pullLoading ? _jsx(RefreshCw, { size: 11, className: "animate-spin" }) : _jsxs(_Fragment, { children: [_jsx(ArrowDownToLine, { size: 11 }), " Pull"] }) })] })] }), _jsxs("div", { className: "border-t", style: { borderColor: 'hsl(var(--border))' }, children: [_jsxs("button", { onClick: () => { setShowRepos(!showRepos); if (!showRepos && repos.length === 0)
                                    fetchRepos(); }, className: "flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors", children: [showRepos ? _jsx(ChevronDown, { size: 10 }) : _jsx(ChevronRight, { size: 10 }), "Mis Repositorios"] }), showRepos && (_jsx("div", { className: "max-h-[200px] overflow-y-auto pb-2", children: reposLoading ? (_jsx("div", { className: "flex items-center justify-center py-4", children: _jsx(RefreshCw, { size: 14, className: "animate-spin text-muted-foreground" }) })) : repos.length === 0 ? (_jsx("p", { className: "px-3 py-2 text-[11px] text-muted-foreground", children: "No se encontraron repositorios" })) : (repos.map(repo => (_jsxs("div", { className: "flex items-center gap-2 px-3 py-[6px] hover:bg-muted/30 transition-colors", children: [_jsx(FolderGit2, { size: 12, className: "shrink-0 text-muted-foreground" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[11px] font-medium truncate", children: repo.name }), repo.private && (_jsx("span", { className: "text-[8px] rounded px-1 py-px font-bold", style: { background: '#eab30822', color: '#eab308' }, children: "PRIV" }))] }), repo.description && (_jsx("p", { className: "text-[9px] text-muted-foreground truncate", children: repo.description }))] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: async () => {
                                                        const defaultDir = rootPath
                                                            ? rootPath.substring(0, Math.max(rootPath.lastIndexOf('/'), rootPath.lastIndexOf('\\')))
                                                            : 'C:/Users/Taller SK/Documents/PROYECTOS';
                                                        const parentDir = prompt(`¿En qué carpeta deseas clonar ${repo.name}?`, defaultDir);
                                                        if (!parentDir)
                                                            return;
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
                                                            }
                                                            else {
                                                                alert('Error clonando: ' + res.error);
                                                            }
                                                        }
                                                        catch (e) {
                                                            alert('Error: ' + e.message);
                                                        }
                                                        setReposLoading(false);
                                                    }, title: "Clonar y Abrir Proyecto", className: "rounded p-1 text-accent hover:bg-accent/20 transition-colors", children: _jsx(Download, { size: 12 }) }), _jsx("a", { href: repo.html_url, target: "_blank", rel: "noopener noreferrer", className: "rounded p-1 text-muted-foreground hover:bg-muted transition-colors", title: "Ver en GitHub", children: _jsx(ExternalLink, { size: 12 }) })] })] }, repo.full_name)))) }))] })] }))] }));
}
