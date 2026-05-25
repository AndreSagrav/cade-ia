import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { APIKeys } from '@shared/types';

type Theme = 'dark' | 'light' | 'system';

interface SettingsState {
  theme: Theme;
  apiKeys: APIKeys;
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  sidebarWidth: number;
  chatWidth: number;
  terminalHeight: number;
  terminalVisible: boolean;
  sidebarVisible: boolean;
  chatVisible: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setApiKey: (provider: keyof APIKeys, key: string) => void;
  setAllApiKeys: (keys: Partial<APIKeys>) => void;
  setFontSize: (size: number) => void;
  setWordWrap: (enabled: boolean) => void;
  setMinimap: (enabled: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setChatWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  toggleTerminal: () => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      apiKeys: {
        claude: '',
        openai: '',
        gemini: '',
        nvidia: '',
        deepseek: '',
        openrouter: '',
      },
      fontSize: 13.5,
      wordWrap: false,
      minimap: true,
      sidebarWidth: 260,
      chatWidth: 400,
      terminalHeight: 220,
      terminalVisible: true,
      sidebarVisible: true,
      chatVisible: true,

      setTheme: (theme) => {
        set({ theme });
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        if (theme === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          root.classList.add(prefersDark ? 'dark' : 'light');
        } else {
          root.classList.add(theme);
        }
      },

      setApiKey: (provider, key) =>
        set({ apiKeys: { ...get().apiKeys, [provider]: key } }),

      setAllApiKeys: (keys) =>
        set({ apiKeys: { ...get().apiKeys, ...keys } }),

      setFontSize: (size) => set({ fontSize: Math.max(10, Math.min(24, size)) }),
      setWordWrap: (enabled) => set({ wordWrap: enabled }),
      setMinimap: (enabled) => set({ minimap: enabled }),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),
      setChatWidth: (width) => set({ chatWidth: Math.max(300, Math.min(700, width)) }),
      setTerminalHeight: (height) => set({ terminalHeight: Math.max(100, Math.min(600, height)) }),
      toggleWordWrap: () => set({ wordWrap: !get().wordWrap }),
      toggleMinimap: () => set({ minimap: !get().minimap }),
      toggleTerminal: () => set({ terminalVisible: !get().terminalVisible }),
      toggleSidebar: () => set({ sidebarVisible: !get().sidebarVisible }),
      toggleChat: () => set({ chatVisible: !get().chatVisible }),
    }),
    {
      name: 'codeai-settings',
      partialize: (state) => ({
        theme: state.theme,
        apiKeys: state.apiKeys,
        fontSize: state.fontSize,
        wordWrap: state.wordWrap,
        minimap: state.minimap,
        sidebarWidth: state.sidebarWidth,
        chatWidth: state.chatWidth,
        terminalHeight: state.terminalHeight,
        terminalVisible: state.terminalVisible,
        sidebarVisible: state.sidebarVisible,
        chatVisible: state.chatVisible,
      }),
    },
  ),
);
