import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { getLanguageFromPath } from '@/lib/utils';
import { AI_MODELS } from '@shared/models';
import { GitBranch, Cpu } from 'lucide-react';
const PROVIDER_COLORS = {
    claude: '#fab387',
    openai: '#a6e3a1',
    gemini: '#89b4fa',
    deepseek: '#cba6f7',
    nvidia: '#a6e3a1',
    openrouter: '#f38ba8',
};
export function StatusBar() {
    const activeFilePath = useEditorStore((s) => s.activeFilePath);
    const selectedModel = useChatStore((s) => s.selectedModel);
    const model = AI_MODELS[selectedModel];
    const fileName = activeFilePath?.split(/[/\\]/).pop() ?? '';
    const language = activeFilePath ? getLanguageFromPath(activeFilePath) : '';
    const providerColor = model ? PROVIDER_COLORS[model.provider] ?? '#a6adc8' : '';
    return (_jsxs("footer", { className: "flex h-[28px] shrink-0 items-center px-4 text-[10.5px] font-medium", style: {
            background: 'linear-gradient(90deg, hsl(240 21% 10%), hsl(240 21% 12%))',
            borderTop: '1px solid hsl(var(--border-strong))',
            color: '#a6adc8',
        }, children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(GitBranch, { size: 11, style: { color: '#89b4fa' } }), _jsx("span", { style: { color: '#89b4fa' }, children: "main" })] }), fileName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: '#45475a' }, children: "\u00B7" }), _jsx("span", { className: "truncate max-w-[180px]", children: fileName }), _jsx("span", { style: { color: '#45475a' }, children: "\u00B7" }), _jsx("span", { className: "capitalize", style: { color: '#f9e2af' }, children: language })] }))] }), _jsx("div", { className: "flex-1" }), _jsxs("div", { className: "flex items-center gap-2.5", children: [model && (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Cpu, { size: 10, style: { color: providerColor } }), _jsx("span", { style: { color: providerColor }, children: model.label })] })), _jsx("span", { style: { color: '#45475a' }, children: "\u00B7" }), _jsx("span", { children: "UTF-8" }), _jsx("span", { style: { color: '#45475a' }, children: "\u00B7" }), _jsx("span", { children: "Ln 1, Col 1" })] })] }));
}
