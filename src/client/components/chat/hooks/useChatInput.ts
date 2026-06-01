import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import { streamChat } from '@/lib/ai-stream';
import { BASE_URL } from '@/lib/api';
import type { Attachment } from '@shared/types';

interface UseChatInputProps {
  resolveMentions?: () => Promise<string>;
  clearMentions?: () => void;
}

export function useChatInput({ resolveMentions, clearMentions }: UseChatInputProps = {}) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    activeSessionId,
    isStreaming,
    addMessage,
    createSession,
  } = useChatStore();

  // Listen for rewind event to populate text and attachments
  useEffect(() => {
    const handleRewindEvent = (e: any) => {
      const message = e.detail;
      const text = message.content || '';
      const atts: Attachment[] = (message.attachments || []).map((att: Attachment) => ({ ...att }));
      
      setInput(text);
      setAttachments(atts);
      
      if (textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = 'auto';
        el.value = text;
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
      }
    };
    window.addEventListener('codeai-chat-rewind', handleRewindEvent);
    return () => window.removeEventListener('codeai-chat-rewind', handleRewindEvent);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAttachments(prev => [...prev, {
        id: Date.now().toString(36),
        name: file.name,
        type: 'image',
        mime: file.type,
        content: base64,
        size: file.size,
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setAttachments(prev => [...prev, {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: file.name || `imagen-pegada-${Date.now()}.png`,
            type: 'image',
            mime: file.type,
            content: base64,
            size: file.size,
          }]);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() && attachments.length === 0) return;
    
    if (isStreaming) {
      if (!input.trim()) return;
      const text = input.trim();
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      
      addMessage({ 
        id: Date.now().toString(36), 
        role: 'user', 
        content: text, 
        timestamp: Date.now() 
      });
      
      try {
        await fetch(`${BASE_URL}/api/agent/interrupt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSessionId, message: text }),
        });
      } catch (err) {
        console.error('Error enviando comentario de interrupción:', err);
      }
      return;
    }

    const text = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    if (!activeSessionId) {
      createSession(text.slice(0, 40) || 'Imagen adjunta');
    }

    // Resolve mentions context if available
    let mentionedContext = '';
    if (resolveMentions) {
      mentionedContext = await resolveMentions();
    }
    if (clearMentions) {
      clearMentions();
    }

    addMessage({ 
      id: Date.now().toString(36), 
      role: 'user', 
      content: text, 
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    });
    
    await streamChat(text, mentionedContext);
  }, [input, attachments, isStreaming, activeSessionId, addMessage, createSession, resolveMentions, clearMentions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, isPopupOpen?: boolean) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isPopupOpen) {
        // Intercepted by mention list navigation
        return;
      }
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return {
    input,
    setInput,
    attachments,
    setAttachments,
    textareaRef,
    fileInputRef,
    handleInputChange,
    handleFileSelect,
    handlePaste,
    handleSend,
    handleKeyDown,
  };
}
