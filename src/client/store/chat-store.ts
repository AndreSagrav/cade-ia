import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatMessage, ChatSession, Attachment } from '@shared/types';

interface ChatState {
  // Sessions (full archive; closed ones remain here until deleted)
  sessions: ChatSession[];
  /** IDs of sessions currently open as tabs */
  openSessionIds: string[];
  activeSessionId: string | null;
  /** Whether history drawer is open */
  historyOpen: boolean;

  // Current state
  isStreaming: boolean;
  streamContent: string;
  attachments: Attachment[];
  leanContext: boolean;
  agentStatus: { type: 'thinking' | 'rate_limit' | 'tool_call' | 'idle'; message?: string; delay?: number; attempt?: number; maxAttempts?: number } | null;

  // Mode
  agentMode: boolean;
  adaptiveMode: boolean;
  unlimitedAgent: boolean;

  // Model
  selectedModel: string;
  recentModels: string[];
  modelUsage: Record<string, { date: string, tokens: number, requests: number }>;

  // Actions
  createSession: (name?: string) => string;
  closeSession: (id: string) => void;
  reopenSession: (id: string) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  setHistoryOpen: (open: boolean) => void;
  renameSession: (id: string, name: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  truncateMessagesFrom: (messageId: string) => void;
  clearCurrentSession: () => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  appendStreamContent: (chunk: string) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setLeanContext: (enabled: boolean) => void;
  setAgentStatus: (status: { type: 'thinking' | 'rate_limit' | 'tool_call' | 'idle'; message?: string; delay?: number; attempt?: number; maxAttempts?: number } | null) => void;
  setAgentMode: (enabled: boolean) => void;
  setAdaptiveMode: (enabled: boolean) => void;
  setUnlimitedAgent: (enabled: boolean) => void;
  setSelectedModel: (model: string) => void;
  addRecentModel: (model: string) => void;
  incrementModelUsage: (modelId: string, tokens: number) => void;
  incrementModelRequests: (modelId: string) => void;
  abortController: AbortController | null;
  abortAgent: () => void;
  setAbortController: (controller: AbortController | null) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      openSessionIds: [],
      activeSessionId: null,
      historyOpen: false,
      isStreaming: false,
      streamContent: '',
      attachments: [],
      leanContext: false,
      agentStatus: null,
      agentMode: false,
      adaptiveMode: false,
      unlimitedAgent: false,
      selectedModel: 'gemini-2.5-flash',
      recentModels: [],
      modelUsage: {},
      abortController: null,

      incrementModelUsage: (modelId, tokens) => {
        const today = new Date().toISOString().split('T')[0];
        set((state) => {
          const current = state.modelUsage[modelId];
          const newUsage = { ...state.modelUsage };
          if (current && current.date === today) {
            newUsage[modelId] = { date: today, tokens: current.tokens + tokens, requests: current.requests };
          } else {
            newUsage[modelId] = { date: today, tokens, requests: 0 };
          }
          return { modelUsage: newUsage };
        });
      },

      incrementModelRequests: (modelId) => {
        const today = new Date().toISOString().split('T')[0];
        set((state) => {
          const current = state.modelUsage[modelId];
          const newUsage = { ...state.modelUsage };
          if (current && current.date === today) {
            newUsage[modelId] = { date: today, tokens: current.tokens, requests: current.requests + 1 };
          } else {
            newUsage[modelId] = { date: today, tokens: 0, requests: 1 };
          }
          return { modelUsage: newUsage };
        });
      },

      abortAgent: () => {
        const ctrl = get().abortController;
        if (ctrl) {
          ctrl.abort();
          set({ abortController: null, isStreaming: false });
        }
      },
      setAbortController: (controller) => set({ abortController: controller }),

      createSession: (name) => {
        const id = generateId();
        const session: ChatSession = {
          id,
          name: name || `Chat ${get().sessions.length + 1}`,
          messages: [],
          model: get().selectedModel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({
          sessions: [...get().sessions, session],
          openSessionIds: [...get().openSessionIds, id],
          activeSessionId: id,
          historyOpen: false,
        });
        return id;
      },

      closeSession: (id) => {
        const openIds = get().openSessionIds.filter((x) => x !== id);
        const activeSessionId =
          get().activeSessionId === id
            ? openIds[openIds.length - 1] ?? null
            : get().activeSessionId;
        set({ openSessionIds: openIds, activeSessionId });
      },

      reopenSession: (id) => {
        const openIds = get().openSessionIds.includes(id)
          ? get().openSessionIds
          : [...get().openSessionIds, id];
        set({ openSessionIds: openIds, activeSessionId: id, historyOpen: false });
      },

      deleteSession: (id) => {
        const sessions = get().sessions.filter((s) => s.id !== id);
        const openIds = get().openSessionIds.filter((x) => x !== id);
        const activeSessionId =
          get().activeSessionId === id
            ? openIds[openIds.length - 1] ?? null
            : get().activeSessionId;
        set({ sessions, openSessionIds: openIds, activeSessionId });
      },

      setActiveSession: (id) => {
        const openIds = get().openSessionIds.includes(id)
          ? get().openSessionIds
          : [...get().openSessionIds, id];
        set({ openSessionIds: openIds, activeSessionId: id });
      },

      setHistoryOpen: (open) => set({ historyOpen: open }),

      renameSession: (id, name) =>
        set({
          sessions: get().sessions.map((s) =>
            s.id === id ? { ...s, name } : s,
          ),
        }),

      addMessage: (message) => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) {
          // Auto-create session
          const id = get().createSession();
          set({
            sessions: get().sessions.map((s) =>
              s.id === id
                ? { ...s, messages: [message], updatedAt: Date.now() }
                : s,
            ),
          });
          return;
        }
        set({
          sessions: sessions.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
              : s,
          ),
        });
      },

      updateLastMessage: (content) => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) return;
        set({
          sessions: sessions.map((s) => {
            if (s.id !== activeSessionId) return s;
            const messages = [...s.messages];
            if (messages.length > 0) {
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content,
              };
            }
            return { ...s, messages, updatedAt: Date.now() };
          }),
        });
      },

      truncateMessagesFrom: (messageId) => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) return;
        set({
          sessions: sessions.map((s) => {
            if (s.id !== activeSessionId) return s;
            const idx = s.messages.findIndex(m => m.id === messageId);
            if (idx === -1) return s;
            return { ...s, messages: s.messages.slice(0, idx + 1), updatedAt: Date.now() };
          })
        });
      },

      clearCurrentSession: () => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) return;
        set({
          sessions: sessions.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [], updatedAt: Date.now() }
              : s,
          ),
        });
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setStreamContent: (content) => set({ streamContent: content }),
      appendStreamContent: (chunk) =>
        set({ streamContent: get().streamContent + chunk }),

      addAttachment: (attachment) =>
        set({ attachments: [...get().attachments, attachment] }),
      removeAttachment: (id) =>
        set({ attachments: get().attachments.filter((a) => a.id !== id) }),
      clearAttachments: () => set({ attachments: [] }),

      setLeanContext: (enabled) => set({ leanContext: enabled }),

      setAgentStatus: (status) => set({ agentStatus: status }),

      setAgentMode: (enabled) => set({ agentMode: enabled }),
      setAdaptiveMode: (enabled) => set({ adaptiveMode: enabled }),
      setUnlimitedAgent: (enabled) => set({ unlimitedAgent: enabled }),

      setSelectedModel: (model) => {
        set({ selectedModel: model });
        get().addRecentModel(model);
      },

      addRecentModel: (model) => {
        const recent = get().recentModels.filter((m) => m !== model);
        recent.unshift(model);
        set({ recentModels: recent.slice(0, 5) });
      },
    }),
    {
      name: 'codeai-chat-store',
      storage: createJSONStorage(() => {
        const safeStorage = {
          getItem: (key: string) => {
            try {
              const v = localStorage.getItem(key);
              if (v !== null) return v;
            } catch (e) {
              console.warn('[chat-store] getItem failed (localStorage). Trying sessionStorage.', e);
            }
            try {
              return sessionStorage.getItem(key);
            } catch {
              return null;
            }
          },
          setItem: (key: string, value: string) => {
            const trySet = (payload: string): boolean => {
              try {
                localStorage.setItem(key, payload);
                return true;
              } catch (err) {
                return false;
              }
            };

            // 1) Direct attempt
            if (trySet(value)) return;

            const trySession = (payload: string): boolean => {
              try {
                sessionStorage.setItem(key, payload);
                console.warn('[chat-store] persisted to sessionStorage fallback');
                return true;
              } catch {
                return false;
              }
            };

            // 2) If it failed, progressively trim heavy fields (attachments content, long texts, very old sessions)
            try {
              const data = JSON.parse(value);
              const state = typeof data === 'object' && data !== null ? data : {};

              const sessions = Array.isArray(state.state?.sessions) ? state.state.sessions : [];

              const sanitizeMsg = (m: any) => {
                const mm = { ...m };
                if (mm.attachments && Array.isArray(mm.attachments)) {
                  // Drop base64 content to avoid multi-MB payloads, keep metadata
                  mm.attachments = mm.attachments.map((a: any) => ({ id: a.id, name: a.name, type: a.type, mime: a.mime, size: a.size }));
                }
                // Truncate extremely long assistant outputs
                if (typeof mm.content === 'string' && mm.content.length > 12000) {
                  mm.content = mm.content.slice(0, 12000) + '\n…';
                }
                return mm;
              };

              const trimSessions = (maxSessions: number, maxMsgs: number) => {
                const copy = [...sessions]
                  .sort((a: any, b: any) => (b?.updatedAt || 0) - (a?.updatedAt || 0))
                  .slice(0, maxSessions)
                  .map((s: any) => ({
                    ...s,
                    messages: Array.isArray(s.messages)
                      ? s.messages.slice(-maxMsgs).map(sanitizeMsg)
                      : [],
                  }));
                return copy;
              };

              // Try up to 3 levels of trimming
              const levels = [
                { maxSessions: 30, maxMsgs: 80 },
                { maxSessions: 20, maxMsgs: 60 },
                { maxSessions: 12, maxMsgs: 40 },
              ];

              for (const lv of levels) {
                const compact = {
                  ...state,
                  state: {
                    ...(state.state || {}),
                    sessions: trimSessions(lv.maxSessions, lv.maxMsgs),
                  },
                };
                const payload = JSON.stringify(compact);
                if (trySet(payload) || trySession(payload)) return;
              }

              // Final attempt: persist only metadata (without any messages)
              const metaOnly = {
                ...state,
                state: {
                  ...(state.state || {}),
                  sessions: (sessions as any[]).slice(-10).map((s: any) => ({ id: s.id, name: s.name, model: s.model, createdAt: s.createdAt, updatedAt: s.updatedAt, messages: [] })),
                },
              };
              const metaPayload = JSON.stringify(metaOnly);
              if (trySet(metaPayload) || trySession(metaPayload)) {
                console.warn('[chat-store] Persisted metadata only (quota). Últimas sesiones sin mensajes.');
              }
            } catch (e) {
              console.warn('[chat-store] persist failed (quota or private mode); continuing without persistence', e);
            }
          },
          removeItem: (key: string) => {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn('[chat-store] removeItem failed', e);
            }
          },
        } as const;
        return safeStorage;
      }),
      partialize: (state) => ({
        sessions: state.sessions, // Persist all; user deletes manually
        openSessionIds: state.openSessionIds,
        activeSessionId: state.activeSessionId,
        selectedModel: state.selectedModel,
        recentModels: state.recentModels,
        agentMode: state.agentMode,
        adaptiveMode: state.adaptiveMode,
        unlimitedAgent: state.unlimitedAgent,
      }),
    },
  ),
);
