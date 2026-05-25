import { X, Circle } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { cn, getFileIcon } from '@/lib/utils';

export function Tabs() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();
  const tabs = [...openFiles.entries()];

  if (tabs.length === 0) {
    return (
      <div className="flex h-9 items-center border-b border-border bg-surface/30 px-3 text-[11px] text-muted-foreground">
        Sin archivos abiertos
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center gap-px overflow-x-auto border-b border-border bg-surface/30">
      {tabs.map(([path, file]) => {
        const name = path.split(/[/\\]/).pop() ?? path;
        const isActive = path === activeFilePath;

        return (
          <button
            key={path}
            onClick={() => setActiveFile(path)}
            className={cn(
              'group flex h-full items-center gap-1.5 border-b-2 px-3 text-[11.5px] transition-colors',
              isActive
                ? 'border-accent bg-accent/5 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="text-[12px]">{getFileIcon(name)}</span>
            <span className="max-w-[100px] truncate">{name}</span>
            {file.modified && (
              <Circle size={6} className="fill-warning text-warning" />
            )}
            <span
              onClick={(e) => { e.stopPropagation(); closeFile(path); }}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            >
              <X size={10} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
