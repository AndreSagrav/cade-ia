import { useState } from 'react';
import { X, Key, Palette, Type, Plus, Trash2, Github } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(17, 17, 27, 0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-modal relative flex h-[520px] w-[640px] max-w-[90vw] overflow-hidden rounded-2xl animate-scale-in">
        {/* Gradient top border */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, #89b4fa, #cba6f7, #f5c2e7)' }}
        />

        {/* Sidebar */}
        <div
          className="flex w-[170px] flex-col p-4 gap-1"
          style={{
            background: 'hsl(240 21% 10%)',
            borderRight: '1px solid hsl(var(--border-strong))',
          }}
        >
          <h2 className="mb-3 text-sm font-bold" style={{ color: '#cdd6f4' }}>Configuración</h2>
          <TabBtn icon={Key} label="API Keys" active={tab === 'keys'} onClick={() => setTab('keys')} />
          <TabBtn icon={Palette} label="Apariencia" active={tab === 'appearance'} onClick={() => setTab('appearance')} />
          <TabBtn icon={Type} label="Editor" active={tab === 'editor'} onClick={() => setTab('editor')} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scroll-fade p-6">
          {tab === 'keys' && <APIKeysTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'editor' && <EditorTab />}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150"
          style={{ color: '#585b70' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#313244'; e.currentTarget.style.color = '#cdd6f4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#585b70'; }}
        >
          <X size={14} />
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
        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-all duration-150',
      )}
      style={
        active
          ? { background: 'hsl(var(--accent) / 0.12)', color: '#89b4fa' }
          : { color: '#a6adc8' }
      }
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#313244'; e.currentTarget.style.color = '#cdd6f4'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a6adc8'; } }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function APIKeysTab() {
  const { apiKeys, setApiKey } = useSettingsStore();

  const providers = [
    { key: 'claude' as const, label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', color: '#fab387' },
    { key: 'openai' as const, label: 'OpenAI', placeholder: 'sk-...', color: '#a6e3a1' },
    { key: 'gemini' as const, label: 'Google Gemini', placeholder: 'AIza...', color: '#89b4fa' },
    { key: 'deepseek' as const, label: 'DeepSeek', placeholder: 'sk-...', color: '#cba6f7' },
    { key: 'openrouter' as const, label: 'OpenRouter', placeholder: 'sk-or-...', color: '#f38ba8' },
    { key: 'nvidia' as const, label: 'NVIDIA NIM', placeholder: 'nvapi-...', color: '#a6e3a1' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold" style={{ color: '#cdd6f4' }}>API Keys</h3>
        <p className="mt-1 text-[11px]" style={{ color: '#a6adc8' }}>
          Las keys se guardan en tu navegador (localStorage).
        </p>
      </div>
      {providers.map((p) => (
        <div key={p.key}>
          <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold" style={{ color: '#cdd6f4' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label}
          </label>
          <input
            type="password"
            value={apiKeys[p.key]}
            onChange={(e) => setApiKey(p.key, e.target.value)}
            placeholder={p.placeholder}
            className="w-full rounded-xl px-4 py-2.5 text-xs outline-none transition-all duration-150"
            style={{ background: '#313244', border: '1px solid #45475a', color: '#cdd6f4' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#89b4fa'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(137,180,250,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#45475a'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      ))}
      <div className="my-6 h-px w-full" style={{ background: '#45475a' }} />
      <GitHubAccountsSection />
    </div>
  );
}

function GitHubAccountsSection() {
  const { githubAccounts, activeGithubAccount, addGithubAccount, removeGithubAccount, setActiveGithubAccount } = useSettingsStore();
  const [newToken, setNewToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!newToken.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/github/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken.trim() }),
      }).then(r => r.json());
      
      if (res.ok && res.user) {
        addGithubAccount({
          username: res.user.login,
          avatarUrl: res.user.avatar_url,
          token: newToken.trim()
        });
        setNewToken('');
      } else {
        setError(res.error || 'Token inválido');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#cdd6f4' }}>
        <span className="h-2 w-2 rounded-full bg-white" />
        Cuentas de GitHub
      </h3>
      <p className="mt-1 mb-3 text-[11px]" style={{ color: '#a6adc8' }}>
        Conecta tus cuentas para crear y gestionar repositorios desde CodeAI.
      </p>

      {githubAccounts.length > 0 && (
        <div className="mb-4 space-y-2">
          {githubAccounts.map(acc => (
            <div 
              key={acc.username}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3 transition-colors cursor-pointer border",
                activeGithubAccount === acc.username ? "border-accent bg-accent/10" : "border-[#45475a] bg-[#313244]"
              )}
              onClick={() => setActiveGithubAccount(acc.username)}
            >
              <img src={acc.avatarUrl} alt="" className="h-8 w-8 rounded-full bg-[#1e1e2e]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{acc.username}</div>
                {activeGithubAccount === acc.username && (
                  <div className="text-[10px] font-medium text-accent">Cuenta Activa</div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeGithubAccount(acc.username); }}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/20 transition-colors"
                title="Eliminar cuenta"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: '#45475a', background: '#1e1e2e' }}>
        <div className="mb-3 text-xs font-medium text-white">Agregar Cuenta Nueva</div>
        
        <div className="mb-4">
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=CodeAI+Studio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#313244] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#45475a] transition-colors"
          >
            <Github size={14} />
            Generar Token Automáticamente
          </a>
          <p className="mt-2 text-[10px] text-muted-foreground">
            1. Haz clic arriba para ir a GitHub. <br/>
            2. Inicia sesión en la cuenta que quieres agregar.<br/>
            3. Haz clic en "Generate Token" (los permisos ya están seleccionados). <br/>
            4. Copia el token y pégalo abajo.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="password"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="ghp_..."
            className="flex-1 rounded-xl px-4 py-2.5 text-xs outline-none transition-all duration-150"
            style={{ background: '#313244', border: '1px solid #45475a', color: '#cdd6f4' }}
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newToken.trim()}
            className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-xs font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : <><Plus size={14} /> Agregar</>}
          </button>
        </div>
        {error && <div className="mt-2 text-[11px] text-red-400">{error}</div>}
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useSettingsStore();

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold" style={{ color: '#cdd6f4' }}>Apariencia</h3>
      <div>
        <label className="mb-2.5 block text-[11px] font-semibold" style={{ color: '#a6adc8' }}>Tema</label>
        <div className="flex gap-3">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className="rounded-xl px-5 py-2.5 text-[11px] font-semibold transition-all duration-200"
              style={
                theme === t
                  ? { background: 'hsl(var(--accent) / 0.12)', color: '#89b4fa', border: '1px solid hsl(var(--accent) / 0.3)' }
                  : { background: '#313244', color: '#a6adc8', border: '1px solid #45475a' }
              }
            >
              {t === 'dark' ? '🌙 Oscuro' : t === 'light' ? '☀️ Claro' : '💻 Sistema'}
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
    <div className="space-y-6">
      <h3 className="text-sm font-bold" style={{ color: '#cdd6f4' }}>Editor</h3>
      <div>
        <label className="mb-2 block text-[11px] font-semibold" style={{ color: '#a6adc8' }}>
          Tamaño de fuente: <span style={{ color: '#89b4fa' }}>{fontSize}px</span>
        </label>
        <input
          type="range"
          min={10}
          max={24}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: '#89b4fa' }}
        />
      </div>
      <div className="flex items-center justify-between py-2">
        <span className="text-[11px] font-semibold" style={{ color: '#cdd6f4' }}>Word wrap</span>
        <Toggle checked={wordWrap} onChange={toggleWordWrap} />
      </div>
      <div className="h-px" style={{ background: '#313244' }} />
      <div className="flex items-center justify-between py-2">
        <span className="text-[11px] font-semibold" style={{ color: '#cdd6f4' }}>Minimap</span>
        <Toggle checked={minimap} onChange={toggleMinimap} />
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="h-6 w-11 rounded-full transition-all duration-300"
      style={{
        background: checked
          ? 'linear-gradient(135deg, #89b4fa, #cba6f7)'
          : '#313244',
        boxShadow: checked ? '0 0 12px rgba(137, 180, 250, 0.3)' : 'none',
      }}
    >
      <div
        className={cn(
          'h-5 w-5 rounded-full shadow-sm transition-all duration-300',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
        style={{ background: '#cdd6f4' }}
      />
    </button>
  );
}
