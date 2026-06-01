import { useCallback } from 'react';
import { rewindToMessage } from '@/lib/agent';
import { ChatTabs } from './ChatTabs';
import { ChatHistory } from './ChatHistory';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

export function ChatPanel() {
  const handleRewind = useCallback(async (message: any) => {
    const ok = confirm('¿Revertir proyecto hasta este punto? Se desharán todos los cambios de la IA posteriores a este mensaje.');
    if (!ok) return;

    await rewindToMessage(message.id);

    // Dispatch the custom event so useChatInput hook receives it and populates text/attachments
    window.dispatchEvent(new CustomEvent('codeai-chat-rewind', { detail: message }));
  }, []);

  return (
    <div className="relative flex h-full flex-col font-sans" style={{ background: 'hsl(var(--background))' }}>
      <ChatTabs />
      <ChatHistory />
      <ChatMessages onRewind={handleRewind} />
      <ChatInput />
    </div>
  );
}
