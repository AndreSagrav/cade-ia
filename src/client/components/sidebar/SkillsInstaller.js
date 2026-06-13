import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Download, Check, X, Loader2, CloudDownload } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
export function SkillsInstaller() {
    const rootPath = useEditorStore((s) => s.rootPath);
    const [urls, setUrls] = useState('');
    const [jobs, setJobs] = useState([]);
    const [installing, setInstalling] = useState(false);
    const startInstall = async () => {
        if (!rootPath)
            return;
        // Extraer URLs separadas por línea o coma
        const parsedUrls = urls
            .split(/[\n,]+/)
            .map((u) => u.trim())
            .filter((u) => u.startsWith('http'));
        if (parsedUrls.length === 0)
            return;
        const newJobs = parsedUrls.map((url) => ({ url, status: 'pending' }));
        setJobs(newJobs);
        setUrls('');
        setInstalling(true);
        const destFolder = (rootPath.endsWith('\\') || rootPath.endsWith('/'))
            ? rootPath + 'skills'
            : rootPath + (rootPath.includes('\\') ? '\\skills' : '/skills');
        for (let i = 0; i < newJobs.length; i++) {
            setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'installing' } : j)));
            const repoName = newJobs[i].url.split('/').pop()?.replace('.git', '') || `app-${Date.now()}`;
            const destination = (destFolder.includes('\\') ? `${destFolder}\\${repoName}` : `${destFolder}/${repoName}`);
            // Use original URL, rely on local git credentials
            let finalUrl = newJobs[i].url;
            try {
                const wapi = (typeof window !== 'undefined' ? window.api : null);
                const useIpc = !!(wapi && wapi.shell && wapi.shell.run);
                if (useIpc) {
                    try {
                        // Ensure skills folder exists using PowerShell on Windows; cross-platform fallback is mkdir -p via shell
                        if (navigator.platform.startsWith('Win')) {
                            await wapi.shell.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `New-Item -ItemType Directory -Force -Path \"${destFolder}\" | Out-Null`], rootPath);
                        }
                        else {
                            await wapi.shell.run('mkdir', ['-p', destFolder], rootPath);
                        }
                    }
                    catch { }
                    const result = await wapi.shell.run('git', ['clone', finalUrl, destination], rootPath, undefined, 180000);
                    if (result && result.code === 0) {
                        setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'success' } : j)));
                    }
                    else {
                        const err = (result?.stderr || result?.stdout || 'Fallo al clonar').toString().slice(0, 500);
                        setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'error', error: err } : j)));
                    }
                }
                else {
                    const res = await fetch('/api/git/clone', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: finalUrl, destination }),
                    }).then((r) => r.json());
                    if (res.ok) {
                        setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'success' } : j)));
                    }
                    else {
                        setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'error', error: res.error } : j)));
                    }
                }
            }
            catch (e) {
                setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'error', error: e.message } : j)));
            }
        }
        setInstalling(false);
    };
    if (!rootPath) {
        return (_jsx("div", { className: "flex flex-1 items-center justify-center p-4 text-center text-[12px] text-muted-foreground", children: "Abre un proyecto primero para habilitar el instalador." }));
    }
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsxs("div", { className: "border-b border-border px-4 py-3", children: [_jsxs("h2", { className: "text-[12px] font-bold uppercase tracking-wider text-foreground flex items-center gap-2", children: [_jsx(CloudDownload, { size: 14, className: "text-accent" }), "Instalador de Skills / Apps"] }), _jsx("p", { className: "mt-1 text-[11px] text-muted-foreground leading-relaxed", children: "Pega enlaces de repositorios de GitHub (plantillas, skills o proyectos enteros). Puedes pegar varios separados por un salto de l\u00EDnea." })] }), _jsxs("div", { className: "p-4 flex flex-col flex-1 overflow-y-auto", children: [_jsxs("div", { className: "mb-4", children: [_jsx("textarea", { value: urls, onChange: (e) => setUrls(e.target.value), disabled: installing, placeholder: "https://github.com/usuario/repo1\nhttps://github.com/usuario/repo2", className: "w-full min-h-[100px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12px] font-mono text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50 resize-none transition-all" }), _jsxs("button", { onClick: startInstall, disabled: !urls.trim() || installing, className: "mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-50", children: [installing ? _jsx(Loader2, { size: 14, className: "animate-spin" }) : _jsx(Download, { size: 14 }), installing ? 'Instalando...' : 'Instalar Todo'] })] }), jobs.length > 0 && (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("h3", { className: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1", children: "Progreso de Instalaci\u00F3n" }), jobs.map((job, i) => (_jsxs("div", { className: "flex items-start gap-3 rounded-md bg-muted/40 p-2.5 border border-border/50", children: [_jsxs("div", { className: "mt-0.5 shrink-0", children: [job.status === 'pending' && _jsx("div", { className: "h-3 w-3 rounded-full border-2 border-muted-foreground" }), job.status === 'installing' && _jsx(Loader2, { size: 12, className: "animate-spin text-accent" }), job.status === 'success' && _jsx(Check, { size: 12, className: "text-emerald-500" }), job.status === 'error' && _jsx(X, { size: 12, className: "text-destructive" })] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-[11.5px] font-medium text-foreground truncate", title: job.url, children: job.url.split('/').slice(-2).join('/') }), job.error ? (_jsx("p", { className: "text-[10px] text-destructive mt-1 leading-tight", children: job.error })) : job.status === 'success' ? (_jsx("p", { className: "text-[10px] text-emerald-500 mt-1", children: "Instalado en /skills" })) : null] })] }, i)))] }))] })] }));
}
