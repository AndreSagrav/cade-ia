import { Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_MODELS } from '@shared/models';
import { parseAgentMessage } from './helpers';
import { MarkdownContent } from './MessageContent';
import { ToolCallCard } from './ToolCallCard';
import { DiffViewer } from './DiffViewer';
import { AvatarAI } from './AvatarAI';
import type { ChatMessage } from '@shared/types';

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
  onRewind: (message: ChatMessage) => void;
}

export function MessageBubble({ message, isLast, onRewind }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return <UserBubble message={message} onRewind={onRewind} />;
  }

  return <AssistantBubble message={message} isLast={isLast} />;
}

/* ── User message bubble ── */
function UserBubble({ message, onRewind }: { message: ChatMessage; onRewind: (msg: ChatMessage) => void }) {
  return (
    <div className="flex justify-end group">
      <div className="relative max-w-[85%]">
        <button
          onClick={() => onRewind(message)}
          className="absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full transition-all"
          style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
          title="Revertir proyecto hasta aquí (deshace todos los cambios de IA a partir de aquí)"
        >
          <Undo2 size={13} />
        </button>
        
        <div
          className="rounded-2xl rounded-br-sm px-4 py-2.5 text-[13px] leading-relaxed w-full"
          style={{
            background: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          }}
        >
          {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}
          {message.attachments?.map((att: any) => (
            <div key={att.id} className="mt-2 rounded-md overflow-hidden border border-[#333]">
              <img src={att.content} alt={att.name} className="max-w-full h-auto max-h-[300px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Assistant message bubble ── */
function AssistantBubble({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  const { prose, fileCount, runCount, files } = parseAgentMessage(message.content || '');
  const hasActions = fileCount + runCount > 0;
  const toolCalls = (message as any).toolCalls || [];
  const agentChanges = (message as any).agentChanges || [];

  return (
    <div className={cn('flex gap-3', isLast && 'animate-fade-in')}>
      <AvatarAI />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[11px] font-semibold mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {AI_MODELS[message.model ?? '']?.label ?? 'IA'}
        </div>
        {prose && (
          <MarkdownContent content={prose} />
        )}
        {hasActions && (
          <div
            className="mt-2 rounded-lg border px-3 py-2 text-[12px]"
            style={{
              background: 'hsl(48 96% 53% / 0.08)',
              borderColor: 'hsl(48 96% 53% / 0.3)',
              color: 'hsl(48 96% 53%)',
            }}
          >
            <div className="font-semibold">
              ⚡ {fileCount > 0 && `${fileCount} archivo${fileCount > 1 ? 's' : ''}`}
              {fileCount > 0 && runCount > 0 && ' · '}
              {runCount > 0 && `${runCount} comando${runCount > 1 ? 's' : ''}`}
              {' '}propuesto{(fileCount + runCount) > 1 ? 's' : ''}
            </div>
            {files.length > 0 && (
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] opacity-90">
                {files.map((f, i) => <li key={i}>↳ {f}</li>)}
              </ul>
            )}
            <div className="mt-1 text-[10px] opacity-70">
              Revisalos en el editor y aceptá/rechazá cada uno.
            </div>
          </div>
        )}

        {(toolCalls.length > 0 || agentChanges.length > 0) && (
          <div className="mt-4 space-y-3">
            <ToolCallCard toolCalls={toolCalls} />
            <DiffViewer changes={agentChanges} />
          </div>
        )}
      </div>
    </div>
  );
}
