import {
  FolderOpen, Save, Play, Package, Settings, Sun, Moon, Search, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { useEditorStore } from '@/store/editor-store';
import { useProject } from '@/lib/use-project';

interface TopbarProps {
  onOpenSettings?: () => void;
}

export function Topbar({ onOpenSettings }: TopbarProps) {
  const { theme, setTheme } = useSettingsStore();
  const rootPath = useEditorStore((s) => s.rootPath);
  const { handleOpenFolder, handleSaveFile, handleRunCommand } = useProject();

  const projectName = rootPath?.split(/[/\\]/).pop();

  return (
    <header
      className="relative flex h-[54px] min-h-[54px] shrink-0 items-center gap-3 px-5 z-20"
      style={{
        background: 'linear-gradient(180deg, hsl(240 21% 14%) 0%, hsl(240 21% 11%) 100%)',
        borderBottom: '1px solid hsl(var(--border-strong))',
        boxShadow: '0 4px 20px hsl(240 21% 5% / 0.4)',
      }}
    >
      {/* Gradient glow line at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, #89b4fa60, #cba6f760, #f5c2e740, transparent)',
        }}
      />

      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="relative flex h-9 w-9 items-center justify-center rounded-xl animate-gradient"
          style={{
            background: 'linear-gradient(135deg, #89b4fa, #cba6f7, #f5c2e7, #89b4fa)',
            backgroundSize: '200% 200%',
            boxShadow: '0 4px 18px rgba(137, 180, 250, 0.35)',
          }}
        >
          <span className="text-[12px] font-black font-mono text-white select-none">AI</span>
          <div className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight" style={{ color: '#cdd6f4' }}>
            CodeAI
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{
              background: 'linear-gradient(90deg, #89b4fa, #cba6f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Studio
          </span>
        </div>
      </div>

      <div className="w-px h-6 mx-1 shrink-0" style={{ background: 'hsl(var(--border-strong))' }} />

      {/* Command palette search */}
      <button
        className="flex flex-1 max-w-[340px] items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] transition-all duration-200"
        style={{
          background: 'hsl(240 21% 18%)',
          border: '1px solid hsl(var(--border-strong))',
          color: '#a6adc8',
        }}
      >
        <Search size={13} style={{ color: '#89b4fa', opacity: 0.7 }} />
        <span className="flex-1 text-left">Buscar archivos, comandos...</span>
        <kbd
          className="rounded-md px-1.5 py-0.5 text-[9px] font-mono font-semibold"
          style={{ background: 'hsl(240 21% 23%)', color: '#a6adc8', border: '1px solid hsl(var(--border-strong))' }}
        >
          Ctrl+K
        </kbd>
      </button>

      <div className="w-px h-6 mx-1 shrink-0" style={{ background: 'hsl(var(--border-strong))' }} />

      {/* Project name */}
      {projectName && (
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all duration-200 group"
          style={{
            background: 'hsl(240 21% 18%)',
            border: '1px solid hsl(var(--border))',
            color: '#a6adc8',
          }}
        >
          <FolderOpen size={13} style={{ color: '#f9e2af' }} />
          <span className="max-w-[120px] truncate group-hover:text-[#cdd6f4] transition-colors">{projectName}</span>
        </button>
      )}
      {!projectName && (
        <ToolButton icon={FolderOpen} label="Abrir" primary onClick={handleOpenFolder} />
      )}

      <ToolButton icon={Save} label="Guardar" onClick={handleSaveFile} />
      <ToolButton icon={Play} label="Run" onClick={() => handleRunCommand('npm start')} />
      <ToolButton icon={Package} label="Install" onClick={() => handleRunCommand('npm install')} />

      <div className="flex-1" />

      {/* AI badge */}
      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{
          background: 'linear-gradient(135deg, hsl(217 92% 76% / 0.1), hsl(267 84% 81% / 0.1))',
          border: '1px solid hsl(217 92% 76% / 0.2)',
        }}
      >
        <Sparkles size={11} style={{ color: '#89b4fa' }} />
        <span className="text-[10px] font-bold" style={{ color: '#89b4fa' }}>AI Ready</span>
      </div>

      {rootPath && (
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: '#a6e3a1',
            boxShadow: '0 0 8px rgba(166, 227, 161, 0.6)',
            animation: 'glow-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <div className="w-px h-6 mx-0.5 shrink-0" style={{ background: 'hsl(var(--border-strong))' }} />

      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="btn-ghost h-8 w-8 rounded-xl"
        title="Cambiar tema"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <button onClick={onOpenSettings} className="btn-ghost h-8 w-8 rounded-xl" title="Configuración">
        <Settings size={15} />
      </button>
    </header>
  );
}

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  primary?: boolean;
  onClick?: () => void;
}

function ToolButton({ icon: Icon, label, primary, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 active:scale-95"
      style={
        primary
          ? {
              background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
              color: '#11111b',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)',
            }
          : { color: '#a6adc8' }
      }
      onMouseEnter={(e) => {
        if (!primary) { e.currentTarget.style.background = 'hsl(237 16% 26%)'; e.currentTarget.style.color = '#cdd6f4'; }
      }}
      onMouseLeave={(e) => {
        if (!primary) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a6adc8'; }
      }}
    >
      <Icon size={13} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
