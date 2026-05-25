import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { getLanguageFromPath } from '@/lib/utils';
import { AI_MODELS } from '@shared/models';

export function StatusBar() {
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const model = AI_MODELS[selectedModel];

  const fileName = activeFilePath?.split(/[/\\]/).pop() ?? 'Sin archivo';
  const language = activeFilePath ? getLanguageFromPath(activeFilePath) : '—';

  return (
    <footer className="flex h-[26px] items-center gap-4 border-t border-border bg-surface px-4 text-[10.5px] font-medium text-muted-foreground backdrop-blur-md">
      <span className="text-accent">{fileName}</span>
      <span className="opacity-30">·</span>
      <span>{language}</span>
      <span className="opacity-30">·</span>
      <span>Ln 1, Col 1</span>
      <span className="opacity-30">·</span>
      <span>{model?.label ?? 'Sin modelo'}</span>
      <div className="flex-1" />
      <span>UTF-8</span>
    </footer>
  );
}
