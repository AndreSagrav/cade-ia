import { Bot, X, Plus, History, Zap } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';

export function ChatTabs() {
  const {
    sessions,
    openSessionIds,
    activeSessionId,
    historyOpen,
    agentMode,
    createSession,
    closeSession,
    setActiveSession,
    setHistoryOpen,
    setAgentMode,
  } = useChatStore();

  const openSessions = openSessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div
      className="flex shrink-0 items-stretch select-none"
      style={{ borderBottom: '1px solid hsl(var(--border-strong))', background: 'hsl(240 21% 12%)' }}
    >
      <div className="flex flex-1 items-stretch gap-px overflow-x-auto scrollbar-none">
        {openSessions.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
            <Bot size={13} style={{ color: 'hsl(var(--accent))' }} />
            <span className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Chat IA</span>
          </div>
        ) : (
          openSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSession(s.id)}
              className={cn(
                'group flex items-center gap-2 border-r px-3 py-2 text-[12px] transition-colors',
                s.id === activeSessionId
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              style={{
                borderColor: 'hsl(var(--border))',
                background: s.id === activeSessionId
                  ? 'hsl(var(--background))'
                  : 'hsl(var(--muted) / 0.3)',
                borderBottom: s.id === activeSessionId
                  ? '2px solid hsl(var(--accent))'
                  : '2px solid transparent',
              }}
            >
              <span className="max-w-[110px] truncate">{s.name}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                className="-mr-1 flex h-4 w-4 items-center justify-center rounded opacity-50 hover:bg-muted hover:opacity-100 transition-all duration-150"
                title="Cerrar"
              >
                <X size={10} />
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex items-center gap-0.5 px-1.5">
        <button
          onClick={() => createSession()}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Nueva conversación"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            historyOpen
              ? 'bg-accent/15 text-accent'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          title="Historial"
        >
          <History size={13} />
        </button>
        <button
          onClick={() => setAgentMode(!agentMode)}
          className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-150',
            agentMode ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
          )}
          style={{
            background: agentMode ? 'hsl(var(--warning) / 0.12)' : 'hsl(var(--muted) / 0.5)',
            border: agentMode ? '1px solid hsl(var(--warning) / 0.3)' : '1px solid transparent',
          }}
          title="Modo agente"
        >
          <Zap size={9} /> Agente
        </button>
      </div>
    </div>
  );
}
