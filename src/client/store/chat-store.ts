import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ChatSession, Attachment } from '@shared/types';

interface ChatState {
  // Sessions
  sessions: ChatSession[];
  activeSessionId: string | null;
  
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
  
  // Actions
  createSession: (name?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
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
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      streamContent: '',
      attachments: [],
      agentMode: false,
      adaptiveMode: false,
      selectedModel: 'gemini-2.5-flash',
      recentModels: [],

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
          activeSessionId: id,
        });
        return id;
      },

      deleteSession: (id) => {
        const sessions = get().sessions.filter((s) => s.id !== id);
        const activeSessionId =
          get().activeSessionId === id
            ? sessions[sessions.length - 1]?.id ?? null
            : get().activeSessionId;
        set({ sessions, activeSessionId });
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

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
        sessions: state.sessions.slice(-20), // Keep last 20 sessions
        selectedModel: state.selectedModel,
        recentModels: state.recentModels,
        agentMode: state.agentMode,
        adaptiveMode: state.adaptiveMode,
      }),
    },
  ),
);
