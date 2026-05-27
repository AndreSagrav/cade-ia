import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { getLanguageFromPath } from '@/lib/utils';
import { AI_MODELS } from '@shared/models';
import { GitBranch, Cpu } from 'lucide-react';

const PROVIDER_COLORS: Record<string, string> = {
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

  return (
    <footer
      className="flex h-[28px] shrink-0 items-center px-4 text-[10.5px] font-medium"
      style={{
        background: 'linear-gradient(90deg, hsl(240 21% 10%), hsl(240 21% 12%))',
        borderTop: '1px solid hsl(var(--border-strong))',
        color: '#a6adc8',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <GitBranch size={11} style={{ color: '#89b4fa' }} />
          <span style={{ color: '#89b4fa' }}>main</span>
        </div>

        {fileName && (
          <>
            <span style={{ color: '#45475a' }}>·</span>
            <span className="truncate max-w-[180px]">{fileName}</span>
            <span style={{ color: '#45475a' }}>·</span>
            <span className="capitalize" style={{ color: '#f9e2af' }}>{language}</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Right */}
      <div className="flex items-center gap-2.5">
        {model && (
          <div className="flex items-center gap-1.5">
            <Cpu size={10} style={{ color: providerColor }} />
            <span style={{ color: providerColor }}>{model.label}</span>
          </div>
        )}
        <span style={{ color: '#45475a' }}>·</span>
        <span>UTF-8</span>
        <span style={{ color: '#45475a' }}>·</span>
        <span>Ln 1, Col 1</span>
      </div>
    </footer>
  );
}
