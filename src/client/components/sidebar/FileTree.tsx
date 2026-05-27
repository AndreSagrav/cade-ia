import { useState } from 'react';
import { ChevronRight, RotateCcw, FolderOpen } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useProject } from '@/lib/use-project';
import { cn, getFileIcon, SKIP_DIRS } from '@/lib/utils';
import type { FileEntry } from '@shared/types';

export function FileTree() {
  const { fileTree, rootPath, activeFilePath, contextFiles, toggleContextFile } = useEditorStore();
  const { handleOpenFile, handleRefreshTree, handleOpenFolder } = useProject();

  if (!rootPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            background: 'hsl(var(--accent) / 0.08)',
            borderColor: 'hsl(var(--border))',
          }}
        >
          <FolderOpen size={24} style={{ color: 'hsl(var(--accent))' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Sin proyecto</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Abre una carpeta para empezar
          </p>
        </div>
        <button
          onClick={handleOpenFolder}
          className="btn-accent rounded-lg px-5 py-2 text-[11px] font-semibold"
        >
          Abrir proyecto
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground truncate">
          {rootPath.split(/[/\\]/).pop()}
        </span>
        <button
          onClick={handleRefreshTree}
          className="btn-ghost rounded-md p-1 transition-all duration-300 hover:rotate-180"
          title="Actualizar árbol"
        >
          <RotateCcw size={11} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto scroll-fade py-1">
        {fileTree.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            activeFilePath={activeFilePath}
            contextFiles={contextFiles}
            onToggleContext={toggleContextFile}
            onOpenFile={handleOpenFile}
          />
        ))}
      </div>

      {/* Footer */}
      {contextFiles.size > 0 && (
        <div
          className="shrink-0 border-t px-3 py-2 text-[11px] text-muted-foreground"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <span className="text-accent font-semibold">{contextFiles.size}</span> archivo(s) en contexto
        </div>
      )}
    </div>
  );
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  activeFilePath: string | null;
  contextFiles: Set<string>;
  onToggleContext: (path: string) => void;
  onOpenFile: (path: string) => void;
}

function TreeNode({ entry, depth, activeFilePath, contextFiles, onToggleContext, onOpenFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isActive = entry.path === activeFilePath;
  const isContext = contextFiles.has(entry.path);

  if (entry.kind === 'directory') {
    if (SKIP_DIRS.has(entry.name)) return null;
    return (
      <>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1.5 py-[5px] text-left text-[12px] transition-colors duration-150 text-muted-foreground hover:text-foreground"
          style={{
            paddingLeft: `${10 + depth * 14}px`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--surface-hover))')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronRight
            size={10}
            className={cn('shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
          />
          <span className="shrink-0 text-[13px]">{expanded ? '📂' : '📁'}</span>
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
            onOpenFile={onOpenFile}
          />
        ))}
      </>
    );
  }

  return (
    <button
      onClick={() => onOpenFile(entry.path)}
      className={cn(
        'group relative flex w-full items-center gap-1.5 py-[5px] text-left text-[12px] transition-all duration-150',
        isActive ? 'bg-accent/8' : 'hover:bg-[hsl(var(--surface-hover))]',
        isContext && !isActive && 'bg-success/5',
      )}
      style={{
        paddingLeft: `${20 + depth * 14}px`,
        color: isActive ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))',
      }}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r-full"
          style={{ background: 'hsl(var(--accent))' }}
        />
      )}
      <span className="shrink-0 text-[13px]">{getFileIcon(entry.name)}</span>
      <span className="flex-1 truncate">{entry.name}</span>
      <span
        onClick={(e) => { e.stopPropagation(); onToggleContext(entry.path); }}
        className={cn(
          'mr-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] opacity-0 transition-all duration-150 group-hover:opacity-100',
          isContext ? 'border-success bg-success text-white opacity-100' : 'border-border',
        )}
      >
        {isContext ? '✓' : ''}
      </span>
    </button>
  );
}
