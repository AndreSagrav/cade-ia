import {
  FolderOpen, Save, Play, Package, Monitor,
  Settings, Sun, Moon, Zap,
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

  return (
    <header className="flex h-[54px] min-h-[54px] items-center gap-2 border-b border-border bg-surface px-4 backdrop-blur-xl">
      {/* Logo */}
      <div className="mr-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-content-center rounded-lg bg-gradient-to-br from-accent to-accent-dim text-white shadow-lg">
          <span className="w-full text-center text-xs font-bold font-mono">⟨/⟩</span>
        </div>
        <span className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-base font-bold tracking-tight text-transparent">
          CodeAI
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          studio
        </span>
      </div>

      <Separator />

      {/* Project actions */}
      <ToolButton icon={FolderOpen} label="Abrir carpeta" primary onClick={handleOpenFolder} />
      <ToolButton icon={Save} label="Guardar" shortcut="Ctrl+S" onClick={handleSaveFile} />
      <Separator />
      <ToolButton icon={Play} label="Ejecutar" onClick={() => handleRunCommand('npm start')} />
      <ToolButton icon={Package} label="npm install" onClick={() => handleRunCommand('npm install')} />
      <Separator />
      <ToolButton icon={Monitor} label="Preview" />
      <ToolButton icon={Zap} label="Scaffold" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status */}
      {rootPath && (
        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
          <div className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px] shadow-success/50" />
          <span className="max-w-[140px] truncate">{rootPath.split(/[/\\]/).pop()}</span>
        </div>
      )}

      <Separator />

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Cambiar tema"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Configuración (Ctrl+,)"
      >
        <Settings size={15} />
      </button>
    </header>
  );
}

function Separator() {
  return <div className="mx-1 h-4 w-px bg-border" />;
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
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11.5px] font-medium transition-all hover:-translate-y-px hover:shadow-sm ${
        primary
          ? 'border-transparent bg-gradient-to-r from-accent to-accent-dim text-white shadow-md'
          : 'border-border bg-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
      }`}
      title={label}
    >
      <Icon size={13} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
