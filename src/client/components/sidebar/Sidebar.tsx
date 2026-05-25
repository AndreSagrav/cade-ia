import { useState } from 'react';
import { FileTree } from './FileTree';
import { SearchPanel } from './SearchPanel';
import { GitPanel } from './GitPanel';
import { cn } from '@/lib/utils';

type SidebarTab = 'files' | 'search' | 'git';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');

  const tabs: { id: SidebarTab; label: string; icon: string }[] = [
    { id: 'files', label: 'Archivos', icon: '📁' },
    { id: 'search', label: 'Buscar', icon: '🔍' },
    { id: 'git', label: 'Git', icon: '◉' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border bg-surface/50 backdrop-blur-lg">
      {/* Tabs */}
      <div className="flex border-b border-border px-1.5 pt-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-t-md py-2 text-center text-[10px] font-semibold uppercase tracking-wider transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-accent bg-accent/5 text-accent'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === 'files' && <FileTree />}
        {activeTab === 'search' && <SearchPanel />}
        {activeTab === 'git' && <GitPanel />}
      </div>
    </div>
  );
}
