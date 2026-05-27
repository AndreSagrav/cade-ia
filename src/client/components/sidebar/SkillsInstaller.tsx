import { useState } from 'react';
import { Download, Check, X, Loader2, CloudDownload } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';


interface InstallJob {
  url: string;
  status: 'pending' | 'installing' | 'success' | 'error';
  error?: string;
}

export function SkillsInstaller() {
  const rootPath = useEditorStore((s) => s.rootPath);
  const [urls, setUrls] = useState('');
  const [jobs, setJobs] = useState<InstallJob[]>([]);
  const [installing, setInstalling] = useState(false);

  const startInstall = async () => {
    if (!rootPath) return;
    
    // Extraer URLs separadas por línea o coma
    const parsedUrls = urls
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    if (parsedUrls.length === 0) return;

    const newJobs = parsedUrls.map((url) => ({ url, status: 'pending' as const }));
    setJobs(newJobs);
    setUrls('');
    setInstalling(true);

    const destFolder = rootPath.replace(/\\/g, '/') + '/skills';

    for (let i = 0; i < newJobs.length; i++) {
      setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'installing' } : j)));
      
      const repoName = newJobs[i].url.split('/').pop()?.replace('.git', '') || `app-${Date.now()}`;
      const destination = `${destFolder}/${repoName}`;

      // Use original URL, rely on local git credentials
      let finalUrl = newJobs[i].url;

      try {
        const res = await fetch('/api/git/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: finalUrl, destination }),
        }).then((r) => r.json());

        if (res.ok) {
          setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'success' } : j)));
        } else {
          setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'error', error: res.error } : j)));
        }
      } catch (e: any) {
        setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'error', error: e.message } : j)));
      }
    }
    setInstalling(false);
  };

  if (!rootPath) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-[12px] text-muted-foreground">
        Abre un proyecto primero para habilitar el instalador.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <CloudDownload size={14} className="text-accent" />
          Instalador de Skills / Apps
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          Pega enlaces de repositorios de GitHub (plantillas, skills o proyectos enteros). Puedes pegar varios separados por un salto de línea.
        </p>
      </div>

      <div className="p-4 flex flex-col flex-1 overflow-y-auto">
        <div className="mb-4">
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            disabled={installing}
            placeholder="https://github.com/usuario/repo1&#10;https://github.com/usuario/repo2"
            className="w-full min-h-[100px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12px] font-mono text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground/50 resize-none transition-all"
          />
          <button
            onClick={startInstall}
            disabled={!urls.trim() || installing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {installing ? 'Instalando...' : 'Instalar Todo'}
          </button>
        </div>

        {jobs.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Progreso de Instalación
            </h3>
            {jobs.map((job, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md bg-muted/40 p-2.5 border border-border/50">
                <div className="mt-0.5 shrink-0">
                  {job.status === 'pending' && <div className="h-3 w-3 rounded-full border-2 border-muted-foreground" />}
                  {job.status === 'installing' && <Loader2 size={12} className="animate-spin text-accent" />}
                  {job.status === 'success' && <Check size={12} className="text-emerald-500" />}
                  {job.status === 'error' && <X size={12} className="text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-medium text-foreground truncate" title={job.url}>
                    {job.url.split('/').slice(-2).join('/')}
                  </p>
                  {job.error ? (
                    <p className="text-[10px] text-destructive mt-1 leading-tight">{job.error}</p>
                  ) : job.status === 'success' ? (
                    <p className="text-[10px] text-emerald-500 mt-1">Instalado en /skills</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
