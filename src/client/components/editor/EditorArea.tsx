import { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useEditorStore } from '@/store/editor-store';
import { useSettingsStore } from '@/store/settings-store';
import { getLanguageFromPath } from '@/lib/utils';
import { Tabs } from './Tabs';
import { PendingChangesBar } from './PendingChangesBar';

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
        // Save file via store action
        if (activeFilePath) {
          useEditorStore.getState().markFileSaved(activeFilePath);
        }
      },
    );
  }, [activeFilePath]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFilePath && value !== undefined) {
        updateFileContent(activeFilePath, value);
      }
    },
    [activeFilePath, updateFileContent],
  );

  const monacoTheme = theme === 'light' ? 'codeai-light' : 'codeai-dark';

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
                  { token: 'comment', foreground: '807870', fontStyle: 'italic' },
                  { token: 'keyword', foreground: '26C6DA' },
                  { token: 'string', foreground: '7ECE96' },
                  { token: 'number', foreground: 'D4A843' },
                  { token: 'type', foreground: '80DEEA' },
                  { token: 'function', foreground: 'B8A0E8' },
                ],
                colors: {
                  'editor.background': '#181b1f',
                  'editor.foreground': '#e2deda',
                  'editor.lineHighlightBackground': '#22262c',
                  'editor.selectionBackground': '#1a3a42',
                  'editorLineNumber.foreground': '#5e5850',
                  'editorLineNumber.activeForeground': '#26C6DA',
                  'editorCursor.foreground': '#26C6DA',
                },
              });
              monaco.editor.defineTheme('codeai-light', {
                base: 'vs',
                inherit: true,
                rules: [
                  { token: 'comment', foreground: '8a867e', fontStyle: 'italic' },
                  { token: 'keyword', foreground: '00838F' },
                  { token: 'string', foreground: '2E7D32' },
                  { token: 'number', foreground: 'A87D1D' },
                  { token: 'type', foreground: '006D75' },
                  { token: 'function', foreground: '6B4FA8' },
                ],
                colors: {
                  'editor.background': '#f6f4f0',
                  'editor.foreground': '#2d2b27',
                  'editor.lineHighlightBackground': '#edeae5',
                  'editor.selectionBackground': '#c8e6e9',
                  'editorLineNumber.foreground': '#b0ada5',
                  'editorLineNumber.activeForeground': '#00838F',
                  'editorCursor.foreground': '#00838F',
                },
              });
            }}
            options={{
              fontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: minimap, maxColumn: 80 },
              wordWrap: wordWrap ? 'on' : 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
              bracketPairColorization: { enabled: true },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              renderWhitespace: 'selection',
              formatOnPaste: true,
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
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background">
      <div className="text-6xl opacity-20">⟨/⟩</div>
      <p className="text-sm font-medium text-muted-foreground">
        Abre un archivo para empezar a editar
      </p>
      <div className="flex gap-3 text-xs text-muted-foreground/60">
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">Ctrl+P</kbd>
        <span>Buscar archivo</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">Ctrl+Shift+P</kbd>
        <span>Comandos</span>
      </div>
    </div>
  );
}
