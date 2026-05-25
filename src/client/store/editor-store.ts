import { create } from 'zustand';
import type { OpenFile, FileEntry, PendingChange } from '@shared/types';

interface EditorState {
  // Project
  rootPath: string | null;
  rootHandle: FileSystemDirectoryHandle | null;
  fileTree: FileEntry[];
  
  // Files
  openFiles: Map<string, OpenFile>;
  activeFilePath: string | null;
  contextFiles: Set<string>;
  
  // Changes
  pendingChanges: PendingChange[];
  
  // Actions
  setRootPath: (path: string) => void;
  setRootHandle: (handle: FileSystemDirectoryHandle) => void;
  setFileTree: (tree: FileEntry[]) => void;
  openFile: (path: string, file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string) => void;
  toggleContextFile: (path: string) => void;
  clearContextFiles: () => void;
  addPendingChange: (change: PendingChange) => void;
  updateChangeStatus: (id: string, status: PendingChange['status']) => void;
  clearPendingChanges: () => void;
  reset: () => void;
}

const initialState = {
  rootPath: null,
  rootHandle: null,
  fileTree: [],
  openFiles: new Map<string, OpenFile>(),
  activeFilePath: null,
  contextFiles: new Set<string>(),
  pendingChanges: [],
};

export const useEditorStore = create<EditorState>()((set, get) => ({
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
    if (ctx.has(path)) ctx.delete(path);
    else ctx.add(path);
    set({ contextFiles: ctx });
  },

  clearContextFiles: () => set({ contextFiles: new Set() }),

  addPendingChange: (change) =>
    set({ pendingChanges: [...get().pendingChanges, change] }),

  updateChangeStatus: (id, status) =>
    set({
      pendingChanges: get().pendingChanges.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    }),

  clearPendingChanges: () => set({ pendingChanges: [] }),

  reset: () => set(initialState),
}));

