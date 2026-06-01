import { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useEditorStore } from '@/store/editor-store';
import { useSettingsStore } from '@/store/settings-store';
import { getLanguageFromPath } from '@/lib/utils';
import { Tabs } from './Tabs';
import { PendingChangesBar } from './PendingChangesBar';
import { Sparkles, Search, Terminal } from 'lucide-react';

import type * as Monaco from 'monaco-editor';

export function EditorArea() {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const { activeFilePath, openFiles } = useEditorStore();
  const { fontSize, wordWrap, minimap, theme } = useSettingsStore();
  const updateFileContent = useEditorStore((s) => s.updateFileContent);

  const activeFile = activeFilePath ? openFiles.get(activeFilePath) : null;

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        if (activeFilePath) {
          useEditorStore.getState().markFileSaved(activeFilePath);
        }
      },
    );

    // Track active selection for @selection mentions
    editor.onDidChangeCursorSelection(() => {
      const model = editor.getModel();
      const path = useEditorStore.getState().activeFilePath;
      if (!model || !path) {
        useEditorStore.getState().setActiveSelection(null);
        return;
      }

      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        useEditorStore.getState().setActiveSelection(null);
      } else {
        const text = model.getValueInRange(selection);
        useEditorStore.getState().setActiveSelection({
          text,
          path,
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
        });
      }
    });
  }, [activeFilePath]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFilePath && value !== undefined) {
        updateFileContent(activeFilePath, value);
      }
    },
    [activeFilePath, updateFileContent],
  );

  const isLight = theme === 'light';
  const monacoTheme = isLight ? 'codeai-light' : 'codeai-dark';

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
      <Tabs />
      <PendingChangesBar />
      <div className="relative flex-1">
        {activeFile ? (
          <Editor
            key={activeFilePath}
            defaultValue={activeFile.content}
            language={getLanguageFromPath(activeFilePath!)}
            theme={monacoTheme}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            beforeMount={(monaco) => {
              monaco.editor.defineTheme('codeai-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                  { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
                  { token: 'keyword', foreground: '89b4fa' },
                  { token: 'keyword.control', foreground: 'cba6f7' },
                  { token: 'string', foreground: 'a6e3a1' },
                  { token: 'string.escape', foreground: '94e2d5' },
                  { token: 'number', foreground: 'fab387' },
                  { token: 'type', foreground: 'f9e2af' },
                  { token: 'type.identifier', foreground: 'f9e2af' },
                  { token: 'function', foreground: '89b4fa' },
                  { token: 'variable', foreground: 'cdd6f4' },
                  { token: 'variable.predefined', foreground: 'f38ba8' },
                  { token: 'class', foreground: 'cba6f7' },
                  { token: 'constant', foreground: 'fab387' },
                  { token: 'tag', foreground: 'f38ba8' },
                  { token: 'attribute.name', foreground: '89b4fa' },
                  { token: 'attribute.value', foreground: 'a6e3a1' },
                  { token: 'delimiter', foreground: '9399b2' },
                  { token: 'operator', foreground: '89dceb' },
                  { token: 'regexp', foreground: 'f5c2e7' },
                ],
                colors: {
                  'editor.background': '#1e1e2e',
                  'editor.foreground': '#cdd6f4',
                  'editor.lineHighlightBackground': '#31324420',
                  'editor.selectionBackground': '#45475a',
                  'editor.inactiveSelectionBackground': '#45475a40',
                  'editorLineNumber.foreground': '#45475a',
                  'editorLineNumber.activeForeground': '#a6adc8',
                  'editorCursor.foreground': '#89b4fa',
                  'editorIndentGuide.background': '#313244',
                  'editorIndentGuide.activeBackground': '#45475a',
                  'editorBracketMatch.background': '#89b4fa20',
                  'editorBracketMatch.border': '#89b4fa40',
                  'scrollbarSlider.background': '#45475a33',
                  'scrollbarSlider.hoverBackground': '#45475a66',
                  'scrollbarSlider.activeBackground': '#45475a99',
                  'editorWidget.background': '#181825',
                  'editorWidget.border': '#313244',
                  'editorSuggestWidget.background': '#181825',
                  'editorSuggestWidget.selectedBackground': '#313244',
                  'editorSuggestWidget.border': '#313244',
                },
              });
              monaco.editor.defineTheme('codeai-light', {
                base: 'vs',
                inherit: true,
                rules: [
                  { token: 'comment', foreground: '9ca0b0', fontStyle: 'italic' },
                  { token: 'keyword', foreground: '1e66f5' },
                  { token: 'string', foreground: '40a02b' },
                  { token: 'number', foreground: 'fe640b' },
                  { token: 'type', foreground: 'df8e1d' },
                  { token: 'function', foreground: '1e66f5' },
                  { token: 'variable', foreground: 'd20f39' },
                ],
                colors: {
                  'editor.background': '#eff1f5',
                  'editor.foreground': '#4c4f69',
                  'editor.lineHighlightBackground': '#e6e9ef',
                  'editor.selectionBackground': '#ccd0da',
                  'editorLineNumber.foreground': '#9ca0b0',
                  'editorLineNumber.activeForeground': '#4c4f69',
                  'editorCursor.foreground': '#1e66f5',
                },
              });
            }}
            options={{
              fontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              minimap: { enabled: minimap, maxColumn: 80 },
              wordWrap: wordWrap ? 'on' : 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 20, bottom: 20 },
              bracketPairColorization: { enabled: true },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              renderWhitespace: 'selection',
              formatOnPaste: true,
              lineHeight: 1.8,
              letterSpacing: 0.3,
            }}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-8 animate-fade-up"
      style={{ background: 'hsl(var(--background))' }}
    >
      {/* Floating gradient orb */}
      <div className="relative animate-float">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(137,180,250,0.15), rgba(203,166,247,0.15), rgba(245,194,231,0.1))',
            border: '1px solid hsl(var(--border-strong))',
            boxShadow: '0 8px 40px rgba(137, 180, 250, 0.1)',
          }}
        >
          <Sparkles size={36} style={{ color: '#89b4fa' }} />
        </div>
        {/* Glow behind */}
        <div
          className="absolute inset-0 -z-10 rounded-3xl blur-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(137,180,250,0.15), rgba(203,166,247,0.1))' }}
        />
      </div>

      <div className="text-center">
        <h2
          className="text-xl font-bold"
          style={{
            background: 'linear-gradient(135deg, #89b4fa, #cba6f7, #f5c2e7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Abre un archivo para editar
        </h2>
        <p className="mt-2 text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Selecciona un archivo del árbol o usa los atajos de teclado
        </p>
      </div>

      <div className="flex items-center gap-8">
        <ShortcutHint icon={Search} keys="Ctrl+P" label="Buscar archivo" />
        <ShortcutHint icon={Terminal} keys="Ctrl+`" label="Terminal" />
      </div>
    </div>
  );
}

function ShortcutHint({ icon: Icon, keys, label }: { icon: any; keys: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className="flex items-center gap-2 rounded-xl border px-4 py-2 text-[11px] font-mono font-medium"
        style={{
          background: 'hsl(var(--muted) / 0.4)',
          borderColor: 'hsl(var(--border-strong))',
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        <Icon size={13} />
        {keys}
      </div>
      <span className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>{label}</span>
    </div>
  );
}
