import { useState, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { api } from '@/lib/api';
import type { Mention, FileEntry } from '@shared/types';

function getFlatEntries(
  entries: FileEntry[],
  list: { type: 'file' | 'folder'; name: string; path: string }[] = []
): { type: 'file' | 'folder'; name: string; path: string }[] {
  for (const entry of entries) {
    if (entry.kind === 'directory') {
      list.push({ type: 'folder', name: entry.name, path: entry.path });
      if (entry.children) {
        getFlatEntries(entry.children, list);
      }
    } else {
      list.push({ type: 'file', name: entry.name, path: entry.path });
    }
  }
  return list;
}

export function useMentions() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupQuery, setPopupQuery] = useState('');
  const [popupTriggerIndex, setPopupTriggerIndex] = useState(-1);

  const { fileTree, rootPath, activeSelection } = useEditorStore();

  const checkMention = useCallback((text: string, cursorIndex: number) => {
    const textBeforeCursor = text.slice(0, cursorIndex);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      const hasSpace = /\s/.test(query);
      const isStart = lastAtIdx === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIdx - 1));

      if (!hasSpace && isStart) {
        setShowPopup(true);
        setPopupQuery(query);
        setPopupTriggerIndex(lastAtIdx);
        return;
      }
    }
    setShowPopup(false);
    setPopupQuery('');
    setPopupTriggerIndex(-1);
  }, []);

  const handleMentionSelect = useCallback(
    (item: { type: 'file' | 'folder' | 'selection'; name: string; path: string }, currentInput: string) => {
      const id = `${item.type}-${item.path}-${Date.now()}`;
      const newMention: Mention = {
        id,
        type: item.type,
        path: item.path,
        label: item.name,
      };

      // Add to mentions list if not already added
      setMentions((prev) => {
        if (prev.some((m) => m.type === item.type && m.path === item.path)) {
          return prev;
        }
        return [...prev, newMention];
      });

      // Close popup
      setShowPopup(false);
      setPopupQuery('');

      // Clean the @text from the input
      if (popupTriggerIndex !== -1) {
        const before = currentInput.slice(0, popupTriggerIndex);
        const after = currentInput.slice(popupTriggerIndex + 1 + popupQuery.length);
        setPopupTriggerIndex(-1);
        return before + after;
      }
      return currentInput;
    },
    [popupTriggerIndex, popupQuery]
  );

  const handleMentionRemove = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  const resolveMentions = useCallback(async (): Promise<string> => {
    if (mentions.length === 0) return '';

    let contextString = '\n\n--- ARCHIVOS Y CONTEXTO REFERENCIADOS POR EL USUARIO (@) ---\n';

    for (const mention of mentions) {
      if (mention.type === 'file') {
        try {
          const res = await api.readFile({
            path: mention.path,
            root: rootPath || '',
          });
          if (res && res.ok) {
            contextString += `\n### Archivo: \`${mention.path}\`\n\`\`\`\n${res.content}\n\`\`\`\n`;
          }
        } catch (err) {
          contextString += `\n### Archivo: \`${mention.path}\` (Error al leer contenido: ${err})\n`;
        }
      } else if (mention.type === 'folder') {
        // Just represent the folder structure or child file names
        contextString += `\n### Carpeta: \`${mention.path}\`\n(El usuario referenció esta carpeta)\n`;
      } else if (mention.type === 'selection') {
        if (activeSelection) {
          contextString += `\n### Código seleccionado de: \`${activeSelection.path}\` (Líneas ${activeSelection.startLine}-${activeSelection.endLine})\n\`\`\`\n${activeSelection.text}\n\`\`\`\n`;
        } else {
          contextString += `\n### Código seleccionado\n(Selección no disponible en este momento)\n`;
        }
      }
    }

    return contextString;
  }, [mentions, rootPath, activeSelection]);

  // Get matching files and directories for popup
  const getSuggestions = useCallback(() => {
    const flatList = getFlatEntries(fileTree);
    const results: { type: 'file' | 'folder' | 'selection'; name: string; path: string }[] = [];

    // 1. Check if selection is available and matches query
    if (activeSelection) {
      const selLabel = `Selección: ${activeSelection.path.split(/[/\\]/).pop()} (Líneas ${activeSelection.startLine}-${activeSelection.endLine})`;
      if ('selection'.includes(popupQuery.toLowerCase()) || 'codigo'.includes(popupQuery.toLowerCase())) {
        results.push({
          type: 'selection',
          name: selLabel,
          path: activeSelection.path,
        });
      }
    }

    // 2. Filter flat files/folders by query
    const queryLower = popupQuery.toLowerCase();
    const filteredEntries = flatList.filter(
      (item) =>
        item.name.toLowerCase().includes(queryLower) ||
        item.path.toLowerCase().includes(queryLower)
    );

    // Limit to max 8 items total
    const finalResults = [...results, ...filteredEntries].slice(0, 15);
    return finalResults;
  }, [fileTree, popupQuery, activeSelection]);

  return {
    mentions,
    showPopup,
    popupQuery,
    popupTriggerIndex,
    setShowPopup,
    handleMentionSelect,
    handleMentionRemove,
    clearMentions,
    checkMention,
    resolveMentions,
    getSuggestions,
  };
}
