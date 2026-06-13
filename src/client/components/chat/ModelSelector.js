import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Search, ChevronDown, Network, Check } from 'lucide-react';
import { AI_MODELS } from '@shared/models';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';
export const PROVIDER_META = {
    claude: { label: 'Anthropic', color: '#fab387' },
    openai: { label: 'OpenAI', color: '#a6e3a1' },
    gemini: { label: 'Google', color: '#89b4fa' },
    deepseek: { label: 'DeepSeek', color: '#cba6f7' },
    openrouter: { label: 'OpenRouter', color: '#f38ba8' },
    nvidia: { label: 'NVIDIA', color: '#a6e3a1' },
};
const RANK_LABELS = {
    'S': 'S — Élite mundial',
    'A': 'A — Excelentes',
    'B': 'B — Muy buenos',
    'C': 'C — Competentes',
    'PAID': '💰 Premium (De Paga)',
};
const getModelRank = (m) => {
    if (m.tier === 'paid' || m.tier === 'premium')
        return 'PAID';
    const id = m.id.toLowerCase();
    if (id.includes('claude-opus') || id.includes('claude-sonnet') || id.includes('gpt-4.5') || id.includes('gemini-3.5') || id.includes('deepseek-v4-pro') || id.includes('qwen3-coder-480b'))
        return 'S';
    if (id.includes('deepseek-v4-flash') || id.includes('gemini-2.5-pro') || id.includes('gemini-2.5-flash') || id.includes('codestral') || id.includes('mistral-small') || id.includes('mistral-medium') || id.includes('gpt-4.5-pro') || id.includes('gpt-3.4'))
        return 'A';
    if (id.includes('qwen') || id.includes('glm') || id.includes('nemotron') || id.includes('minimax') || id.includes('deepseek-v3') || id.includes('deepseek-r1') || id.includes('gemma') || id.includes('gpt-oss') || id.includes('kimi') || id.includes('seed') || id.includes('step'))
        return 'B';
    return 'C';
};
function formatTokens(num) {
    if (num >= 1000000)
        return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000)
        return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}
export function ModelSelector({ compact }) {
    const { selectedModel, setSelectedModel, modelUsage } = useChatStore();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const currentModel = selectedModel === 'adaptive'
        ? { label: 'Adaptive 🎁 🔀', provider: 'system' }
        : AI_MODELS[selectedModel];
    const providerInfo = currentModel && currentModel.provider !== 'system'
        ? PROVIDER_META[currentModel.provider]
        : null;
    const today = new Date().toISOString().split('T')[0];
    const filteredModels = useMemo(() => {
        return Object.values(AI_MODELS).filter(m => m.label.toLowerCase().includes(search.toLowerCase()) ||
            m.provider.toLowerCase().includes(search.toLowerCase()));
    }, [search]);
    // Group by rank
    const grouped = useMemo(() => {
        const groups = {};
        for (const m of filteredModels) {
            const rank = getModelRank(m);
            if (!groups[rank])
                groups[rank] = [];
            groups[rank].push(m);
        }
        return groups;
    }, [filteredModels]);
    const allRanks = ['S', 'A', 'B', 'C', 'PAID'];
    return (_jsxs("div", { className: compact ? "relative shrink-0" : "relative shrink-0 px-4 py-2 border-b border-border/50", children: [compact ? (_jsxs("button", { onClick: () => setOpen(v => !v), className: "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] text-zinc-400 hover:bg-zinc-800 transition-colors", children: [_jsx("span", { className: "truncate max-w-[120px]", children: currentModel?.label ?? 'Seleccionar' }), _jsx(ChevronDown, { size: 14, className: cn('transition-transform', open && 'rotate-180') })] })) : (_jsxs("button", { onClick: () => setOpen(v => !v), className: "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition-all", style: { background: 'hsl(var(--muted) / 0.5)', color: 'hsl(var(--foreground))' }, children: [selectedModel === 'adaptive' ? (_jsx(Network, { size: 12, className: "text-accent shrink-0" })) : (_jsx("span", { className: "h-2 w-2 rounded-full shrink-0", style: { background: providerInfo?.color ?? 'hsl(var(--muted-foreground))' } })), _jsx("span", { className: "flex-1 text-left truncate", children: currentModel?.label ?? 'Seleccionar modelo' }), providerInfo && (_jsx("span", { className: "rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase shrink-0", style: { background: providerInfo.color + '22', color: providerInfo.color }, children: currentModel.provider })), _jsx(ChevronDown, { size: 12, className: cn('shrink-0 transition-transform text-muted-foreground', open && 'rotate-180') })] })), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40", onClick: () => setOpen(false) }), _jsxs("div", { className: cn("z-50 flex flex-col rounded-xl border shadow-xl overflow-hidden", compact ? "absolute bottom-full mb-2 left-0 w-[320px] max-h-[60vh]" : "absolute left-4 right-4 top-full mt-1 max-h-[450px]"), style: {
                            background: 'hsl(var(--card, var(--background)))',
                            borderColor: 'hsl(var(--border-strong, var(--border)))',
                            color: 'hsl(var(--foreground))'
                        }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2.5 border-b", style: { borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)' }, children: [_jsx(Search, { size: 14, className: "text-muted-foreground" }), _jsx("input", { type: "text", autoFocus: true, placeholder: "Buscar modelo...", value: search, onChange: e => setSearch(e.target.value), className: "flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none" })] }), _jsxs("div", { className: "overflow-y-auto flex-1 pb-2", children: [(!search || 'adaptive'.includes(search.toLowerCase())) && (_jsxs("button", { onClick: () => { setSelectedModel('adaptive'); setOpen(false); }, className: "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground group", style: { borderBottom: '1px solid hsl(var(--border) / 0.5)' }, children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsx("span", { className: "text-[14px] font-bold", children: "Modo Adaptive \uD83C\uDF81 \uD83D\uDD00" }) }), _jsx("p", { className: "text-[11px] text-muted-foreground mt-0.5", children: "Equilibrio inteligente entre calidad y costo" })] }), selectedModel === 'adaptive' && _jsx(Check, { size: 16, className: "text-primary" })] })), allRanks
                                        .filter((r) => grouped[r]?.length)
                                        .map((rankId) => {
                                        const models = grouped[rankId];
                                        return (_jsxs("div", { children: [_jsx("div", { className: "sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold tracking-widest backdrop-blur-md border-y", style: {
                                                        background: 'hsl(var(--card, var(--background)) / 0.95)',
                                                        color: rankId === 'S' ? '#eab308' : rankId === 'PAID' ? '#ec4899' : 'hsl(var(--muted-foreground))',
                                                        borderColor: 'hsl(var(--border-strong, var(--border)) / 0.5)'
                                                    }, children: RANK_LABELS[rankId] }), models.map((m) => {
                                                    const isSelected = m.id === selectedModel;
                                                    const usage = modelUsage[m.id];
                                                    const consumedTokens = (usage?.date === today) ? usage.tokens : 0;
                                                    const consumedRequests = (usage?.date === today) ? (usage.requests ?? 0) : 0;
                                                    const dl = m.dailyLimit;
                                                    const isPaid = !dl || dl.value === 0;
                                                    const isRequestBased = dl?.type === 'requests';
                                                    const consumed = isRequestBased ? consumedRequests : consumedTokens;
                                                    const limit = dl?.value ?? 0;
                                                    const percent = limit > 0 ? Math.min(100, Math.max(0, Math.round((consumed / limit) * 100))) : 0;
                                                    return (_jsxs("button", { onClick: () => { setSelectedModel(m.id); setOpen(false); }, className: cn("flex w-full items-center justify-between px-3 py-2 text-left transition-colors", isSelected ? "bg-accent/50 text-accent-foreground" : "hover:bg-muted/50"), children: [_jsxs("div", { className: "flex flex-col flex-1 min-w-0 pr-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[13px] font-medium truncate", children: m.label }), m.provider && m.provider !== 'system' && (_jsx("span", { className: "text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold shrink-0", style: {
                                                                                    background: (PROVIDER_META[m.provider]?.color || '#888') + '22',
                                                                                    color: PROVIDER_META[m.provider]?.color || '#888'
                                                                                }, children: PROVIDER_META[m.provider]?.label ?? m.provider }))] }), isPaid ? (_jsxs("span", { className: "text-[10px] mt-1", style: { color: '#ec4899' }, children: ["\uD83D\uDCB0 ", dl?.label ?? 'De paga', " \u2014 ", formatTokens(consumedTokens), " tokens usados"] })) : (_jsxs("div", { className: "flex flex-col gap-1 mt-1.5 w-full", children: [_jsxs("div", { className: "flex items-center justify-between text-[9px] text-muted-foreground font-medium tracking-wider", children: [_jsxs("span", { children: [isRequestBased ? `${consumed} req` : formatTokens(consumed), " usados"] }), _jsx("span", { className: "opacity-60", children: dl.label })] }), _jsx("div", { className: "h-[5px] w-full rounded-full overflow-hidden", style: { background: 'hsl(var(--border) / 0.4)' }, children: _jsx("div", { className: "h-full rounded-full transition-all duration-500", style: {
                                                                                        width: `${Math.max(percent, 1)}%`,
                                                                                        background: percent > 90
                                                                                            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                                                                            : percent > 70
                                                                                                ? 'linear-gradient(90deg, #f59e0b, #eab308)'
                                                                                                : 'linear-gradient(90deg, #22c55e, #16a34a)'
                                                                                    } }) })] }))] }), isSelected && _jsx(Check, { size: 16, className: "text-primary shrink-0" })] }, m.id));
                                                })] }, rankId));
                                    })] })] })] }))] }));
}
