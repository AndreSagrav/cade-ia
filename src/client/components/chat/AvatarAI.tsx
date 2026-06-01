import { Bot } from 'lucide-react';

export function AvatarAI() {
  return (
    <div
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{ background: 'hsl(var(--accent) / 0.12)' }}
    >
      <Bot size={15} style={{ color: 'hsl(var(--accent))' }} />
    </div>
  );
}
