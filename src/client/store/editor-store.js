import { create } from 'zustand';
import { persist } from 'zustand/middleware';
const initialState = {
    rootPath: null,
    rootHandle: null,
    fileTree: [],
    openFiles: new Map(),
    activeFilePath: null,
    contextFiles: new Set(),
    pendingChanges: [],
    folderPickerOpen: false,
};
export const useEditorStore = create()(persist((set, get) => ({
    ...initialState,
    setRootPath: (path) => set({ rootPath: path }),
    setRootHandle: (handle) => set({ rootHandle: handle }),
    setFileTree: (tree) => set({ fileTree: tree }),
    openFile: (path, file) => {
        const files = new Map(get().openFiles);
        files.set(path, file);
        set({ openFiles: files, activeFilePath: path });
    },
    closeFile: (path) => {
        const files = new Map(get().openFiles);
        files.delete(path);
        const remaining = [...files.keys()];
        const activeFilePath = get().activeFilePath === path
            ? remaining[remaining.length - 1] ?? null
            : get().activeFilePath;
        set({ openFiles: files, activeFilePath });
    },
    setActiveFile: (path) => set({ activeFilePath: path }),
    updateFileContent: (path, content) => {
        const files = new Map(get().openFiles);
        const file = files.get(path);
        if (file) {
            files.set(path, { ...file, content, modified: true });
            set({ openFiles: files });
        }
    },
    markFileSaved: (path) => {
        const files = new Map(get().openFiles);
        const file = files.get(path);
        if (file) {
            files.set(path, { ...file, modified: false });
            set({ openFiles: files });
        }
    },
    toggleContextFile: (path) => {
        const ctx = new Set(get().contextFiles);
        if (ctx.has(path))
            ctx.delete(path);
        else
            ctx.add(path);
        set({ contextFiles: ctx });
    },
    clearContextFiles: () => set({ contextFiles: new Set() }),
    addPendingChange: (change) => set({ pendingChanges: [...get().pendingChanges, change] }),
    updateChangeStatus: (id, status) => set({
        pendingChanges: get().pendingChanges.map((c) => c.id === id ? { ...c, status } : c),
    }),
    clearPendingChanges: () => set({ pendingChanges: [] }),
    applyPreview: (path, original, proposed, changeId) => {
        const files = new Map(get().openFiles);
        const existing = files.get(path);
        files.set(path, {
            path,
            content: proposed,
            language: existing?.language ?? '',
            modified: true,
            handle: existing?.handle,
            originalContent: original,
            previewChangeId: changeId,
        });
        set({ openFiles: files, activeFilePath: path });
    },
    revertPreview: (path) => {
        const files = new Map(get().openFiles);
        const file = files.get(path);
        if (!file)
            return;
        if (file.originalContent !== undefined) {
            files.set(path, {
                ...file,
                content: file.originalContent,
                originalContent: undefined,
                previewChangeId: undefined,
                modified: false,
            });
            set({ openFiles: files });
        }
    },
    commitPreview: (path) => {
        const files = new Map(get().openFiles);
        const file = files.get(path);
        if (!file)
            return;
        files.set(path, {
            ...file,
            originalContent: undefined,
            previewChangeId: undefined,
            modified: false,
        });
        set({ openFiles: files });
    },
    setFolderPickerOpen: (open) => set({ folderPickerOpen: open }),
    reset: () => set(initialState),
}), {
    name: 'codeai-editor-store',
    partialize: (state) => ({
        rootPath: state.rootPath,
        activeFilePath: state.activeFilePath,
        openFilesArray: Array.from(state.openFiles.entries()),
    }),
    merge: (persistedState, currentState) => ({
        ...currentState,
        rootPath: persistedState?.rootPath ?? currentState.rootPath,
        activeFilePath: persistedState?.activeFilePath ?? currentState.activeFilePath,
        openFiles: new Map(persistedState?.openFilesArray ?? []),
    }),
}));
