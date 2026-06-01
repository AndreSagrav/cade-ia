import { X, MessageSquare, Trash2 } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';

export function ChatHistory() {
  const {
    sessions,
    openSessionIds,
    historyOpen,
    setHistoryOpen,
    reopenSession,
    deleteSession,
  } = useChatStore();

  if (!historyOpen) return null;

  const closedSessions = sessions
    .filter((s) => !openSessionIds.includes(s.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div
      className="shrink-0 border-b max-h-[280px] overflow-y-auto select-none"
      style={{ background: 'hsl(var(--muted) / 0.2)', borderColor: 'hsl(var(--border))' }}
    >
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        <span>Conversaciones cerradas ({closedSessions.length})</span>
        <button onClick={() => setHistoryOpen(false)} className="rounded p-0.5 hover:bg-muted transition-colors">
          <X size={11} />
        </button>
      </div>
      {closedSessions.length === 0 ? (
        <div className="px-3 pb-3 text-[11px] text-muted-foreground/70">
          No hay conversaciones cerradas.
        </div>
      ) : (
        <div className="pb-2">
          {closedSessions.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors"
            >
              <MessageSquare size={11} className="shrink-0 text-muted-foreground" />
              <button
                onClick={() => reopenSession(s.id)}
                className="flex flex-1 items-center gap-2 text-left text-[12px] text-foreground"
                title="Reabrir"
              >
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(s.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                </span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Borrar "${s.name}" definitivamente?`)) deleteSession(s.id);
                }}
                className="opacity-0 transition-all duration-150 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Borrar definitivamente"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
