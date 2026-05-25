import { Check, X, FileCode, Terminal } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { executeChange } from '@/lib/agent';

export function PendingChangesBar() {
  const { pendingChanges, updateChangeStatus, clearPendingChanges } = useEditorStore();
  const pending = pendingChanges.filter((c) => c.status === 'pending');

  if (pending.length === 0) return null;

  const handleAcceptAll = async () => {
    for (const change of pending) {
      const result = await executeChange(change);
      updateChangeStatus(change.id, result.ok ? 'accepted' : 'rejected');
    }
  };

  const handleRejectAll = () => {
    pending.forEach((c) => updateChangeStatus(c.id, 'rejected'));
    clearPendingChanges();
  };

  return (
    <div className="border-b border-accent/20 bg-accent/5">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-accent">
          {pending.length} cambio{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-success/80"
          >
            <Check size={11} /> Aplicar todo
          </button>
          <button
            onClick={handleRejectAll}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <X size={11} /> Rechazar
          </button>
        </div>
      </div>
      {/* Show individual changes */}
      <div className="max-h-[120px] overflow-y-auto px-3 pb-2">
        {pending.map((c) => (
          <div key={c.id} className="flex items-center gap-2 py-0.5 text-[11px] text-muted-foreground">
            {c.type === 'run' ? <Terminal size={10} /> : <FileCode size={10} />}
            <span className="truncate">
              {c.type === 'run' ? `$ ${c.content.slice(0, 60)}` : c.file}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
