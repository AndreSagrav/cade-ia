import { useState, useEffect } from 'react';
import { X, Key, Palette, Type, Plus, Trash2, Github } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { cn } from '@/lib/utils';
import { BASE_URL } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'keys' | 'appearance' | 'editor';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('keys');
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    fetch(`${BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.version) setVersion(data.version);
      })
      .catch(() => {});
  }, [open]);

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
          
          {version && (
            <div className="mt-auto pt-4 text-[10px] text-[#585b70] text-center font-bold tracking-wide">
              v{version}
            </div>
          )}
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  
  // Real-time Cloud states
  const [cloudKeys, setCloudKeys] = useState<Record<string, string> | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  // Fetch cloud backup state on mount
  useEffect(() => {
    let active = true;
    async function fetchCloudData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && active) {
          setUserEmail(user.email || '');
          const keys = user.user_metadata?.codeai_keys;
          if (keys && typeof keys === 'object') {
            setCloudKeys(keys);
          } else {
            setCloudKeys({});
          }
        }
      } catch (e) {
        console.error('[CodeAI] Error reading live cloud status:', e);
      } finally {
        if (active) setCloudLoading(false);
      }
    }
    fetchCloudData();
    return () => { active = false; };
  }, []);

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      const keysToSave = useSettingsStore.getState().apiKeys;
      
      // Step 1: Save to Supabase Auth metadata
      const { error } = await supabase.auth.updateUser({ 
        data: { codeai_keys: keysToSave } 
      });
      if (error) {
        throw new Error(error.message);
      }
      
      // Step 2: Verify by reading back fresh from the server
      const { data: { user } } = await supabase.auth.getUser();
      const savedKeys = user?.user_metadata?.codeai_keys;
      if (!savedKeys) {
        throw new Error('Las keys no se pudieron verificar en los servidores de Supabase. Por favor intenta de nuevo.');
      }
      
      // Update our real-time visual grid
      setCloudKeys(savedKeys);
      
      const savedCount = Object.values(savedKeys).filter((v: any) => v && typeof v === 'string' && v.trim()).length;
      console.log(`[CodeAI] ✅ ${savedCount} API keys guardadas y verificadas en Supabase`);
      
      setSaveStatus('success');
      // Show success message for a long duration so the user gets true confirmation
      setTimeout(() => setSaveStatus('idle'), 10000);
    } catch (e: any) {
      console.error('Error al guardar en Supabase:', e);
      setSaveError(e.message || 'Error desconocido');
      setSaveStatus('error');
    }
    setIsSaving(false);
  };

  const handleLoadFromCloud = async () => {
    try {
      setCloudLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const keys = user?.user_metadata?.codeai_keys;
      if (keys && typeof keys === 'object') {
        useSettingsStore.getState().hydrateFromCloud(keys);
        setCloudKeys(keys);
        alert('🔄 ¡API Keys cargadas desde la nube con éxito!');
      } else {
        alert('❌ No se encontraron API keys respaldadas en tu cuenta de Supabase.');
      }
    } catch (e: any) {
      alert('Error al cargar desde la nube: ' + (e.message || e));
    } finally {
      setCloudLoading(false);
    }
  };

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
      {/* ☁️ SUPABASE REAL-TIME CLOUD STATUS DASHBOARD */}
      <div 
        className="rounded-2xl p-4 border animate-scale-in" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(30, 32, 48, 0.75) 0%, rgba(17, 18, 27, 0.9) 100%)', 
          borderColor: 'rgba(137, 180, 250, 0.25)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
              style={{
                background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
                boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.47-.47-1.11-.73-1.8-.73H13.5a4 4 0 0 0-4 4v.27c0 .18-.08.35-.22.45A3.5 3.5 0 0 0 11 21h6.5"/>
              </svg>
            </div>
            <div>
              <h4 className="text-[12px] font-extrabold text-white tracking-wide">PANEL DE RESPALDO EN LA NUBE</h4>
              <p className="text-[10px] text-[#a6adc8] font-medium">
                {userEmail ? `Usuario: ${userEmail}` : 'Cargando información del servidor...'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleLoadFromCloud}
              disabled={cloudLoading || isSaving}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all duration-200 border hover:bg-[#313244] disabled:opacity-50"
              style={{
                borderColor: '#45475a',
                color: '#cdd6f4',
                background: '#1e1e2e'
              }}
              title="Descargar llaves guardadas en la nube a este dispositivo"
            >
              Descargar ☁️
            </button>
            <button
              onClick={handleSaveToCloud}
              disabled={isSaving || cloudLoading}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[10px] font-extrabold transition-all duration-200 disabled:opacity-50"
              style={{
                background: saveStatus === 'success' 
                  ? 'linear-gradient(135deg, #a6e3a1, #94e2d5)' 
                  : saveStatus === 'error'
                  ? 'linear-gradient(135deg, #f38ba8, #fab387)'
                  : 'linear-gradient(135deg, #89b4fa, #cba6f7)',
                color: '#11111b',
                boxShadow: saveStatus === 'success' 
                  ? '0 0 20px rgba(166,227,161,0.4)' 
                  : saveStatus === 'error' 
                  ? '0 0 20px rgba(243,139,168,0.4)' 
                  : '0 0 12px rgba(137,180,250,0.25)'
              }}
            >
              {isSaving ? 'Guardando...' : saveStatus === 'success' ? '✓ ¡Respaldado!' : saveStatus === 'error' ? '✗ Error' : 'Subir a la Nube ☁️'}
            </button>
          </div>
        </div>

        {/* Real-time server keys list */}
        {cloudLoading ? (
          <div className="py-5 text-center text-[10px] text-[#a6adc8] flex flex-col items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#89b4fa] border-t-transparent" />
            <span>Consultando estado de sincronización en tiempo real con Supabase...</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold text-[#cdd6f4] border-b border-[#313244] pb-2 mb-2 flex items-center justify-between">
              <span>Estado en los servidores de Supabase:</span>
              <span className="text-[9px] text-[#89b4fa] px-1.5 py-0.5 rounded bg-[#89b4fa]/10 font-bold tracking-wider">VISTA EN VIVO</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => {
                const isSavedInCloud = cloudKeys && cloudKeys[p.key] && cloudKeys[p.key].trim().length > 0;
                return (
                  <div 
                    key={p.key} 
                    className="flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-150"
                    style={{
                      background: isSavedInCloud ? 'rgba(166, 227, 161, 0.03)' : 'rgba(49, 50, 68, 0.2)',
                      borderColor: isSavedInCloud ? 'rgba(166, 227, 161, 0.15)' : '#313244'
                    }}
                  >
                    <span className="text-[10px] font-semibold text-[#cdd6f4] flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    {isSavedInCloud ? (
                      <span 
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(166, 227, 161, 0.15)', color: '#a6e3a1' }}
                      >
                        ✓ EN NUBE
                      </span>
                    ) : (
                      <span 
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(243, 139, 168, 0.05)', color: '#585b70' }}
                      >
                        ○ NO RESPALDADA
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Guaranty warning card */}
            <div 
              className="mt-3 rounded-xl p-3 border text-[10px] text-[#a6adc8] leading-relaxed"
              style={{
                background: 'rgba(137, 180, 250, 0.04)',
                borderColor: 'rgba(137, 180, 250, 0.12)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px]">🛡️</span>
                <span className="font-extrabold text-white uppercase tracking-wider text-[9px]">Garantía de Sincronización Permanente</span>
              </div>
              Las llaves marcadas como <strong className="text-[#a6e3a1]">✓ EN NUBE</strong> están grabadas en los servidores de Supabase vinculados a tu cuenta. <strong className="text-white">Nunca más</strong> tendrás que volver a escribirlas cuando abras CodeAI en un nuevo navegador, computadora o celular: se cargarán automáticamente al iniciar tu sesión.
            </div>
          </div>
        )}
      </div>

      {saveStatus === 'error' && saveError && (
        <div className="rounded-xl px-4 py-3 text-[11px] font-semibold animate-scale-in" style={{ background: 'rgba(243,139,168,0.1)', color: '#f38ba8', border: '1px solid rgba(243,139,168,0.2)' }}>
          ⚠️ Error al guardar en Supabase: {saveError}
        </div>
      )}
      
      {saveStatus === 'success' && (
        <div 
          className="rounded-xl px-4 py-3 text-[11px] font-medium animate-scale-in border" 
          style={{ 
            background: 'rgba(166,227,161,0.08)', 
            color: '#a6e3a1', 
            borderColor: 'rgba(166,227,161,0.2)',
            boxShadow: '0 4px 20px rgba(166,227,161,0.15)'
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px]">🎉</span>
            <strong className="text-white text-[11px] uppercase tracking-wider">¡Confirmación Real de Almacenamiento en Supabase!</strong>
          </div>
          Tus API Keys han sido subidas, escritas y verificadas mediante una lectura de validación en los servidores centrales de Supabase. Están 100% seguras y sincronizadas de manera definitiva.
        </div>
      )}

      {/* Editor local section */}
      <div className="pt-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#a6adc8] mb-3">Llaves en este Dispositivo</h4>
        <div className="space-y-4">
          {providers.map((p) => (
            <div key={p.key}>
              <label className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold" style={{ color: '#cdd6f4' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.label}
                {apiKeys[p.key] ? (
                  <span className="ml-auto text-[10px] font-bold text-[#a6e3a1]">✓ Lista en Dispositivo</span>
                ) : (
                  <span className="ml-auto text-[10px] font-bold text-[#f38ba8]">○ Vacía Localmente</span>
                )}
              </label>
              <input
                type="password"
                value={apiKeys[p.key]}
                onChange={(e) => setApiKey(p.key, e.target.value)}
                placeholder={p.placeholder}
                className="w-full rounded-xl px-4 py-2.5 text-xs outline-none transition-all duration-150"
                style={{ 
                  background: '#313244', 
                  border: apiKeys[p.key] ? '1px solid rgba(166,227,161,0.3)' : '1px solid #45475a', 
                  color: '#cdd6f4' 
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#89b4fa'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(137,180,250,0.15)'; }}
                onBlur={(e) => { 
                  e.currentTarget.style.borderColor = apiKeys[p.key] ? 'rgba(166,227,161,0.3)' : '#45475a'; 
                  e.currentTarget.style.boxShadow = 'none'; 
                }}
              />
            </div>
          ))}
        </div>
      </div>
      
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
      const res = await fetch(`${BASE_URL}/api/github/profile`, {
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
