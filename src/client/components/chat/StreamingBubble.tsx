import { Sparkles, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { MarkdownContent } from './MessageContent';
import { AvatarAI } from './AvatarAI';

export function StreamingBubble() {
  const streamContent = useChatStore((s) => s.streamContent);
  const agentStatus = useChatStore((s) => s.agentStatus);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const messages = useChatStore((s) => {
    const session = s.sessions.find((ss) => ss.id === s.activeSessionId);
    return session?.messages ?? [];
  });

  const currentModel = AI_MODELS[selectedModel];

  return (
    <div className="flex gap-3">
      <AvatarAI />
      <div className="flex-1 pt-0.5">
        <div className="text-[11px] font-semibold mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {currentModel?.label ?? 'IA'}
        </div>
        {streamContent ? (
          <MarkdownContent
            content={streamContent}
            className="text-sm leading-relaxed prose prose-invert max-w-none text-foreground prose-p:leading-relaxed prose-pre:bg-surface-hover prose-pre:border prose-pre:border-border"
          />
        ) : (
          <div className="flex items-center gap-1.5 pt-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{
                  background: 'hsl(var(--accent))',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Premium Agent Status Indicator */}
        {agentStatus && (
          <div className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] border select-none transition-all duration-200 animate-fade-in font-sans",
            agentStatus.type === 'rate_limit' 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
              : agentStatus.type === 'tool_call' 
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80'
          )}>
            {agentStatus.type === 'rate_limit' ? (
              <>
                <Sparkles className="h-3 w-3 animate-spin text-amber-400" />
                <span>Ajustando velocidad de peticiones... reintentando en {((agentStatus.delay || 0) / 1000).toFixed(1)}s</span>
              </>
            ) : agentStatus.type === 'tool_call' ? (
              <>
                <Terminal className="h-3 w-3 animate-pulse text-sky-400" />
                <span>Ejecutando herramienta: <span className="font-semibold font-mono">{agentStatus.message}</span></span>
              </>
            ) : (
              <>
                <span className="flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span>Pensando paso {messages.length + 1}...</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
