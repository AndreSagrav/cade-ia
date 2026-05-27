import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

  // Mode
  agentMode: boolean;
  adaptiveMode: boolean;

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
  setAgentMode: (enabled: boolean) => void;
  setAdaptiveMode: (enabled: boolean) => void;
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
      agentMode: false,
      adaptiveMode: false,
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

      setAgentMode: (enabled) => set({ agentMode: enabled }),
      setAdaptiveMode: (enabled) => set({ adaptiveMode: enabled }),

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
      partialize: (state) => ({
        sessions: state.sessions, // Persist all; user deletes manually
        openSessionIds: state.openSessionIds,
        activeSessionId: state.activeSessionId,
        selectedModel: state.selectedModel,
        recentModels: state.recentModels,
        agentMode: state.agentMode,
        adaptiveMode: state.adaptiveMode,
      }),
    },
  ),
);
