import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Bot, User, Sparkles, Zap } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { cn } from '@/lib/utils';
import { streamChat } from '@/lib/ai-stream';
import { ModelSelector } from './ModelSelector';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    sessions, activeSessionId, isStreaming, streamContent,
    selectedModel, agentMode, setAgentMode,
    addMessage, createSession, setStreaming, setStreamContent,
  } = useChatStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.length, streamContent]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Ensure session exists
    if (!activeSessionId) {
      createSession(text.slice(0, 40));
    }

    addMessage({
      id: Date.now().toString(36),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    // Call real AI stream
    await streamChat(text);
  }, [input, isStreaming, activeSessionId, selectedModel, addMessage, createSession, setStreaming, setStreamContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border bg-surface/30 backdrop-blur-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-accent" />
          <span className="text-xs font-bold text-foreground">Chat IA</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all',
              agentMode
                ? 'bg-warning/20 text-warning ring-1 ring-warning/30'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Zap size={9} className="mr-0.5 inline" />
            Agent
          </button>
        </div>
      </div>

      {/* Model selector */}
      <ModelSelector />

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isStreaming && <EmptyChat />}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div className="flex gap-2 rounded-lg bg-accent/5 p-3">
            <Bot size={14} className="mt-0.5 shrink-0 text-accent" />
            <div className="text-xs text-muted-foreground">
              {streamContent || (
                <span className="inline-flex items-center gap-1">
                  <span className="animate-pulse">Pensando</span>
                  <span className="animate-pulse delay-100">.</span>
                  <span className="animate-pulse delay-200">.</span>
                  <span className="animate-pulse delay-300">.</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
          <button className="mb-0.5 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Paperclip size={14} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Pregunta sobre tu código... (Enter = enviar)"
            className="max-h-[150px] flex-1 resize-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white transition-all hover:bg-accent-dim disabled:opacity-30"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <Sparkles size={28} className="text-accent/40" />
      <div>
        <p className="text-xs font-medium text-foreground">CodeAI Studio</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pregunta, analiza código, genera archivos
        </p>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: { id: string; role: string; content: string; model?: string };
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 rounded-lg p-3', isUser ? 'bg-muted/30' : 'bg-accent/5')}>
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <User size={13} className="text-muted-foreground" />
        ) : (
          <Bot size={13} className="text-accent" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[10px] font-semibold text-muted-foreground">
          {isUser ? 'Tú' : AI_MODELS[message.model ?? '']?.label ?? 'IA'}
        </div>
        <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {message.content}
        </div>
      </div>
    </div>
  );
}

