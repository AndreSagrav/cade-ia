import { X, File, Folder, Scissors } from 'lucide-react';

interface MentionChipProps {
  type: 'file' | 'folder' | 'selection';
  label: string;
  onRemove: () => void;
}

export function MentionChip({ type, label, onRemove }: MentionChipProps) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border select-none transition-all duration-150 animate-fade-in"
      style={{
        background: type === 'selection' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(137, 180, 250, 0.08)',
        borderColor: type === 'selection' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(137, 180, 250, 0.25)',
        color: type === 'selection' ? '#f8c870' : '#89b4fa',
      }}
    >
      <span className="shrink-0 opacity-80">
        {type === 'file' ? (
          <File size={11} />
        ) : type === 'folder' ? (
          <Folder size={11} />
        ) : (
          <Scissors size={11} />
        )}
      </span>
      <span className="truncate max-w-[150px] font-sans">{label}</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="rounded-full p-0.5 hover:bg-white/10 text-current transition-colors ml-0.5"
        title="Quitar"
      >
        <X size={10} />
      </button>
    </div>
  );
}
