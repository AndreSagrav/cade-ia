import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X, Circle } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { getFileIcon } from '@/lib/utils';
export function Tabs() {
    const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();
    const tabs = [...openFiles.entries()];
    if (tabs.length === 0) {
        return (_jsx("div", { className: "flex h-10 items-center px-4 text-[11px] font-medium", style: {
                background: 'hsl(240 21% 12%)',
                borderBottom: '1px solid hsl(var(--border-strong))',
                color: '#585b70',
            }, children: "Sin archivos abiertos" }));
    }
    return (_jsx("div", { className: "flex h-10 items-center gap-0 overflow-x-auto scroll-fade", style: {
            background: 'hsl(240 21% 12%)',
            borderBottom: '1px solid hsl(var(--border-strong))',
        }, children: tabs.map(([path, file]) => {
            const name = path.split(/[/\\]/).pop() ?? path;
            const isActive = path === activeFilePath;
            return (_jsxs("button", { onClick: () => setActiveFile(path), className: "group flex h-full items-center gap-2 px-4 text-[11.5px] transition-all duration-200 relative", style: {
                    color: isActive ? '#cdd6f4' : '#585b70',
                    background: isActive ? 'hsl(var(--background))' : 'transparent',
                    borderRight: '1px solid hsl(var(--border))',
                }, children: [isActive && (_jsx("span", { className: "absolute top-0 left-2 right-2 h-[2px] rounded-b-full", style: {
                            background: 'linear-gradient(90deg, #89b4fa, #cba6f7)',
                            boxShadow: '0 2px 8px rgba(137, 180, 250, 0.3)',
                        } })), _jsx("span", { className: "text-[13px]", children: getFileIcon(name) }), _jsx("span", { className: "max-w-[100px] truncate font-medium", children: name }), file.modified && (_jsx(Circle, { size: 7, className: "fill-current", style: {
                            color: '#f9e2af',
                            filter: 'drop-shadow(0 0 4px rgba(249, 226, 175, 0.5))',
                        } })), _jsx("span", { onClick: (e) => { e.stopPropagation(); closeFile(path); }, className: "ml-0.5 flex h-5 w-5 items-center justify-center rounded-md opacity-0 transition-all duration-150 group-hover:opacity-100", style: { color: '#585b70' }, onMouseEnter: (e) => { e.currentTarget.style.background = 'hsl(237 16% 26%)'; e.currentTarget.style.color = '#cdd6f4'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#585b70'; }, children: _jsx(X, { size: 11 }) })] }, path));
        }) }));
}
