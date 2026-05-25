import { useState } from 'react';
import { ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { cn, getFileIcon, SKIP_DIRS } from '@/lib/utils';
import type { FileEntry } from '@shared/types';

export function FileTree() {
  const { fileTree, rootPath, activeFilePath, contextFiles, toggleContextFile } = useEditorStore();

  if (!rootPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-4xl">📁</div>
        <p className="text-sm font-medium text-foreground">Sin proyecto abierto</p>
        <p className="text-xs text-muted-foreground">
          Haz clic en <span className="text-accent">Abrir carpeta</span> para comenzar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {rootPath.split(/[/\\]/).pop()}
        </span>
        <div className="flex gap-1">
          <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Plus size={12} />
          </button>
          <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            activeFilePath={activeFilePath}
            contextFiles={contextFiles}
            onToggleContext={toggleContextFile}
          />
        ))}
      </div>

      {/* Context info */}
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Contexto: <span className="text-success">{contextFiles.size}</span> archivo(s)
      </div>
    </div>
  );
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  activeFilePath: string | null;
  contextFiles: Set<string>;
  onToggleContext: (path: string) => void;
}

function TreeNode({ entry, depth, activeFilePath, contextFiles, onToggleContext }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isActive = entry.path === activeFilePath;
  const isContext = contextFiles.has(entry.path);

  if (entry.kind === 'directory') {
    if (SKIP_DIRS.has(entry.name)) return null;

    return (
      <>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex w-full items-center gap-1.5 px-2 py-[5px] text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <ChevronRight
            size={10}
            className={cn('shrink-0 transition-transform', expanded && 'rotate-90')}
          />
          <span className="shrink-0">{expanded ? '📂' : '📁'}</span>
          <span className="truncate font-medium">{entry.name}</span>
        </button>
        {expanded && entry.children?.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            contextFiles={contextFiles}
            onToggleContext={onToggleContext}
          />
        ))}
      </>
    );
  }

  return (
    <button
      className={cn(
        'group flex w-full items-center gap-1.5 px-2 py-[5px] text-left text-[12.5px] transition-colors',
        isActive
          ? 'bg-accent/10 text-accent before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-[2.5px] before:rounded-r before:bg-accent'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        isContext && 'bg-success/5',
      )}
      style={{ paddingLeft: `${24 + depth * 16}px` }}
    >
      <span className="shrink-0 text-[13px]">{getFileIcon(entry.name)}</span>
      <span className="flex-1 truncate">{entry.name}</span>
      <span
        onClick={(e) => { e.stopPropagation(); onToggleContext(entry.path); }}
        className={cn(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] opacity-0 transition-all group-hover:opacity-100',
          isContext
            ? 'border-success bg-success text-white shadow-sm shadow-success/30'
            : 'border-border hover:border-success',
        )}
      >
        {isContext ? '✓' : ''}
      </span>
    </button>
  );
}
