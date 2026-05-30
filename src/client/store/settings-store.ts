import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { APIKeys, GitHubAccount } from '@shared/types';

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
  githubAccounts: GitHubAccount[];
  activeGithubAccount: string | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setApiKey: (provider: keyof APIKeys, key: string) => void;
  setAllApiKeys: (keys: Partial<APIKeys>) => void;
  addGithubAccount: (account: GitHubAccount) => void;
  removeGithubAccount: (username: string) => void;
  setActiveGithubAccount: (username: string | null) => void;
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
  hydrateFromCloud: (keys: Partial<APIKeys>) => void;
}

/** Migrate API keys from v1 (localStorage 'codeai_keys') */
function migrateV1Keys(): Partial<APIKeys> {
  try {
    const raw = localStorage.getItem('codeai_keys');
    if (!raw) return {};
    const v1 = JSON.parse(raw);
    return {
      claude: v1.claude || '',
      openai: v1.openai || '',
      gemini: v1.gemini || '',
      nvidia: v1.nvidia || '',
      deepseek: v1.deepseek || '',
      openrouter: v1.openrouter || '',
    };
  } catch { return {}; }
}

const v1Keys = migrateV1Keys();

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      apiKeys: {
        claude: v1Keys.claude || '',
        openai: v1Keys.openai || '',
        gemini: v1Keys.gemini || '',
        nvidia: v1Keys.nvidia || '',
        deepseek: v1Keys.deepseek || '',
        openrouter: v1Keys.openrouter || '',
      },
      githubAccounts: [],
      activeGithubAccount: null,
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

      addGithubAccount: (account) => set((state) => {
        const exists = state.githubAccounts.find((a) => a.username === account.username);
        const newAccounts = exists
          ? state.githubAccounts.map((a) => a.username === account.username ? account : a)
          : [...state.githubAccounts, account];
        return {
          githubAccounts: newAccounts,
          activeGithubAccount: state.activeGithubAccount || account.username,
        };
      }),

      removeGithubAccount: (username) => set((state) => {
        const newAccounts = state.githubAccounts.filter((a) => a.username !== username);
        return {
          githubAccounts: newAccounts,
          activeGithubAccount: state.activeGithubAccount === username 
            ? (newAccounts[0]?.username || null) 
            : state.activeGithubAccount
        };
      }),

      setActiveGithubAccount: (username) => set({ activeGithubAccount: username }),

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
      hydrateFromCloud: (keys) => {
        set({ apiKeys: { ...get().apiKeys, ...keys } });
      },
    }),
    {
      name: 'codeai-settings',
      partialize: (state) => ({
        theme: state.theme,
        apiKeys: state.apiKeys,
        githubAccounts: state.githubAccounts,
        activeGithubAccount: state.activeGithubAccount,
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
      onRehydrateStorage: () => (state) => {
        // After rehydration, fill any empty keys from v1
        if (!state) return;
        const keys = state.apiKeys;
        const needsMigration = Object.values(keys).every((k) => !k);
        if (needsMigration && Object.values(v1Keys).some((k) => !!k)) {
          state.setAllApiKeys(v1Keys as APIKeys);
        } else {
          // Fill individual empty keys from v1
          const merged: Partial<APIKeys> = {};
          let changed = false;
          for (const [provider, v1Val] of Object.entries(v1Keys)) {
            if (!keys[provider as keyof APIKeys] && v1Val) {
              merged[provider as keyof APIKeys] = v1Val;
              changed = true;
            }
          }
          if (changed) state.setAllApiKeys(merged as APIKeys);
        }
      },
    },
  ),
);
