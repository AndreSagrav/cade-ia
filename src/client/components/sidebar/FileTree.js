import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronRight, RotateCcw, FolderOpen } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useProject } from '@/lib/use-project';
import { cn, getFileIcon, SKIP_DIRS } from '@/lib/utils';
export function FileTree() {
    const { fileTree, rootPath, activeFilePath, contextFiles, toggleContextFile } = useEditorStore();
    const { handleOpenFile, handleRefreshTree, handleOpenFolder } = useProject();
    if (!rootPath) {
        return (_jsxs("div", { className: "flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center animate-fade-in", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl border", style: {
                        background: 'hsl(var(--accent) / 0.08)',
                        borderColor: 'hsl(var(--border))',
                    }, children: _jsx(FolderOpen, { size: 24, style: { color: 'hsl(var(--accent))' } }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Sin proyecto" }), _jsx("p", { className: "mt-1 text-[11px] text-muted-foreground", children: "Abre una carpeta para empezar" })] }), _jsx("button", { onClick: handleOpenFolder, className: "btn-accent rounded-lg px-5 py-2 text-[11px] font-semibold", children: "Abrir proyecto" })] }));
    }
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", style: { background: 'hsl(var(--background))' }, children: [_jsxs("div", { className: "flex shrink-0 items-center justify-between px-3 py-2 border-b", style: { borderColor: 'hsl(var(--border))' }, children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground truncate", children: rootPath.split(/[/\\]/).pop() }), _jsx("button", { onClick: handleRefreshTree, className: "btn-ghost rounded-md p-1 transition-all duration-300 hover:rotate-180", title: "Actualizar \u00E1rbol", children: _jsx(RotateCcw, { size: 11 }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto scroll-fade py-1", children: fileTree.map((entry) => (_jsx(TreeNode, { entry: entry, depth: 0, activeFilePath: activeFilePath, contextFiles: contextFiles, onToggleContext: toggleContextFile, onOpenFile: handleOpenFile }, entry.path))) }), contextFiles.size > 0 && (_jsxs("div", { className: "shrink-0 border-t px-3 py-2 text-[11px] text-muted-foreground", style: { borderColor: 'hsl(var(--border))' }, children: [_jsx("span", { className: "text-accent font-semibold", children: contextFiles.size }), " archivo(s) en contexto"] }))] }));
}
function TreeNode({ entry, depth, activeFilePath, contextFiles, onToggleContext, onOpenFile }) {
    const [expanded, setExpanded] = useState(false);
    const isActive = entry.path === activeFilePath;
    const isContext = contextFiles.has(entry.path);
    if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name))
            return null;
        return (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setExpanded(!expanded), className: "flex w-full items-center gap-1.5 py-[5px] text-left text-[12px] transition-colors duration-150 text-muted-foreground hover:text-foreground", style: {
                        paddingLeft: `${10 + depth * 14}px`,
                    }, onMouseEnter: (e) => (e.currentTarget.style.background = 'hsl(var(--surface-hover))'), onMouseLeave: (e) => (e.currentTarget.style.background = 'transparent'), children: [_jsx(ChevronRight, { size: 10, className: cn('shrink-0 transition-transform duration-150', expanded && 'rotate-90') }), _jsx("span", { className: "shrink-0 text-[13px]", children: expanded ? '📂' : '📁' }), _jsx("span", { className: "truncate font-medium", children: entry.name })] }), expanded && entry.children?.map((child) => (_jsx(TreeNode, { entry: child, depth: depth + 1, activeFilePath: activeFilePath, contextFiles: contextFiles, onToggleContext: onToggleContext, onOpenFile: onOpenFile }, child.path)))] }));
    }
    return (_jsxs("button", { onClick: () => onOpenFile(entry.path), className: cn('group relative flex w-full items-center gap-1.5 py-[5px] text-left text-[12px] transition-all duration-150', isActive ? 'bg-accent/8' : 'hover:bg-[hsl(var(--surface-hover))]', isContext && !isActive && 'bg-success/5'), style: {
            paddingLeft: `${20 + depth * 14}px`,
            color: isActive ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))',
        }, children: [isActive && (_jsx("span", { className: "absolute left-0 top-1 bottom-1 w-[2px] rounded-r-full", style: { background: 'hsl(var(--accent))' } })), _jsx("span", { className: "shrink-0 text-[13px]", children: getFileIcon(entry.name) }), _jsx("span", { className: "flex-1 truncate", children: entry.name }), _jsx("span", { onClick: (e) => { e.stopPropagation(); onToggleContext(entry.path); }, className: cn('mr-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] opacity-0 transition-all duration-150 group-hover:opacity-100', isContext ? 'border-success bg-success text-white opacity-100' : 'border-border'), children: isContext ? '✓' : '' })] }));
}
