import { create } from 'zustand';
import { persist } from 'zustand/middleware';
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export const useChatStore = create()(persist((set, get) => ({
    sessions: [],
    openSessionIds: [],
    activeSessionId: null,
    historyOpen: false,
    isStreaming: false,
    streamContent: '',
    agentStatus: null,
    attachments: [],
    agentMode: false,
    adaptiveMode: false,
    silentMode: true,
    autoApply: true,
    autoRun: false,
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
                newUsage[modelId] = { date: today, tokens: current.tokens + tokens, requests: (current.requests || 0) + 1 };
            }
            else {
                newUsage[modelId] = { date: today, tokens, requests: 1 };
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
                newUsage[modelId] = { date: today, tokens: current.tokens, requests: (current.requests || 0) + 1 };
            }
            else {
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
        const session = {
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
        const activeSessionId = get().activeSessionId === id
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
        const activeSessionId = get().activeSessionId === id
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
    renameSession: (id, name) => set({
        sessions: get().sessions.map((s) => s.id === id ? { ...s, name } : s),
    }),
    addMessage: (message) => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) {
            // Auto-create session
            const id = get().createSession();
            set({
                sessions: get().sessions.map((s) => s.id === id
                    ? { ...s, messages: [message], updatedAt: Date.now() }
                    : s),
            });
            return;
        }
        set({
            sessions: sessions.map((s) => s.id === activeSessionId
                ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
                : s),
        });
    },
    updateLastMessage: (content) => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId)
            return;
        set({
            sessions: sessions.map((s) => {
                if (s.id !== activeSessionId)
                    return s;
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
        if (!activeSessionId)
            return;
        set({
            sessions: sessions.map((s) => {
                if (s.id !== activeSessionId)
                    return s;
                const idx = s.messages.findIndex(m => m.id === messageId);
                if (idx === -1)
                    return s;
                return { ...s, messages: s.messages.slice(0, idx + 1), updatedAt: Date.now() };
            })
        });
    },
    clearCurrentSession: () => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId)
            return;
        set({
            sessions: sessions.map((s) => s.id === activeSessionId
                ? { ...s, messages: [], updatedAt: Date.now() }
                : s),
        });
    },
    setStreaming: (isStreaming) => set({ isStreaming }),
    setStreamContent: (streamContent) => set({ streamContent }),
    setAgentStatus: (agentStatus) => set({ agentStatus }),
    appendStreamContent: (chunk) => set((s) => ({ streamContent: s.streamContent + chunk })),
    addAttachment: (attachment) => set({ attachments: [...get().attachments, attachment] }),
    removeAttachment: (id) => set({ attachments: get().attachments.filter((a) => a.id !== id) }),
    clearAttachments: () => set({ attachments: [] }),
    setAgentMode: (enabled) => set({ agentMode: enabled }),
    setAdaptiveMode: (enabled) => set({ adaptiveMode: enabled }),
    setSilentMode: (enabled) => set({ silentMode: enabled }),
    setAutoApply: (enabled) => set({ autoApply: enabled }),
    setAutoRun: (enabled) => set({ autoRun: enabled }),
    setSelectedModel: (model) => {
        set({ selectedModel: model });
        get().addRecentModel(model);
    },
    addRecentModel: (model) => {
        const recent = get().recentModels.filter((m) => m !== model);
        recent.unshift(model);
        set({ recentModels: recent.slice(0, 5) });
    },
}), {
    name: 'codeai-chat-store',
    partialize: (state) => ({
        sessions: state.sessions, // Persist all; user deletes manually
        openSessionIds: state.openSessionIds,
        activeSessionId: state.activeSessionId,
        selectedModel: state.selectedModel,
        recentModels: state.recentModels,
        agentMode: state.agentMode,
        adaptiveMode: state.adaptiveMode,
        modelUsage: state.modelUsage,
        silentMode: state.silentMode,
        autoApply: state.autoApply,
        autoRun: state.autoRun,
    }),
}));
