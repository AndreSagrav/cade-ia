import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';
import { AI_MODELS } from '@shared/models';

interface ContextEstimateProps {
  inputLength: number;
}

export function ContextEstimate({ inputLength }: ContextEstimateProps) {
  const leanContext = useChatStore((s) => s.leanContext);
  const setLeanContext = useChatStore((s) => s.setLeanContext);
  const unlimitedAgent = useChatStore((s) => s.unlimitedAgent);
  const setUnlimitedAgent = useChatStore((s) => s.setUnlimitedAgent);
  const selectedModel = useChatStore((s) => s.selectedModel);

  const messages = useChatStore((s) => {
    const session = s.sessions.find((ss) => ss.id === s.activeSessionId);
    return session?.messages ?? [];
  });

  const currentModel = AI_MODELS[selectedModel];

  const contextEstimate = (() => {
    const limit = leanContext ? 4 : 8;
    const trunc = leanContext ? 3000 : 6000;
    const history = messages.filter((m: any) => m.role !== 'system').slice(-limit);
    const msgChars = history.reduce((acc: number, m: any) => acc + (m.content ? Math.min(m.content.length, trunc) : 0), 0);
    return msgChars + inputLength;
  })();

  return (
    <div className="flex flex-wrap items-center justify-between px-2.5 mb-1.5 text-[11px] text-zinc-400 select-none gap-y-1">
      <div className="flex items-center gap-1.5 opacity-80">
        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>~{contextEstimate.toLocaleString()} chars en prompt</span>
      </div>
      <div className="flex items-center gap-2">
        {currentModel?.contextWindow && (
          <span className="opacity-75 font-mono text-[10px]" title="Ventana máxima de contexto del modelo">
            Límite: {currentModel.contextWindow.toLocaleString()} tok
          </span>
        )}
        <button
          onClick={() => setLeanContext(!leanContext)}
          className={cn(
            'px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all duration-150 hover:scale-105 active:scale-95',
            leanContext 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.06)]' 
              : 'bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:bg-zinc-750'
          )}
          title={leanContext ? 'Ahorro activado: historial comprimido y slices cortos' : 'Modo estándar'}
        >
          {leanContext ? 'Ahorro: ON ⚡' : 'Ahorro: OFF'}
        </button>
        <button
          onClick={() => setUnlimitedAgent(!unlimitedAgent)}
          className={cn(
            'px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all duration-150 hover:scale-105 active:scale-95',
            unlimitedAgent
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:bg-zinc-750'
          )}
          title={unlimitedAgent ? 'Modo sin límites: el agente puede iterar largo' : 'Limitar iteraciones del agente para evitar loops'}
        >
          {unlimitedAgent ? 'Sin límites: ON' : 'Sin límites: OFF'}
        </button>
      </div>
    </div>
  );
}
