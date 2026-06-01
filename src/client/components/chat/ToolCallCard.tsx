import { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatArgs } from './helpers';
import type { ToolCall } from '@shared/types';

interface ToolCallCardProps {
  toolCalls: ToolCall[];
}

export function ToolCallCard({ toolCalls }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  if (toolCalls.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-surface/50 shadow-sm overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 hover:bg-surface-hover/60 transition-colors select-none text-[12px] font-semibold text-foreground/90"
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-accent opacity-80" />
          <span>Llamadas a Herramientas</span>
          <span className="rounded-full bg-muted/40 border border-border/50 text-[10px] px-1.5 py-0.5 text-muted-foreground font-mono">
            {toolCalls.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border/30 px-3 py-2.5 space-y-2 bg-[#10101a]/40">
          {toolCalls.map((tc) => (
            <div key={tc.id} className="rounded-lg border border-border/40 bg-surface/40 px-3 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-accent/10 border border-accent/25 text-accent">
                  {tc.name}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1.5',
                  tc.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 
                  tc.status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 
                  'bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', 
                    tc.status === 'done' ? 'bg-emerald-400' : 
                    tc.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
                  )} />
                  {tc.status === 'done' ? 'Completado' : tc.status === 'error' ? 'Error' : 'Ejecutando'}
                </span>
              </div>
              <div className="text-[11.5px] font-mono text-zinc-300 overflow-x-auto select-all max-w-full pb-1 whitespace-nowrap">
                {formatArgs(tc.args)}
              </div>
              {tc.result && (
                <div className="mt-2 rounded bg-black/40 border border-border/20 p-2 text-[11px] text-muted-foreground max-h-36 overflow-y-auto font-mono whitespace-pre-wrap">
                  {tc.result.slice(0, 300)}{tc.result.length > 300 ? '…' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
