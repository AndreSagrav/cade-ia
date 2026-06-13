import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Sparkles, Plus, X, History, MessageSquare, Trash2, Mic, GitBranch, Undo2, Loader2, VolumeX, Check, CloudUpload, Play, MoreVertical, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { cn } from '@/lib/utils';
import { streamChat } from '@/lib/ai-stream';
import { rewindToMessage } from '@/lib/agent';
export function ChatPanel() {
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [moreOpen, setMoreOpen] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const moreRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) {
                setMoreOpen(false);
            }
        };
        if (moreOpen)
            document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [moreOpen]);
    const { sessions, openSessionIds, activeSessionId, historyOpen, isStreaming, streamContent, agentStatus, selectedModel, agentMode, setAgentMode, addMessage, createSession, closeSession, reopenSession, deleteSession, setActiveSession, setHistoryOpen, abortAgent, silentMode, setSilentMode, autoApply, setAutoApply, autoRun, setAutoRun, autoSync, setAutoSync } = useChatStore();
    const openSessions = openSessionIds
        .map((id) => sessions.find((s) => s.id === id))
        .filter((s) => !!s);
    const closedSessions = sessions
        .filter((s) => !openSessionIds.includes(s.id))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const messages = activeSession?.messages ?? [];
    const currentModel = AI_MODELS[selectedModel];
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, streamContent]);
    const handleInputChange = useCallback((e) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, []);
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result;
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
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const handleSend = useCallback(async () => {
        if (!input.trim() && attachments.length === 0)
            return;
        if (isStreaming)
            return;
        const text = input.trim();
        const currentAttachments = [...attachments];
        setInput('');
        setAttachments([]);
        if (textareaRef.current)
            textareaRef.current.style.height = 'auto';
        if (!activeSessionId)
            createSession(text.slice(0, 40) || 'Imagen adjunta');
        addMessage({
            id: Date.now().toString(36),
            role: 'user',
            content: text,
            timestamp: Date.now(),
            attachments: currentAttachments.length > 0 ? currentAttachments : undefined
        });
        await streamChat(text);
    }, [input, attachments, isStreaming, activeSessionId, addMessage, createSession]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const lastUserMessage = (() => {
        const msgs = messages.filter(m => m.role === 'user');
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    })();
    const handleContinue = useCallback(async () => {
        if (isStreaming)
            return;
        const last = lastUserMessage;
        if (!last || !last.content?.trim())
            return;
        await streamChat(last.content);
    }, [isStreaming, lastUserMessage]);
    return (_jsxs("div", { className: "relative flex h-full flex-col", style: { background: 'hsl(var(--background))' }, children: [_jsxs("div", { className: "flex shrink-0 items-stretch", style: { borderBottom: '1px solid hsl(var(--border-strong))', background: 'hsl(240 21% 12%)' }, children: [_jsx("div", { className: "flex flex-1 items-stretch gap-px overflow-x-auto", children: openSessions.length === 0 ? (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground", children: [_jsx(Bot, { size: 13, style: { color: 'hsl(var(--accent))' } }), _jsx("span", { className: "font-semibold", style: { color: 'hsl(var(--foreground))' }, children: "Chat IA" })] })) : (openSessions.map((s) => (_jsxs("button", { onClick: () => setActiveSession(s.id), className: cn('group flex items-center gap-2 border-r px-3 py-2 text-[12px] transition-colors', s.id === activeSessionId
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground'), style: {
                                borderColor: 'hsl(var(--border))',
                                background: s.id === activeSessionId
                                    ? 'hsl(var(--background))'
                                    : 'hsl(var(--muted) / 0.3)',
                                borderBottom: s.id === activeSessionId
                                    ? '2px solid hsl(var(--accent))'
                                    : '2px solid transparent',
                            }, children: [_jsx("span", { className: "max-w-[110px] truncate", children: s.name }), _jsx("span", { onClick: (e) => { e.stopPropagation(); closeSession(s.id); }, className: "-mr-1 flex h-4 w-4 items-center justify-center rounded opacity-50 hover:bg-muted hover:opacity-100", title: "Cerrar", children: _jsx(X, { size: 10 }) })] }, s.id)))) }), _jsxs("div", { className: "flex items-center gap-0.5 px-1.5", children: [_jsx("button", { onClick: () => createSession(), className: "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", title: "Nueva conversaci\u00F3n", children: _jsx(Plus, { size: 14 }) }), _jsx("button", { onClick: () => setHistoryOpen(!historyOpen), className: cn('rounded-md p-1.5 transition-colors', historyOpen
                                    ? 'bg-accent/15 text-accent'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'), title: "Historial", children: _jsx(History, { size: 13 }) }), _jsx("button", { onClick: () => setSilentMode(!silentMode), className: cn('flex h-7 w-7 items-center justify-center rounded-md transition-all', silentMode ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'), title: "Silencio del chat", children: _jsx(VolumeX, { size: 14 }) }), _jsx("button", { onClick: () => setAutoApply(!autoApply), className: cn('flex h-7 w-7 items-center justify-center rounded-md transition-all', autoApply ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'), title: "Auto-aplicar cambios", children: _jsx(Check, { size: 14 }) }), _jsx("button", { onClick: () => setAutoSync(!autoSync), className: cn('flex h-7 w-7 items-center justify-center rounded-md transition-all', autoSync ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'), title: "Sync: auto git add/commit/push", children: _jsx(CloudUpload, { size: 14 }) }), _jsxs("div", { className: "relative", ref: moreRef, children: [_jsx("button", { onClick: () => setMoreOpen(!moreOpen), className: cn('flex h-7 w-7 items-center justify-center rounded-md transition-all', moreOpen ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'), title: "M\u00E1s opciones", children: _jsx(MoreVertical, { size: 14 }) }), moreOpen && (_jsx("div", { className: "absolute right-0 top-9 z-50 flex flex-col gap-0.5 rounded-lg border p-1 shadow-lg", style: { background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', minWidth: '148px' }, children: _jsxs("button", { onClick: () => { setAutoRun(!autoRun); setMoreOpen(false); }, className: cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors', autoRun ? 'text-warning' : 'text-muted-foreground hover:text-foreground'), style: { background: autoRun ? 'hsl(var(--warning) / 0.08)' : 'transparent' }, children: [_jsx(Play, { size: 12 }), "Autorun"] }) }))] }), _jsxs("button", { onClick: () => setAgentMode(!agentMode), className: cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all', agentMode ? 'text-warning' : 'text-muted-foreground hover:text-foreground'), style: {
                                    background: agentMode ? 'hsl(var(--warning) / 0.12)' : 'hsl(var(--muted) / 0.5)',
                                    border: agentMode ? '1px solid hsl(var(--warning) / 0.3)' : '1px solid transparent',
                                }, title: "Modo agente", children: [_jsx(Bot, { size: 11 }), " Agente"] })] })] }), historyOpen && (_jsxs("div", { className: "shrink-0 border-b max-h-[280px] overflow-y-auto", style: { background: 'hsl(var(--muted) / 0.2)', borderColor: 'hsl(var(--border))' }, children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground", children: [_jsxs("span", { children: ["Conversaciones cerradas (", closedSessions.length, ")"] }), _jsx("button", { onClick: () => setHistoryOpen(false), className: "rounded p-0.5 hover:bg-muted", children: _jsx(X, { size: 11 }) })] }), closedSessions.length === 0 ? (_jsx("div", { className: "px-3 pb-3 text-[11px] text-muted-foreground/70", children: "No hay conversaciones cerradas." })) : (_jsx("div", { className: "pb-2", children: closedSessions.map((s) => (_jsxs("div", { className: "group flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40", children: [_jsx(MessageSquare, { size: 11, className: "shrink-0 text-muted-foreground" }), _jsxs("button", { onClick: () => reopenSession(s.id), className: "flex flex-1 items-center gap-2 text-left text-[12px] text-foreground", title: "Reabrir", children: [_jsx("span", { className: "flex-1 truncate", children: s.name }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: new Date(s.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' }) })] }), _jsx("button", { onClick: () => {
                                        if (confirm(`¿Borrar "${s.name}" definitivamente?`))
                                            deleteSession(s.id);
                                    }, className: "opacity-0 transition-opacity group-hover:opacity-100 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive", title: "Borrar definitivamente", children: _jsx(Trash2, { size: 11 }) })] }, s.id))) }))] })), _jsx("div", { className: "flex-1 overflow-y-auto", style: { paddingBottom: '100px' }, children: messages.length === 0 && !isStreaming ? (_jsx(EmptyState, { model: currentModel })) : (_jsxs("div", { className: "flex flex-col gap-6 px-4 py-6", children: [messages.map((msg, i) => (_jsx(MessageBubble, { message: msg, isLast: i === messages.length - 1 }, msg.id))), isStreaming && (_jsxs("div", { className: "flex gap-3", children: [_jsx(AvatarAI, {}), _jsxs("div", { className: "flex-1 pt-0.5", children: [_jsx("div", { className: "text-[11px] font-semibold mb-2", style: { color: 'hsl(var(--muted-foreground))' }, children: currentModel?.label ?? 'IA' }), streamContent ? (_jsx("p", { className: "text-sm leading-relaxed whitespace-pre-wrap", style: { color: 'hsl(var(--foreground))' }, children: silentMode ? parseAgentMessage(streamContent).prose : streamContent })) : agentStatus ? (_jsxs("div", { className: "flex items-center gap-2 pt-1 pb-1", style: { color: 'hsl(var(--accent))' }, children: [_jsx(Loader2, { size: 14, className: "animate-spin" }), _jsx("span", { className: "text-[13px] font-medium animate-pulse", children: agentStatus })] })) : (_jsx("div", { className: "flex items-center gap-1.5 pt-1", children: [0, 1, 2].map(i => (_jsx("span", { className: "h-1.5 w-1.5 rounded-full animate-pulse", style: {
                                                    background: 'hsl(var(--accent))',
                                                    animationDelay: `${i * 0.15}s`,
                                                } }, i))) }))] })] })), _jsx("div", { ref: messagesEndRef })] })) }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 px-4 pb-6", children: _jsxs("div", { className: "rounded-[24px] transition-all", style: {
                        background: '#181825',
                        border: '1px solid hsl(var(--border-strong))',
                        boxShadow: '0 8px 40px hsl(240 21% 5% / 0.5), inset 0 1px 0 hsl(240 15% 100% / 0.04)',
                    }, children: [attachments.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2 px-4 pt-3 pb-1", children: attachments.map((att) => (_jsxs("div", { className: "relative h-14 w-14 rounded-md overflow-hidden border border-border", children: [_jsx("img", { src: att.content, alt: att.name, className: "h-full w-full object-cover" }), _jsx("button", { onClick: () => setAttachments(prev => prev.filter(a => a.id !== att.id)), className: "absolute -top-1 -right-1 rounded-full p-0.5 transition-colors duration-150", style: { background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }, children: _jsx(X, { size: 10 }) })] }, att.id))) })), _jsx("textarea", { ref: textareaRef, value: input, onChange: handleInputChange, onKeyDown: handleKeyDown, rows: 1, placeholder: "Ask anything, @ to mention, / for actions", className: "block w-full resize-none bg-transparent px-4 pt-4 pb-2 outline-none", style: {
                                color: 'hsl(var(--foreground))',
                                fontSize: '14px',
                                minHeight: '48px',
                                maxHeight: '200px',
                            } }), _jsxs("div", { className: "flex items-center gap-3 px-3 pb-3 pt-1", children: [_jsx("input", { type: "file", accept: "image/*", hidden: true, ref: fileInputRef, onChange: handleFileSelect }), _jsx("button", { onClick: () => fileInputRef.current?.click(), className: "btn-ghost h-8 w-8 rounded-full", title: "A\u00F1adir archivos", children: _jsx(Plus, { size: 18, strokeWidth: 2.5 }) }), _jsxs("div", { className: "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-surface-hover transition-colors duration-150 cursor-pointer", children: [_jsx(GitBranch, { size: 13 }), _jsx("span", { children: "Worktree" })] }), _jsx(ModelSelector, { compact: true }), _jsx("div", { className: "flex-1" }), isStreaming ? (_jsx("button", { onClick: abortAgent, className: "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95", style: { background: 'hsl(var(--destructive))', color: '#11111b', boxShadow: '0 4px 12px rgba(243, 139, 168, 0.3)' }, title: "Detener generaci\u00F3n", children: _jsx("div", { className: "h-3 w-3 rounded-sm bg-current" }) })) : input.trim() ? (_jsx("button", { onClick: handleSend, className: "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50", style: { background: 'linear-gradient(135deg, #89b4fa, #cba6f7)', color: '#11111b', boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)' }, children: _jsx(Send, { size: 15, className: "ml-0.5" }) })) : (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: handleContinue, disabled: !lastUserMessage, className: "rounded-full px-3 h-9 text-[12px] font-semibold transition-all duration-150 disabled:opacity-50 hover:scale-[1.02] active:scale-95", style: { background: 'hsl(var(--accent) / 0.18)', color: 'hsl(var(--accent))', border: '1px solid hsl(var(--accent) / 0.35)' }, title: "Reenviar el \u00FAltimo mensaje del usuario", children: "Continuar" }), _jsx("button", { className: "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground", style: { background: 'hsl(var(--muted))' }, children: _jsx(Mic, { size: 16 }) })] }))] })] }) })] }));
}
/* ── Empty state ── */
function EmptyState({ model }) {
    return (_jsxs("div", { className: "flex h-full flex-col items-center justify-center gap-4 px-8 text-center", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl", style: { background: 'hsl(var(--accent) / 0.1)', border: '1px solid hsl(var(--accent) / 0.2)' }, children: _jsx(Sparkles, { size: 26, style: { color: 'hsl(var(--accent))' } }) }), _jsxs("div", { children: [_jsx("p", { className: "text-[15px] font-semibold", style: { color: 'hsl(var(--foreground))' }, children: model?.label ?? 'CodeAI Studio' }), _jsxs("p", { className: "mt-1.5 text-[12px] leading-relaxed", style: { color: 'hsl(var(--muted-foreground))' }, children: ["Pregunta, analiza c\u00F3digo,", _jsx("br", {}), "genera archivos y m\u00E1s."] })] })] }));
}
/* ── Avatar AI ── */
function AvatarAI() {
    return (_jsx("div", { className: "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", style: { background: 'hsl(var(--accent) / 0.12)' }, children: _jsx(Bot, { size: 15, style: { color: 'hsl(var(--accent))' } }) }));
}
/** Strip agent action blocks and count them, so we show a summary instead of raw code */
function parseAgentMessage(content) {
    const files = [];
    let runCount = 0;
    const fileRe = /```(?:\w+)?\s*file:([^\n]+)\n[\s\S]*?```/g;
    const runRe = /```run\n[\s\S]*?```/g;
    let m;
    while ((m = fileRe.exec(content)) !== null)
        files.push(m[1].trim());
    while ((m = runRe.exec(content)) !== null)
        runCount++;
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
function ToolCallCard({ call }) {
    const iconMap = {
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
    return (_jsxs("div", { className: "my-2 rounded-lg border overflow-hidden", style: {
            borderColor: isDone ? `${meta.color}40` : 'hsl(var(--border))',
            background: `${meta.color}08`,
        }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2", children: [_jsx("span", { className: "text-[13px]", children: meta.icon }), _jsx("span", { className: "text-[12px] font-semibold", style: { color: meta.color }, children: call.name }), _jsx("span", { className: "ml-auto flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold", style: {
                            background: isDone ? `${meta.color}25` : 'hsl(var(--warning) / 0.2)',
                            color: isDone ? meta.color : 'hsl(var(--warning))',
                        }, children: isDone ? '✓' : '⋯' })] }), args && (_jsx("div", { className: "px-3 pb-2", children: _jsx("code", { className: "block rounded bg-muted/40 px-2 py-1 text-[10px] font-mono text-muted-foreground truncate", children: args }) })), isDone && call.result && (_jsx("div", { className: "border-t px-3 py-2 text-[11px] text-muted-foreground", style: { borderColor: 'hsl(var(--border) / 0.5)' }, children: _jsx("pre", { className: "whitespace-pre-wrap break-words font-mono text-[10px]", style: { maxHeight: '120px', overflow: 'auto' }, children: typeof call.result === 'string' ? call.result.slice(0, 300) : JSON.stringify(call.result, null, 2).slice(0, 300) }) }))] }));
}
/* ── Diff block (side-by-side) ── */
function computeLineDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result = [];
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
        if (i >= oldLines.length) {
            result.push({ oldLine: null, newLine: newLines[j], type: 'add' });
            j++;
        }
        else if (j >= newLines.length) {
            result.push({ oldLine: oldLines[i], newLine: null, type: 'remove' });
            i++;
        }
        else if (oldLines[i] === newLines[j]) {
            result.push({ oldLine: oldLines[i], newLine: newLines[j], type: 'same' });
            i++;
            j++;
        }
        else {
            // Simple heuristic: check next few lines for alignment
            const aheadOld = oldLines.slice(i + 1, i + 4).indexOf(newLines[j]);
            const aheadNew = newLines.slice(j + 1, j + 4).indexOf(oldLines[i]);
            if (aheadOld !== -1 && (aheadNew === -1 || aheadOld <= aheadNew)) {
                result.push({ oldLine: oldLines[i], newLine: null, type: 'remove' });
                i++;
            }
            else if (aheadNew !== -1) {
                result.push({ oldLine: null, newLine: newLines[j], type: 'add' });
                j++;
            }
            else {
                result.push({ oldLine: oldLines[i], newLine: newLines[j], type: 'same' });
                i++;
                j++;
            }
        }
    }
    return result;
}
function DiffBlock({ path, oldContent, newContent }) {
    const [open, setOpen] = useState(true);
    const diff = computeLineDiff(oldContent || '', newContent || '');
    return (_jsxs("div", { className: "my-2 rounded-lg border overflow-hidden", style: { borderColor: 'hsl(var(--border))' }, children: [_jsxs("button", { onClick: () => setOpen(!open), className: "flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-muted/20", style: { background: 'hsl(var(--muted) / 0.3)', borderBottom: open ? '1px solid hsl(var(--border) / 0.5)' : 'none' }, children: [_jsx("span", { className: "text-[10px] font-mono px-1.5 py-0.5 rounded", style: { background: '#1e1e2e', color: '#a6e3a1' }, children: path.split('/').pop() }), _jsx("span", { className: "text-muted-foreground font-mono text-[10px] truncate", children: path }), open ? _jsx(ChevronDown, { size: 12, className: "ml-auto" }) : _jsx(ChevronRight, { size: 12, className: "ml-auto" })] }), open && (_jsxs("div", { className: "grid grid-cols-2 text-[10px] font-mono", style: { background: '#11111b' }, children: [_jsx("div", { className: "px-2 py-1 border-r border-b", style: { borderColor: 'hsl(var(--border) / 0.3)', color: '#6c7086' }, children: "\u2014 old" }), _jsx("div", { className: "px-2 py-1 border-b", style: { borderColor: 'hsl(var(--border) / 0.3)', color: '#6c7086' }, children: "++ new" }), diff.map((row, idx) => (_jsxs(_Fragment, { children: [_jsx("div", { className: "px-2 py-0.5 border-r truncate", style: {
                                    borderColor: 'hsl(var(--border) / 0.15)',
                                    background: row.type === 'remove' ? '#3c1e1e40' : row.type === 'same' ? 'transparent' : '#1e1e2e20',
                                    color: row.type === 'remove' ? '#f38ba8' : row.type === 'same' ? '#6c7086' : '#1e1e2e40',
                                }, title: row.oldLine ?? '', children: row.oldLine ?? '' }, `o-${idx}`), _jsx("div", { className: "px-2 py-0.5 truncate", style: {
                                    background: row.type === 'add' ? '#1e3c1e40' : row.type === 'same' ? 'transparent' : '#1e1e2e20',
                                    color: row.type === 'add' ? '#a6e3a1' : row.type === 'same' ? '#6c7086' : '#1e1e2e40',
                                }, title: row.newLine ?? '', children: row.newLine ?? '' }, `n-${idx}`)] })))] }))] }));
}
/* ── Plan block (checklist) ── */
function parsePlanBlocks(content) {
    const plans = [];
    let prose = content;
    const regex = /<plan>([\s\S]*?)<\/plan>/gi;
    let match;
    let id = 0;
    while ((match = regex.exec(content)) !== null) {
        const raw = match[1].trim();
        const steps = raw.split('\n').map((s) => s.replace(/^\s*[-*\d.)\]]\s*/, '').trim()).filter(Boolean);
        plans.push({ id: id++, steps });
    }
    prose = prose.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
    return { prose, plans };
}
function PlanBlock({ steps }) {
    return (_jsxs("div", { className: "my-2 rounded-lg border overflow-hidden", style: { borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.15)' }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide", style: { background: 'hsl(var(--muted) / 0.3)', borderBottom: '1px solid hsl(var(--border) / 0.5)', color: '#6c7086' }, children: [_jsx("span", { style: { color: '#89b4fa' }, children: "#" }), _jsx("span", { children: "Plan de trabajo" })] }), _jsx("div", { className: "px-3 py-2 space-y-1", children: steps.map((step, i) => (_jsxs("div", { className: "flex items-start gap-2 text-[12px]", children: [_jsx("span", { className: "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] font-bold", style: { borderColor: 'hsl(var(--border))', color: '#a6e3a1' }, children: i + 1 }), _jsx("span", { style: { color: 'hsl(var(--foreground))' }, children: step })] }, i))) })] }));
}
/* ── Timeline block ── */
function parseTimelineBlocks(content) {
    const timelines = [];
    let prose = content;
    const regex = /<timeline>([\s\S]*?)<\/timeline>/gi;
    let match;
    let id = 0;
    while ((match = regex.exec(content)) !== null) {
        const raw = match[1].trim();
        const events = raw.split('\n').map((s) => s.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
        timelines.push({ id: id++, events });
    }
    prose = prose.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
    return { prose, timelines };
}
function TimelineBlock({ events }) {
    return (_jsxs("div", { className: "my-2 rounded-lg border overflow-hidden", style: { borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.1)' }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide", style: { background: 'hsl(var(--muted) / 0.25)', borderBottom: '1px solid hsl(var(--border) / 0.5)', color: '#6c7086' }, children: [_jsx("span", { style: { color: '#cba6f7' }, children: "\u29D6" }), _jsx("span", { children: "Timeline" })] }), _jsxs("div", { className: "relative px-3 py-2", children: [_jsx("div", { className: "absolute left-[22px] top-2 bottom-2 w-px", style: { background: 'hsl(var(--border))' } }), _jsx("div", { className: "space-y-2", children: events.map((event, i) => (_jsxs("div", { className: "flex items-start gap-2 text-[11px]", children: [_jsx("span", { className: "relative z-10 mt-0.5 flex h-2 w-2 shrink-0 rounded-full", style: { background: '#cba6f7' } }), _jsx("span", { style: { color: 'hsl(var(--muted-foreground))' }, children: event })] }, i))) })] })] }));
}
/* ── Follow-up chips ── */
function parseFollowUpBlocks(content) {
    const followups = [];
    let prose = content;
    const regex = /<followup>([\s\S]*?)<\/followup>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const raw = match[1].trim();
        followups.push(...raw.split('\n').map((s) => s.replace(/^\s*[-*\d.)\]]\s*/, '').trim()).filter(Boolean));
    }
    prose = prose.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
    return { prose, followups };
}
function FollowUpChips({ questions }) {
    if (!questions.length)
        return null;
    return (_jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: questions.map((q, i) => (_jsx("button", { onClick: () => {
                const chatStore = useChatStore.getState();
                chatStore.addMessage({
                    id: Date.now().toString(36),
                    role: 'user',
                    content: q,
                    timestamp: Date.now(),
                });
                streamChat(q);
            }, className: "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-95", style: {
                borderColor: 'hsl(var(--accent) / 0.35)',
                background: 'hsl(var(--accent) / 0.08)',
                color: 'hsl(var(--accent))',
            }, children: q }, i))) }));
}
/* ── Terminal block inline ── */
function TerminalBlock({ content }) {
    return (_jsxs("div", { className: "my-2 rounded-lg border overflow-hidden font-mono text-[11px] leading-relaxed", style: {
            borderColor: 'hsl(var(--border))',
            background: '#11111b',
        }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide", style: { background: '#1e1e2e', color: '#6c7086', borderBottom: '1px solid hsl(var(--border) / 0.5)' }, children: [_jsx("span", { style: { color: '#a6e3a1' }, children: "$" }), _jsx("span", { children: "Terminal" })] }), _jsx("div", { className: "px-3 py-2 whitespace-pre-wrap", style: { color: '#cdd6f4' }, children: content })] }));
}
/* ── Parse content into segments (text vs terminal blocks) ── */
function parseContentSegments(content) {
    const segments = [];
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
function parseThinkingBlocks(content) {
    const thinkings = [];
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
function ThinkingBlock({ content }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "my-3 rounded-lg border overflow-hidden", style: { borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.25)' }, children: [_jsxs("button", { onClick: () => setOpen(!open), className: "flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-muted/30", style: { color: 'hsl(var(--muted-foreground))' }, children: [_jsx(Brain, { size: 13, style: { color: 'hsl(var(--accent))' } }), _jsx("span", { className: "flex-1 text-left", children: "Pensamiento" }), open ? _jsx(ChevronDown, { size: 13 }) : _jsx(ChevronRight, { size: 13 })] }), open && (_jsx("div", { className: "px-3 pb-3 text-[12px] leading-relaxed whitespace-pre-wrap", style: { color: 'hsl(var(--muted-foreground))' }, children: content }))] }));
}
/* ── Message bubble ── */
function MessageBubble({ message, isLast }) {
    const isUser = message.role === 'user';
    if (isUser) {
        return (_jsx("div", { className: "flex justify-end group", children: _jsxs("div", { className: "relative max-w-[85%]", children: [_jsx("button", { onClick: async () => {
                            if (confirm('¿Revertir proyecto hasta este punto? Se desharán todos los cambios de la IA posteriores a este mensaje.')) {
                                await rewindToMessage(message.id);
                                if (message.content && message.content.trim()) {
                                    await streamChat(message.content);
                                }
                            }
                        }, className: "absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full transition-all", style: { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }, title: "Revertir proyecto hasta aqu\u00ED (deshace todos los cambios de IA a partir de aqu\u00ED)", children: _jsx(Undo2, { size: 13 }) }), _jsxs("div", { className: "rounded-2xl rounded-br-sm px-4 py-2.5 text-[13px] leading-relaxed w-full", style: {
                            background: 'hsl(var(--muted))',
                            border: '1px solid hsl(var(--border))',
                            color: 'hsl(var(--foreground))',
                        }, children: [_jsx("div", { className: "whitespace-pre-wrap", children: message.content }), message.attachments?.map((att) => (_jsx("div", { className: "mt-2 rounded-md overflow-hidden border border-[#333]", children: _jsx("img", { src: att.content, alt: att.name, className: "max-w-full h-auto max-h-[300px]" }) }, att.id)))] })] }) }));
    }
    const { prose: thinkingProse, thinkings } = parseThinkingBlocks(message.content || '');
    const { prose: planProse, plans } = parsePlanBlocks(thinkingProse);
    const { prose: timelineProse, timelines } = parseTimelineBlocks(planProse);
    const { prose: followupProse, followups } = parseFollowUpBlocks(timelineProse);
    const { prose, fileCount, runCount, files } = parseAgentMessage(followupProse);
    const { silentMode } = useChatStore();
    const hasActions = fileCount + runCount > 0;
    return (_jsxs("div", { className: cn('flex gap-3', isLast && 'animate-fade-in'), children: [_jsx(AvatarAI, {}), _jsxs("div", { className: "flex-1 min-w-0 pt-0.5", children: [_jsx("div", { className: "text-[11px] font-semibold mb-2", style: { color: 'hsl(var(--muted-foreground))' }, children: AI_MODELS[message.model ?? '']?.label ?? 'IA' }), thinkings.length > 0 && (_jsx("div", { className: "space-y-1", children: thinkings.map((t) => (_jsx(ThinkingBlock, { content: t.content }, t.id))) })), plans.length > 0 && (_jsx("div", { className: "space-y-1", children: plans.map((p) => (_jsx(PlanBlock, { steps: p.steps }, p.id))) })), timelines.length > 0 && (_jsx("div", { className: "space-y-1", children: timelines.map((tl) => (_jsx(TimelineBlock, { events: tl.events }, tl.id))) })), prose && (_jsx("div", { style: { color: 'hsl(var(--foreground))' }, children: parseContentSegments(prose).map((seg, i) => seg.type === 'terminal' ? (_jsx(TerminalBlock, { content: seg.content }, i)) : (_jsx("div", { className: "text-[13px] leading-relaxed whitespace-pre-wrap", children: seg.content }, i))) })), followups.length > 0 && _jsx(FollowUpChips, { questions: followups }), message.toolCalls && message.toolCalls.length > 0 && (_jsx("div", { className: "mt-1", children: message.toolCalls.map((tc) => (_jsx(ToolCallCard, { call: tc }, tc.id))) })), !silentMode && hasActions && !message.toolCalls && !message.agentChanges && (_jsxs("div", { className: "mt-2 rounded-lg border px-3 py-2 text-[12px]", style: {
                            background: 'hsl(48 96% 53% / 0.08)',
                            borderColor: 'hsl(48 96% 53% / 0.3)',
                            color: 'hsl(48 96% 53%)',
                        }, children: [_jsxs("div", { className: "font-semibold", children: ["\u26A1 ", fileCount > 0 && `${fileCount} archivo${fileCount > 1 ? 's' : ''}`, fileCount > 0 && runCount > 0 && ' · ', runCount > 0 && `${runCount} comando${runCount > 1 ? 's' : ''}`, ' ', "propuesto", (fileCount + runCount) > 1 ? 's' : ''] }), files.length > 0 && (_jsx("ul", { className: "mt-1 space-y-0.5 font-mono text-[11px] opacity-90", children: files.map((f, i) => _jsxs("li", { children: ["\u21B3 ", f] }, i)) })), _jsx("div", { className: "mt-1 text-[10px] opacity-70", children: "Revisalos en el editor y acept\u00E1/rechaz\u00E1 cada uno." })] })), message.agentChanges && message.agentChanges.length > 0 && (_jsx("div", { className: "mt-1", children: message.agentChanges.map((change, i) => (_jsx(DiffBlock, { path: change.path, oldContent: change.oldContent, newContent: change.newContent }, i))) }))] })] }));
}
