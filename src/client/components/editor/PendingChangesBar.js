import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Check, X, FileCode, Terminal, ArrowRight } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { acceptChange, rejectChange } from '@/lib/agent';
export function PendingChangesBar() {
    const { pendingChanges, openFiles, setActiveFile } = useEditorStore();
    const pending = pendingChanges.filter((c) => c.status === 'pending');
    if (pending.length === 0)
        return null;
    const handleAcceptAll = async () => {
        for (const change of pending) {
            await acceptChange(change);
        }
    };
    const handleRejectAll = () => {
        pending.forEach((c) => rejectChange(c));
    };
    const handleFocus = (file) => {
        if (file && openFiles.has(file))
            setActiveFile(file);
    };
    return (_jsxs("div", { className: "border-b", style: {
            background: 'hsl(48 96% 53% / 0.08)',
            borderColor: 'hsl(48 96% 53% / 0.3)',
        }, children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2", children: [_jsxs("span", { className: "text-xs font-semibold", style: { color: 'hsl(48 96% 53%)' }, children: ["\u26A1 ", pending.length, " cambio", pending.length > 1 ? 's' : '', " del agente"] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("button", { onClick: handleAcceptAll, className: "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white transition-colors", style: { background: 'hsl(142 71% 45%)' }, title: "Aceptar todos los cambios", children: [_jsx(Check, { size: 11 }), " Aceptar todo"] }), _jsxs("button", { onClick: handleRejectAll, className: "flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted", title: "Rechazar todos los cambios", children: [_jsx(X, { size: 11 }), " Rechazar todo"] })] })] }), _jsx("div", { className: "max-h-[180px] overflow-y-auto px-2 pb-2", children: pending.map((c) => (_jsxs("div", { className: "group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40", children: [_jsxs("button", { onClick: () => handleFocus(c.file), className: "flex flex-1 items-center gap-2 text-left text-[12px] text-muted-foreground hover:text-foreground", disabled: c.type === 'run', children: [c.type === 'run'
                                    ? _jsx(Terminal, { size: 12, style: { color: 'hsl(48 96% 53%)' } })
                                    : _jsx(FileCode, { size: 12, style: { color: 'hsl(48 96% 53%)' } }), _jsx("span", { className: "flex-1 truncate font-mono", children: c.type === 'run' ? `$ ${c.content.slice(0, 80)}` : c.file }), c.type !== 'run' && (_jsx(ArrowRight, { size: 11, className: "opacity-0 transition-opacity group-hover:opacity-50" }))] }), _jsx("button", { onClick: () => acceptChange(c), className: "rounded p-1 text-white transition-all hover:scale-110", style: { background: 'hsl(142 71% 45%)' }, title: "Aceptar este cambio", children: _jsx(Check, { size: 10 }) }), _jsx("button", { onClick: () => rejectChange(c), className: "rounded border border-border p-1 text-muted-foreground transition-all hover:scale-110 hover:bg-muted", title: "Rechazar este cambio", children: _jsx(X, { size: 10 }) })] }, c.id))) })] }));
}
