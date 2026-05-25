import { Check, X } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';

export function PendingChangesBar() {
  const { pendingChanges, updateChangeStatus, clearPendingChanges } = useEditorStore();
  const pending = pendingChanges.filter((c) => c.status === 'pending');

  if (pending.length === 0) return null;

  return (
    <div className="flex items-center justify-between border-b border-accent/20 bg-accent/5 px-3 py-1.5">
      <span className="text-xs font-medium text-accent">
        {pending.length} cambio{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            pending.forEach((c) => updateChangeStatus(c.id, 'accepted'));
          }}
          className="flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-success/80"
        >
          <Check size={11} /> Aceptar todo
        </button>
        <button
          onClick={() => {
            pending.forEach((c) => updateChangeStatus(c.id, 'rejected'));
            clearPendingChanges();
          }}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <X size={11} /> Rechazar
        </button>
      </div>
    </div>
  );
}
