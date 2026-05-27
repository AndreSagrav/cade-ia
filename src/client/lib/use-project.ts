import { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { api } from './api';
import { getLanguageFromPath } from './utils';
import type { FileEntry } from '@shared/types';

export function useProject() {
  const {
    setRootPath, setRootHandle, setFileTree,
    openFile, setActiveFile, rootPath,
    openFiles, activeFilePath, markFileSaved,
    setFolderPickerOpen
  } = useEditorStore();

  /** Open folder using File System Access API (browser) or fallback to visual picker */
  const handleOpenFolder = useCallback(async () => {
    // Try File System Access API first (works in Chromium-based browsers)
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const name = handle.name;
        setRootHandle(handle);

        // Resolve the actual path via backend
        const resolved = await api.resolveFolder(name);
        setRootPath(resolved.path);

        // Load file tree
        const treeResult = await api.getTree({ root: resolved.path });
        setFileTree(treeResult.items as FileEntry[]);
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Failed to open folder:', e);
      }
    } else {
      // Fallback: visual folder picker
      setFolderPickerOpen(true);
    }
  }, [setRootPath, setRootHandle, setFileTree, setFolderPickerOpen]);

  /** Called by FolderPickerDialog when a path is selected */
  const handleFolderSelected = useCallback(async (path: string) => {
    try {
      const resolved = await api.resolveFolder(path);
      setRootPath(resolved.path);
      const treeResult = await api.getTree({ root: resolved.path });
      setFileTree(treeResult.items as FileEntry[]);
    } catch (e: any) {
      console.error('Failed to open folder:', e.message);
    }
  }, [setRootPath, setFileTree]);

  /** Refresh current file tree */
  const handleRefreshTree = useCallback(async () => {
    if (!rootPath) return;
    const treeResult = await api.getTree({ root: rootPath });
    setFileTree(treeResult.items as FileEntry[]);
  }, [rootPath, setFileTree]);

  /** Open a file for editing */
  const handleOpenFile = useCallback(async (relativePath: string) => {
    if (!rootPath) return;

    // Already open? Just switch to it
    const fullPath = relativePath;
    if (openFiles.has(fullPath)) {
      setActiveFile(fullPath);
      return;
    }

    try {
      const result = await api.readFile({ path: relativePath, root: rootPath });
      openFile(fullPath, {
        path: fullPath,
        content: result.content,
        language: getLanguageFromPath(fullPath),
        modified: false,
      });
    } catch (e: any) {
      console.error('Failed to open file:', e.message);
    }
  }, [rootPath, openFiles, openFile, setActiveFile]);

  /** Save the currently active file */
  const handleSaveFile = useCallback(async () => {
    if (!rootPath || !activeFilePath) return;
    const file = openFiles.get(activeFilePath);
    if (!file || !file.modified) return;

    try {
      await api.writeFile({ path: activeFilePath, content: file.content, root: rootPath });
      markFileSaved(activeFilePath);
    } catch (e: any) {
      console.error('Failed to save file:', e.message);
    }
  }, [rootPath, activeFilePath, openFiles, markFileSaved]);

  /** Run terminal command */
  const handleRunCommand = useCallback(async (cmd: string) => {
    if (!rootPath) return { stdout: '', stderr: 'No project open', code: 1 };
    return api.runCommand({ cmd, cwd: rootPath });
  }, [rootPath]);

  return {
    handleOpenFolder,
    handleFolderSelected,
    handleRefreshTree,
    handleOpenFile,
    handleSaveFile,
    handleRunCommand,
  };
}
