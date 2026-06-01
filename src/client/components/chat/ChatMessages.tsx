import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { EmptyState } from './EmptyState';
import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import { useChatScroll } from './hooks/useChatScroll';

interface ChatMessagesProps {
  onRewind: (message: any) => void;
}

export function ChatMessages({ onRewind }: ChatMessagesProps) {
  const { sessions, activeSessionId, isStreaming, selectedModel, streamContent } = useChatStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const currentModel = AI_MODELS[selectedModel];

  // Auto scroll hook
  const messagesEndRef = useChatScroll([messages.length, streamContent]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '100px' }}>
      {messages.length === 0 && !isStreaming ? (
        <EmptyState model={currentModel} />
      ) : (
        <div className="flex flex-col gap-6 px-4 py-6">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLast={i === messages.length - 1}
              onRewind={onRewind}
            />
          ))}
          {isStreaming && <StreamingBubble />}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
