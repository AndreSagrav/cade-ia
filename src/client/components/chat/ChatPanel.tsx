import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Sparkles, Plus, X, History, MessageSquare, Trash2, Mic, GitBranch, Undo2, Loader2, VolumeX, Check, CloudUpload, Play, MoreVertical, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { cn } from '@/lib/utils';
import { streamChat } from '@/lib/ai-stream';
import { rewindToMessage } from '@/lib/agent';
import type { Attachment } from '@shared/types';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  const {
    sessions, openSessionIds, activeSessionId, historyOpen,
    isStreaming, streamContent, agentStatus,
    selectedModel, agentMode, setAgentMode,
    addMessage, createSession, closeSession, reopenSession, deleteSession,
    setActiveSession, setHistoryOpen, abortAgent,
    silentMode, setSilentMode, autoApply, setAutoApply, autoRun, setAutoRun, autoSync, setAutoSync
  } = useChatStore();

  const openSessions = openSessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const closedSessions = sessions
    .filter((s) => !openSessionIds.includes(s.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const currentModel = AI_MODELS[selectedModel];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamContent]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isStreaming) return;
    const text = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (!activeSessionId) createSession(text.slice(0, 40) || 'Imagen adjunta');
    addMessage({ 
      id: Date.now().toString(36), 
      role: 'user', 
      content: text, 
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    });
    await streamChat(text);
  }, [input, attachments, isStreaming, activeSessionId, addMessage, createSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const lastUserMessage = (() => {
    const msgs = messages.filter(m => m.role === 'user');
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  })();

  const handleContinue = useCallback(async () => {
    if (isStreaming) return;
    const last = lastUserMessage;
    if (!last || !last.content?.trim()) return;
    await streamChat(last.content);
  }, [isStreaming, lastUserMessage]);

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'hsl(var(--background))' }}>

      {/* ── Tabs bar (open conversations) ── */}
      <div
        className="flex shrink-0 items-stretch"
        style={{ borderBottom: '1px solid hsl(var(--border-strong))', background: 'hsl(240 21% 12%)' }}
      >
        <div className="flex flex-1 items-stretch gap-px overflow-x-auto">
          {openSessions.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
              <Bot size={13} style={{ color: 'hsl(var(--accent))' }} />
              <span className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Chat IA</span>
            </div>
          ) : (
            openSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                className={cn(
                  'group flex items-center gap-2 border-r px-3 py-2 text-[12px] transition-colors',
                  s.id === activeSessionId
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                style={{
                  borderColor: 'hsl(var(--border))',
                  background: s.id === activeSessionId
                    ? 'hsl(var(--background))'
                    : 'hsl(var(--muted) / 0.3)',
                  borderBottom: s.id === activeSessionId
                    ? '2px solid hsl(var(--accent))'
                    : '2px solid transparent',
                }}
              >
                <span className="max-w-[110px] truncate">{s.name}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                  className="-mr-1 flex h-4 w-4 items-center justify-center rounded opacity-50 hover:bg-muted hover:opacity-100"
                  title="Cerrar"
                >
                  <X size={10} />
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-0.5 px-1.5">
          <button
            onClick={() => createSession()}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Nueva conversación"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              historyOpen
                ? 'bg-accent/15 text-accent'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            title="Historial"
          >
            <History size={13} />
          </button>
          {/* Icon toggles — premium minimal */}
          <button
            onClick={() => setSilentMode(!silentMode)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-all',
              silentMode ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            title="Silencio del chat"
          >
            <VolumeX size={14} />
          </button>
          <button
            onClick={() => setAutoApply(!autoApply)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-all',
              autoApply ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            title="Auto-aplicar cambios"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-all',
              autoSync ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            title="Sync: auto git add/commit/push"
          >
            <CloudUpload size={14} />
          </button>

          {/* More menu — secondary toggles */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                moreOpen ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              title="Más opciones"
            >
              <MoreVertical size={14} />
            </button>
            {moreOpen && (
              <div
                className="absolute right-0 top-9 z-50 flex flex-col gap-0.5 rounded-lg border p-1 shadow-lg"
                style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', minWidth: '148px' }}
              >
                <button
                  onClick={() => { setAutoRun(!autoRun); setMoreOpen(false); }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    autoRun ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
                  )}
                  style={{ background: autoRun ? 'hsl(var(--warning) / 0.08)' : 'transparent' }}
                >
                  <Play size={12} />
                  Autorun
                </button>
              </div>
            )}
          </div>

          {/* Primary mode toggle */}
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all',
              agentMode ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
            )}
            style={{
              background: agentMode ? 'hsl(var(--warning) / 0.12)' : 'hsl(var(--muted) / 0.5)',
              border: agentMode ? '1px solid hsl(var(--warning) / 0.3)' : '1px solid transparent',
            }}
            title="Modo agente"
          >
            <Bot size={11} /> Agente
          </button>
        </div>
      </div>

      {/* ── History drawer (closed conversations) ── */}
      {historyOpen && (
        <div
          className="shrink-0 border-b max-h-[280px] overflow-y-auto"
          style={{ background: 'hsl(var(--muted) / 0.2)', borderColor: 'hsl(var(--border))' }}
        >
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>Conversaciones cerradas ({closedSessions.length})</span>
            <button onClick={() => setHistoryOpen(false)} className="rounded p-0.5 hover:bg-muted">
              <X size={11} />
            </button>
          </div>
          {closedSessions.length === 0 ? (
            <div className="px-3 pb-3 text-[11px] text-muted-foreground/70">
              No hay conversaciones cerradas.
            </div>
          ) : (
            <div className="pb-2">
              {closedSessions.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40"
                >
                  <MessageSquare size={11} className="shrink-0 text-muted-foreground" />
                  <button
                    onClick={() => reopenSession(s.id)}
                    className="flex flex-1 items-center gap-2 text-left text-[12px] text-foreground"
                    title="Reabrir"
                  >
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Borrar "${s.name}" definitivamente?`)) deleteSession(s.id);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Borrar definitivamente"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Model selector moved inside the input bar ── */}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '100px' }}>
        {messages.length === 0 && !isStreaming ? (
          <EmptyState model={currentModel} />
        ) : (
          <div className="flex flex-col gap-6 px-4 py-6">
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} isLast={i === messages.length - 1} />
            ))}
            {isStreaming && (
              <div className="flex gap-3">
                <AvatarAI />
                <div className="flex-1 pt-0.5">
                  <div className="text-[11px] font-semibold mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {currentModel?.label ?? 'IA'}
                  </div>
                  {streamContent ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'hsl(var(--foreground))' }}>
                      {silentMode ? parseAgentMessage(streamContent).prose : streamContent}
                    </p>
                  ) : agentStatus ? (
                    <div className="flex items-center gap-2 pt-1 pb-1" style={{ color: 'hsl(var(--accent))' }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-[13px] font-medium animate-pulse">{agentStatus}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pt-1">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full animate-pulse"
                          style={{
                            background: 'hsl(var(--accent))',
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Floating input (Gemini Style) ── */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6">
        <div
          className="rounded-[24px] transition-all"
          style={{
            background: '#181825',
            border: '1px solid hsl(var(--border-strong))',
            boxShadow: '0 8px 40px hsl(240 21% 5% / 0.5), inset 0 1px 0 hsl(240 15% 100% / 0.04)',
          }}
        >
          {/* Thumbnails */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
              {attachments.map((att) => (
                <div key={att.id} className="relative h-14 w-14 rounded-md overflow-hidden border border-border">
                  <img src={att.content} alt={att.name} className="h-full w-full object-cover" />
                  <button 
                    onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                    className="absolute -top-1 -right-1 rounded-full p-0.5 transition-colors duration-150"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask anything, @ to mention, / for actions"
            className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 outline-none"
            style={{
              color: 'hsl(var(--foreground))',
              fontSize: '14px',
              minHeight: '48px',
              maxHeight: '200px',
            }}
          />
          <div className="flex items-center gap-3 px-3 pb-3 pt-1">
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileSelect} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost h-8 w-8 rounded-full"
              title="Añadir archivos"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-surface-hover transition-colors duration-150 cursor-pointer">
              <GitBranch size={13} />
              <span>Worktree</span>
            </div>
            
            <ModelSelector compact />
            
            <div className="flex-1" />
            
            {isStreaming ? (
              <button
                onClick={abortAgent}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
                style={{ background: 'hsl(var(--destructive))', color: '#11111b', boxShadow: '0 4px 12px rgba(243, 139, 168, 0.3)' }}
                title="Detener generación"
              >
                <div className="h-3 w-3 rounded-sm bg-current" />
              </button>
            ) : input.trim() ? (
              <button
                onClick={handleSend}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #89b4fa, #cba6f7)', color: '#11111b', boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)' }}
              >
                <Send size={15} className="ml-0.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleContinue}
                  disabled={!lastUserMessage}
                  className="rounded-full px-3 h-9 text-[12px] font-semibold transition-all duration-150 disabled:opacity-50 hover:scale-[1.02] active:scale-95"
                  style={{ background: 'hsl(var(--accent) / 0.18)', color: 'hsl(var(--accent))', border: '1px solid hsl(var(--accent) / 0.35)' }}
                  title="Reenviar el último mensaje del usuario"
                >
                  Continuar
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground" style={{ background: 'hsl(var(--muted))' }}>
                  <Mic size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ model }: { model: any }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'hsl(var(--accent) / 0.1)', border: '1px solid hsl(var(--accent) / 0.2)' }}
      >
        <Sparkles size={26} style={{ color: 'hsl(var(--accent))' }} />
      </div>
      <div>
        <p className="text-[15px] font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
          {model?.label ?? 'CodeAI Studio'}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Pregunta, analiza código,<br />genera archivos y más.
        </p>
      </div>
    </div>
  );
}

/* ── Avatar AI ── */
function AvatarAI() {
  return (
    <div
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{ background: 'hsl(var(--accent) / 0.12)' }}
    >
      <Bot size={15} style={{ color: 'hsl(var(--accent))' }} />
    </div>
  );
}

/** Strip agent action blocks and count them, so we show a summary instead of raw code */
function parseAgentMessage(content: string): { prose: string; fileCount: number; runCount: number; files: string[] } {
  const files: string[] = [];
  let runCount = 0;
  const fileRe = /```(?:\w+)?\s*file:([^\n]+)\n[\s\S]*?```/g;
  const runRe = /```run\n[\s\S]*?```/g;
  let m;
  while ((m = fileRe.exec(content)) !== null) files.push(m[1].trim());
  while ((m = runRe.exec(content)) !== null) runCount++;
  // Strip file/run actionable blocks
  let prose = content.replace(fileRe, '').replace(runRe, '');
  // Additionally strip JSON tool-call blocks like {"name":"read_file", ...}
  // Only remove if they look like tool calls; keep other JSON examples
  prose = prose.replace(/```json\n[\s\S]*?```/g, (block) => {
    const isTool = /"name"\s*:\s*"(read_file|write_file|list_files|search_files|run(?:_|\s)?command)"/i.test(block);
    return isTool ? '' : block;
  });
  // Also remove unfenced tool-call JSON (bare objects)
  prose = prose.replace(/\{[\s\S]*?"name"\s*:\s*"(read_file|write_file|list_files|search_files|run(?:_|\s)?command)"[\s\S]*?\}/gi, '');
  // Remove common trace lines that models sometimes print
  prose = prose
    .replace(/^[\s\t]*[\u{1F4D6}\u{270F}\u{1F4C1}\u{1F50D}\u26A1].*$/gmu, '') // 📖 ✏️ 📁 🔍 ⚡ lines
    .replace(/^\s*✅\s*Resultado recibido.*$/gmu, '')
    .replace(/^\s*📝\s*Archivo modificado:.*$/gmu, '')
    .replace(/^\s*Ejecutando\s*`.*`.*$/gmu, '');
  prose = prose.replace(/\n{3,}/g, '\n\n').trim();
  return { prose, fileCount: files.length, runCount, files };
}

/* ── Tool call card ── */
function ToolCallCard({ call }: { call: any }) {
  const iconMap: Record<string, any> = {
    read_file: { icon: '📖', color: '#89b4fa' },
    write_file: { icon: '✏️', color: '#a6e3a1' },
    list_files: { icon: '📁', color: '#f9e2af' },
    search_files: { icon: '🔍', color: '#cba6f7' },
    run_command: { icon: '⚡', color: '#fab387' },
    git_status: { icon: '🌿', color: '#a6e3a1' },
    git_commit_push: { icon: '🚀', color: '#89b4fa' },
  };
  const meta = iconMap[call.name] || { icon: '⚙️', color: '#6c7086' };
  const isDone = call.status === 'done';
  const args = call.args ? JSON.stringify(call.args).slice(0, 120) : '';

  return (
    <div
      className="my-2 rounded-lg border overflow-hidden"
      style={{
        borderColor: isDone ? `${meta.color}40` : 'hsl(var(--border))',
        background: `${meta.color}08`,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[13px]">{meta.icon}</span>
        <span className="text-[12px] font-semibold" style={{ color: meta.color }}>
          {call.name}
        </span>
        <span
          className="ml-auto flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
          style={{
            background: isDone ? `${meta.color}25` : 'hsl(var(--warning) / 0.2)',
            color: isDone ? meta.color : 'hsl(var(--warning))',
          }}
        >
          {isDone ? '✓' : '⋯'}
        </span>
      </div>
      {args && (
        <div className="px-3 pb-2">
          <code className="block rounded bg-muted/40 px-2 py-1 text-[10px] font-mono text-muted-foreground truncate">
            {args}
          </code>
        </div>
      )}
      {isDone && call.result && (
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground" style={{ borderColor: 'hsl(var(--border) / 0.5)' }}>
          <pre className="whitespace-pre-wrap break-words font-mono text-[10px]" style={{ maxHeight: '120px', overflow: 'auto' }}>
            {typeof call.result === 'string' ? call.result.slice(0, 300) : JSON.stringify(call.result, null, 2).slice(0, 300)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Terminal block inline ── */
function TerminalBlock({ content }: { content: string }) {
  return (
    <div
      className="my-2 rounded-lg border overflow-hidden font-mono text-[11px] leading-relaxed"
      style={{
        borderColor: 'hsl(var(--border))',
        background: '#11111b',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: '#1e1e2e', color: '#6c7086', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}
      >
        <span style={{ color: '#a6e3a1' }}>$</span>
        <span>Terminal</span>
      </div>
      <div className="px-3 py-2 whitespace-pre-wrap" style={{ color: '#cdd6f4' }}>
        {content}
      </div>
    </div>
  );
}

/* ── Parse content into segments (text vs terminal blocks) ── */
function parseContentSegments(content: string): { type: 'text' | 'terminal'; content: string }[] {
  const segments: { type: 'text' | 'terminal'; content: string }[] = [];
  const regex = /```terminal\n([\s\S]*?)\n```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'terminal', content: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }
  return segments;
}

/* ── Parse thinking blocks from content ── */
function parseThinkingBlocks(content: string): { prose: string; thinkings: { id: number; content: string }[] } {
  const thinkings: { id: number; content: string }[] = [];
  let prose = content;
  const regex = /<thinking>([\s\S]*?)<\/thinking>/gi;
  let match;
  let id = 0;
  while ((match = regex.exec(content)) !== null) {
    thinkings.push({ id: id++, content: match[1].trim() });
  }
  prose = prose.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
  return { prose, thinkings };
}

/* ── Thinking block (collapsible) ── */
function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="my-3 rounded-lg border overflow-hidden"
      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.25)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-muted/30"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        <Brain size={13} style={{ color: 'hsl(var(--accent))' }} />
        <span className="flex-1 text-left">Pensamiento</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className="px-3 pb-3 text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {content}
        </div>
      )}
    </div>
  );
}

/* ── Message bubble ── */
function MessageBubble({ message, isLast }: { message: any; isLast: boolean }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end group">
        <div className="relative max-w-[85%]">
          <button
            onClick={async () => {
              if (confirm('¿Revertir proyecto hasta este punto? Se desharán todos los cambios de la IA posteriores a este mensaje.')) {
                await rewindToMessage(message.id);
                if (message.content && message.content.trim()) {
                  await streamChat(message.content);
                }
              }
            }}
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
            <div className="whitespace-pre-wrap">{message.content}</div>
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

  const { prose: rawProse, thinkings } = parseThinkingBlocks(message.content || '');
  const { prose, fileCount, runCount, files } = parseAgentMessage(rawProse);
  const { silentMode } = useChatStore();
  const hasActions = fileCount + runCount > 0;

  return (
    <div className={cn('flex gap-3', isLast && 'animate-fade-in')}>
      <AvatarAI />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[11px] font-semibold mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {AI_MODELS[message.model ?? '']?.label ?? 'IA'}
        </div>
        {thinkings.length > 0 && (
          <div className="space-y-1">
            {thinkings.map((t) => (
              <ThinkingBlock key={t.id} content={t.content} />
            ))}
          </div>
        )}
        {prose && (
          <div style={{ color: 'hsl(var(--foreground))' }}>
            {parseContentSegments(prose).map((seg, i) =>
              seg.type === 'terminal' ? (
                <TerminalBlock key={i} content={seg.content} />
              ) : (
                <div
                  key={i}
                  className="text-[13px] leading-relaxed whitespace-pre-wrap"
                >
                  {seg.content}
                </div>
              )
            )}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1">
            {message.toolCalls.map((tc: any) => (
              <ToolCallCard key={tc.id} call={tc} />
            ))}
          </div>
        )}
        {!silentMode && hasActions && !message.toolCalls && (
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
      </div>
    </div>
  );
}
