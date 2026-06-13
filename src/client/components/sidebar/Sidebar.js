import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Files, Search, GitBranch, Sparkles, CloudDownload } from 'lucide-react';
import { FileTree } from './FileTree';
import { SearchPanel } from './SearchPanel';
import { GitPanel } from './GitPanel';
import { SkillsInstaller } from './SkillsInstaller';
import { cn } from '@/lib/utils';
const tabs = [
    { id: 'files', icon: Files, label: 'Archivos' },
    { id: 'search', icon: Search, label: 'Buscar' },
    { id: 'git', icon: GitBranch, label: 'Git' },
    { id: 'skills', icon: CloudDownload, label: 'Instalar Apps/Skills' },
];
export function Sidebar() {
    const [activeTab, setActiveTab] = useState('files');
    return (_jsxs("div", { className: "flex h-full overflow-hidden", children: [_jsxs("div", { className: "flex w-[52px] shrink-0 flex-col items-center gap-1.5 py-3", style: {
                    background: 'linear-gradient(180deg, hsl(267 30% 16%) 0%, hsl(240 21% 11%) 100%)',
                    borderRight: '1px solid hsl(var(--border-strong))',
                }, children: [_jsx("div", { className: "mb-3 flex h-8 w-8 items-center justify-center rounded-xl", style: {
                            background: 'linear-gradient(135deg, #89b4fa, #cba6f7, #f5c2e7)',
                            boxShadow: '0 4px 12px rgba(203, 166, 247, 0.3)',
                        }, children: _jsx(Sparkles, { size: 14, className: "text-white" }) }), _jsx("div", { className: "w-6 h-px mb-1", style: { background: 'hsl(var(--border-strong))' } }), tabs.map(({ id, icon: Icon, label }) => {
                        const isActive = activeTab === id;
                        return (_jsxs("button", { onClick: () => setActiveTab(id), title: label, className: cn('relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200'), style: isActive
                                ? {
                                    background: 'hsl(var(--accent) / 0.15)',
                                    color: '#89b4fa',
                                    boxShadow: '0 0 12px hsl(217 92% 76% / 0.15)',
                                }
                                : { color: 'hsl(var(--muted-foreground))' }, onMouseEnter: (e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'hsl(237 16% 26%)';
                                    e.currentTarget.style.color = '#cdd6f4';
                                }
                            }, onMouseLeave: (e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                                }
                            }, children: [isActive && (_jsx("span", { className: "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full", style: {
                                        background: 'linear-gradient(180deg, #89b4fa, #cba6f7)',
                                        boxShadow: '0 0 8px rgba(137, 180, 250, 0.4)',
                                    } })), _jsx(Icon, { size: 18, strokeWidth: isActive ? 2.2 : 1.5 })] }, id));
                    })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", style: { background: 'hsl(var(--background))' }, children: [activeTab === 'files' && _jsx(FileTree, {}), activeTab === 'search' && _jsx(SearchPanel, {}), activeTab === 'git' && _jsx(GitPanel, {}), activeTab === 'skills' && _jsx(SkillsInstaller, {})] })] }));
}
