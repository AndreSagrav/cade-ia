import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FolderOpen, Save, Play, Package, Settings, Sun, Moon, Search, Sparkles, } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { useEditorStore } from '@/store/editor-store';
import { useProject } from '@/lib/use-project';
export function Topbar({ onOpenSettings }) {
    const { theme, setTheme } = useSettingsStore();
    const rootPath = useEditorStore((s) => s.rootPath);
    const { handleOpenFolder, handleSaveFile, handleRunCommand } = useProject();
    const projectName = rootPath?.split(/[/\\]/).pop();
    return (_jsxs("header", { className: "relative flex h-[54px] min-h-[54px] shrink-0 items-center gap-3 px-5 z-20", style: {
            background: 'linear-gradient(180deg, hsl(240 21% 14%) 0%, hsl(240 21% 11%) 100%)',
            borderBottom: '1px solid hsl(var(--border-strong))',
            boxShadow: '0 4px 20px hsl(240 21% 5% / 0.4)',
        }, children: [_jsx("div", { className: "absolute bottom-0 left-0 right-0 h-[1px]", style: {
                    background: 'linear-gradient(90deg, transparent, #89b4fa60, #cba6f760, #f5c2e740, transparent)',
                } }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "relative flex h-9 w-9 items-center justify-center rounded-xl animate-gradient", style: {
                            background: 'linear-gradient(135deg, #89b4fa, #cba6f7, #f5c2e7, #89b4fa)',
                            backgroundSize: '200% 200%',
                            boxShadow: '0 4px 18px rgba(137, 180, 250, 0.35)',
                        }, children: [_jsx("span", { className: "text-[12px] font-black font-mono text-white select-none", children: "AI" }), _jsx("div", { className: "absolute inset-0 rounded-xl ring-1 ring-white/20" })] }), _jsxs("div", { className: "flex flex-col leading-none", children: [_jsx("span", { className: "text-[15px] font-extrabold tracking-tight", style: { color: '#cdd6f4' }, children: "CodeAI" }), _jsx("span", { className: "text-[9px] font-bold uppercase tracking-[0.2em]", style: {
                                    background: 'linear-gradient(90deg, #89b4fa, #cba6f7)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }, children: "Studio" })] })] }), _jsx("div", { className: "w-px h-6 mx-1 shrink-0", style: { background: 'hsl(var(--border-strong))' } }), _jsxs("button", { className: "flex flex-1 max-w-[340px] items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] transition-all duration-200", style: {
                    background: 'hsl(240 21% 18%)',
                    border: '1px solid hsl(var(--border-strong))',
                    color: '#a6adc8',
                }, children: [_jsx(Search, { size: 13, style: { color: '#89b4fa', opacity: 0.7 } }), _jsx("span", { className: "flex-1 text-left", children: "Buscar archivos, comandos..." }), _jsx("kbd", { className: "rounded-md px-1.5 py-0.5 text-[9px] font-mono font-semibold", style: { background: 'hsl(240 21% 23%)', color: '#a6adc8', border: '1px solid hsl(var(--border-strong))' }, children: "Ctrl+K" })] }), _jsx("div", { className: "w-px h-6 mx-1 shrink-0", style: { background: 'hsl(var(--border-strong))' } }), projectName && (_jsxs("button", { onClick: handleOpenFolder, className: "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all duration-200 group", style: {
                    background: 'hsl(240 21% 18%)',
                    border: '1px solid hsl(var(--border))',
                    color: '#a6adc8',
                }, children: [_jsx(FolderOpen, { size: 13, style: { color: '#f9e2af' } }), _jsx("span", { className: "max-w-[120px] truncate group-hover:text-[#cdd6f4] transition-colors", children: projectName })] })), !projectName && (_jsx(ToolButton, { icon: FolderOpen, label: "Abrir", primary: true, onClick: handleOpenFolder })), _jsx(ToolButton, { icon: Save, label: "Guardar", onClick: handleSaveFile }), _jsx(ToolButton, { icon: Play, label: "Run", onClick: () => handleRunCommand('npm start') }), _jsx(ToolButton, { icon: Package, label: "Install", onClick: () => handleRunCommand('npm install') }), _jsx("div", { className: "flex-1" }), _jsxs("div", { className: "flex items-center gap-1.5 rounded-full px-3 py-1", style: {
                    background: 'linear-gradient(135deg, hsl(217 92% 76% / 0.1), hsl(267 84% 81% / 0.1))',
                    border: '1px solid hsl(217 92% 76% / 0.2)',
                }, children: [_jsx(Sparkles, { size: 11, style: { color: '#89b4fa' } }), _jsx("span", { className: "text-[10px] font-bold", style: { color: '#89b4fa' }, children: "AI Ready" })] }), rootPath && (_jsx("span", { className: "h-2 w-2 rounded-full", style: {
                    background: '#a6e3a1',
                    boxShadow: '0 0 8px rgba(166, 227, 161, 0.6)',
                    animation: 'glow-pulse 2s ease-in-out infinite',
                } })), _jsx("div", { className: "w-px h-6 mx-0.5 shrink-0", style: { background: 'hsl(var(--border-strong))' } }), _jsx("button", { onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'), className: "btn-ghost h-8 w-8 rounded-xl", title: "Cambiar tema", children: theme === 'dark' ? _jsx(Sun, { size: 15 }) : _jsx(Moon, { size: 15 }) }), _jsx("button", { onClick: onOpenSettings, className: "btn-ghost h-8 w-8 rounded-xl", title: "Configuraci\u00F3n", children: _jsx(Settings, { size: 15 }) })] }));
}
function ToolButton({ icon: Icon, label, primary, onClick }) {
    return (_jsxs("button", { onClick: onClick, title: label, className: "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 active:scale-95", style: primary
            ? {
                background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
                color: '#11111b',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)',
            }
            : { color: '#a6adc8' }, onMouseEnter: (e) => {
            if (!primary) {
                e.currentTarget.style.background = 'hsl(237 16% 26%)';
                e.currentTarget.style.color = '#cdd6f4';
            }
        }, onMouseLeave: (e) => {
            if (!primary) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#a6adc8';
            }
        }, children: [_jsx(Icon, { size: 13 }), _jsx("span", { className: "hidden md:inline", children: label })] }));
}
