import { useState } from 'react';
import { X, Key, Palette, Type } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'keys' | 'appearance' | 'editor';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('keys');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-[500px] w-[600px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Sidebar */}
        <div className="flex w-[160px] flex-col border-r border-border bg-surface/50 p-3">
          <h2 className="mb-4 text-sm font-bold text-foreground">Configuración</h2>
          <TabBtn icon={Key} label="API Keys" active={tab === 'keys'} onClick={() => setTab('keys')} />
          <TabBtn icon={Palette} label="Apariencia" active={tab === 'appearance'} onClick={() => setTab('appearance')} />
          <TabBtn icon={Type} label="Editor" active={tab === 'editor'} onClick={() => setTab('editor')} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'keys' && <APIKeysTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'editor' && <EditorTab />}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function TabBtn({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors',
        active ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function APIKeysTab() {
  const { apiKeys, setApiKey } = useSettingsStore();

  const providers = [
    { key: 'claude' as const, label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
    { key: 'openai' as const, label: 'OpenAI', placeholder: 'sk-...' },
    { key: 'gemini' as const, label: 'Google Gemini', placeholder: 'AIza...' },
    { key: 'deepseek' as const, label: 'DeepSeek', placeholder: 'sk-...' },
    { key: 'openrouter' as const, label: 'OpenRouter', placeholder: 'sk-or-...' },
    { key: 'nvidia' as const, label: 'NVIDIA NIM', placeholder: 'nvapi-...' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Las keys se guardan localmente en tu navegador (localStorage).
        </p>
      </div>
      {providers.map((p) => (
        <div key={p.key}>
          <label className="mb-1 block text-[11px] font-medium text-foreground">{p.label}</label>
          <input
            type="password"
            value={apiKeys[p.key]}
            onChange={(e) => setApiKey(p.key, e.target.value)}
            placeholder={p.placeholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 placeholder:text-muted-foreground"
          />
        </div>
      ))}
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useSettingsStore();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Apariencia</h3>
      <div>
        <label className="mb-2 block text-[11px] font-medium text-foreground">Tema</label>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'rounded-md border px-4 py-2 text-xs font-medium transition-all',
                theme === t
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted-foreground hover:border-accent/50',
              )}
            >
              {t === 'dark' ? 'Oscuro' : t === 'light' ? 'Claro' : 'Sistema'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorTab() {
  const { fontSize, setFontSize, wordWrap, toggleWordWrap, minimap, toggleMinimap } = useSettingsStore();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Editor</h3>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-foreground">
          Tamaño de fuente: {fontSize}px
        </label>
        <input
          type="range"
          min={10}
          max={24}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">Word wrap</span>
        <Toggle checked={wordWrap} onChange={toggleWordWrap} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">Minimap</span>
        <Toggle checked={minimap} onChange={toggleMinimap} />
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-muted',
      )}
    >
      <div
        className={cn(
          'h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
