import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { Search, FileText } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useProject } from '@/lib/use-project';
import { api } from '@/lib/api';
export function SearchPanel() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const rootPath = useEditorStore((s) => s.rootPath);
    const { handleOpenFile } = useProject();
    const handleSearch = useCallback(async () => {
        if (!query.trim() || !rootPath)
            return;
        setSearching(true);
        try {
            const res = await api.runCommand({
                cmd: `findstr /s /n /i "${query}" *`,
                cwd: rootPath,
            });
            const lines = res.stdout.split('\n').filter(Boolean).slice(0, 50);
            const parsed = lines.map((line) => {
                const match = line.match(/^(.+?):(\d+):(.*)$/);
                if (match)
                    return { file: match[1], line: parseInt(match[2]), text: match[3].trim() };
                return { file: '', line: 0, text: line };
            }).filter((r) => r.file);
            setResults(parsed);
        }
        catch {
            setResults([]);
        }
        setSearching(false);
    }, [query, rootPath]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter')
            handleSearch();
    };
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "border-b border-border p-2", children: _jsxs("div", { className: "flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10", children: [_jsx(Search, { size: 13, className: "text-muted-foreground" }), _jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: handleKeyDown, placeholder: "Buscar en archivos... (Enter)", className: "flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [searching && (_jsx("div", { className: "p-4 text-center text-xs text-muted-foreground", children: "Buscando..." })), !searching && results.length === 0 && (_jsx("div", { className: "flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground", children: query ? 'Sin resultados' : 'Escribe para buscar en los archivos del proyecto.' })), results.map((r, i) => (_jsxs("button", { onClick: () => handleOpenFile(r.file), className: "flex w-full items-start gap-2 border-b border-border/50 px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted/50", children: [_jsx(FileText, { size: 11, className: "mt-0.5 shrink-0 text-muted-foreground" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "truncate font-medium text-foreground", children: [r.file, ":", r.line] }), _jsx("div", { className: "truncate text-muted-foreground", children: r.text })] })] }, i)))] })] }));
}
