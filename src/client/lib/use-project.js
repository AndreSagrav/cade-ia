import { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { api } from './api';
import { getLanguageFromPath } from './utils';
export function useProject() {
    const { setRootPath, setRootHandle, setFileTree, openFile, setActiveFile, rootPath, openFiles, activeFilePath, markFileSaved, setFolderPickerOpen } = useEditorStore();
    /** Open folder using File System Access API (browser) or fallback to visual picker */
    const handleOpenFolder = useCallback(async () => {
        const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
        // In Electron we can't get a real path from showDirectoryPicker; use picker dialog
        if ('showDirectoryPicker' in window && !isElectron) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                const name = handle.name;
                setRootHandle(handle);
                // Resolve the actual path via backend
                const resolved = await api.resolveFolder(name);
                if (resolved.guessed) {
                    setFolderPickerOpen(true);
                    return;
                }
                setRootPath(resolved.path);
                const treeResult = await api.getTree({ root: resolved.path });
                setFileTree(treeResult.items);
            }
            catch (e) {
                if (e.name !== 'AbortError')
                    console.error('Failed to open folder:', e);
            }
        }
        else {
            // Fallback: visual folder picker
            setFolderPickerOpen(true);
        }
    }, [setRootPath, setRootHandle, setFileTree, setFolderPickerOpen]);
    /** Called by FolderPickerDialog when a path is selected */
    const handleFolderSelected = useCallback(async (path) => {
        try {
            const resolved = await api.resolveFolder(path);
            if (resolved.guessed) {
                setFolderPickerOpen(true);
                return;
            }
            setRootPath(resolved.path);
            const treeResult = await api.getTree({ root: resolved.path });
            setFileTree(treeResult.items);
        }
        catch (e) {
            console.error('Failed to open folder:', e.message);
        }
    }, [setRootPath, setFileTree]);
    /** Refresh current file tree */
    const handleRefreshTree = useCallback(async () => {
        if (!rootPath)
            return;
        const looksAbsolute = /^(?:[a-zA-Z]:\\|\\\\|\/)/.test(rootPath);
        let effectiveRoot = rootPath;
        if (!looksAbsolute) {
            try {
                const resolved = await api.resolveFolder(rootPath);
                if (resolved.guessed) {
                    setFolderPickerOpen(true);
                    return;
                }
                effectiveRoot = resolved.path;
                setRootPath(effectiveRoot);
            }
            catch (e) {
                setFolderPickerOpen(true);
                return;
            }
        }
        const treeResult = await api.getTree({ root: effectiveRoot });
        setFileTree(treeResult.items);
    }, [rootPath, setFileTree, setFolderPickerOpen, setRootPath]);
    /** Open a file for editing */
    const handleOpenFile = useCallback(async (relativePath) => {
        if (!rootPath)
            return;
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
        }
        catch (e) {
            console.error('Failed to open file:', e.message);
        }
    }, [rootPath, openFiles, openFile, setActiveFile]);
    /** Save the currently active file */
    const handleSaveFile = useCallback(async () => {
        if (!rootPath || !activeFilePath)
            return;
        const file = openFiles.get(activeFilePath);
        if (!file || !file.modified)
            return;
        try {
            const { rootHandle } = useEditorStore.getState();
            if (rootHandle) {
                // Escribir directamente al disco local del usuario usando el API Nativo
                const parts = activeFilePath.replace(/\\/g, '/').split('/');
                let currentDir = rootHandle;
                for (let i = 0; i < parts.length - 1; i++) {
                    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
                }
                const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(file.content);
                await writable.close();
            }
            else {
                // Fallback: enviar al backend
                await api.writeFile({ path: activeFilePath, content: file.content, root: rootPath });
            }
            markFileSaved(activeFilePath);
        }
        catch (e) {
            console.error('Failed to save file:', e.message);
        }
    }, [rootPath, activeFilePath, openFiles, markFileSaved]);
    /** Run terminal command */
    const handleRunCommand = useCallback(async (cmd) => {
        if (!rootPath)
            return { stdout: '', stderr: 'No project open', code: 1 };
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
