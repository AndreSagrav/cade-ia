import { useRef, useEffect } from 'react';

export function useChatScroll(dependencyArray: any[]) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, dependencyArray);

  return messagesEndRef;
}
