import { useState } from 'react';
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface AgentChange {
  path: string;
  oldContent: string;
  newContent: string;
}

interface DiffViewerProps {
  changes: AgentChange[];
}

export function DiffViewer({ changes }: DiffViewerProps) {
  const [open, setOpen] = useState(false);

  if (changes.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-surface/50 shadow-sm overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 hover:bg-surface-hover/60 transition-colors select-none text-[12px] font-semibold text-foreground/90"
      >
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-emerald-400 opacity-80" />
          <span>Modificaciones de Archivo</span>
          <span className="rounded-full bg-muted/40 border border-border/50 text-[10px] px-1.5 py-0.5 text-muted-foreground font-mono">
            {changes.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border/30 px-3 py-2.5 space-y-3 bg-[#10101a]/40">
          {changes.map((chg, idx) => (
            <div key={idx} className="rounded-lg border border-border/40 bg-surface/40 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              <div className="text-[11.5px] font-mono font-bold text-foreground mb-2 flex items-center gap-1.5 truncate" title={chg.path}>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 text-[10px]">FILE</span>
                {chg.path}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="rounded-md border border-red-500/10 bg-red-950/10 p-2 overflow-auto max-h-48 scrollbar-thin">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-red-400 mb-1">Antes (-)</div>
                  <pre className="whitespace-pre text-red-200 text-[11px] leading-relaxed">{chg.oldContent?.slice(0, 1000) || '(vacío)'}</pre>
                </div>
                <div className="rounded-md border border-emerald-500/10 bg-emerald-950/10 p-2 overflow-auto max-h-48 scrollbar-thin">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-400 mb-1">Después (+)</div>
                  <pre className="whitespace-pre text-emerald-200 text-[11px] leading-relaxed">{chg.newContent?.slice(0, 1000) || '(vacío)'}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
