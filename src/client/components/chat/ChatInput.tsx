import { Send, Plus, X, GitBranch, Mic } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { ModelSelector } from './ModelSelector';
import { ContextEstimate } from './ContextEstimate';
import { MentionPopup } from './MentionPopup';
import { MentionChip } from './MentionChip';
import { useChatInput } from './hooks/useChatInput';
import { useMentions } from './hooks/useMentions';

export function ChatInput() {
  const { isStreaming, abortAgent } = useChatStore();

  const {
    mentions,
    showPopup,
    setShowPopup,
    handleMentionSelect,
    handleMentionRemove,
    clearMentions,
    checkMention,
    resolveMentions,
    getSuggestions,
  } = useMentions();

  const {
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
  } = useChatInput({ resolveMentions, clearMentions });

  // Update checkMention when input text changes
  const onTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    checkMention(e.target.value, e.target.selectionStart);
  };

  // Check mention on click or cursor movement
  const onTextareaKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    checkMention(el.value, el.selectionStart);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-6">
      {/* ── Context Estimate row above input ── */}
      <ContextEstimate inputLength={input.length} />

      <div
        className="relative rounded-[22px] transition-all duration-200 focus-within:ring-1 focus-within:ring-accent/25"
        style={{
          background: '#151521',
          border: '1px solid hsl(var(--border-strong) / 0.85)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.02)',
        }}
      >
        {/* Floating @Mentions Autocomplete List */}
        {showPopup && (
          <MentionPopup
            suggestions={getSuggestions()}
            onSelect={(item) => {
              const cleanedText = handleMentionSelect(item, input);
              setInput(cleanedText);
              // Refocus textarea after selection
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            onClose={() => setShowPopup(false)}
          />
        )}

        {/* Selected Mentions Context Chips */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1.5 border-b border-white/5">
            {mentions.map((mention) => (
              <MentionChip
                key={mention.id}
                type={mention.type}
                label={mention.label}
                onRemove={() => handleMentionRemove(mention.id)}
              />
            ))}
          </div>
        )}

        {/* Attachments Thumbnails */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
            {attachments.map((att) => (
              <div key={att.id} className="relative h-14 w-14 rounded-xl overflow-hidden border border-border/80 group">
                <img src={att.content} alt={att.name} className="h-full w-full object-cover" />
                <button
                  onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                  className="absolute top-1 right-1 rounded-full p-1 bg-black/70 hover:bg-black/90 text-white transition-colors duration-150"
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={onTextareaChange}
          onKeyUp={onTextareaKeyUp}
          onKeyDown={(e) => handleKeyDown(e, showPopup)}
          onPaste={handlePaste}
          rows={1}
          placeholder="Escribe un mensaje, usa @ para referenciar archivos, pega imágenes..."
          className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 outline-none placeholder:text-zinc-500 font-sans"
          style={{
            color: 'hsl(var(--foreground))',
            fontSize: '13.5px',
            minHeight: '48px',
            maxHeight: '200px',
          }}
        />

        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-foreground transition-colors"
            title="Añadir archivos"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
          
          <div className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-foreground transition-all duration-150 cursor-pointer select-none">
            <GitBranch size={12} className="opacity-80" />
            <span>Worktree</span>
          </div>

          <ModelSelector compact />

          <div className="flex-1" />

          {isStreaming ? (
            <div className="flex items-center gap-2">
              {input.trim() && (
                <button
                  onClick={handleSend}
                  className="flex h-8 px-3.5 items-center justify-center gap-1.5 rounded-full text-[11px] font-bold transition-all duration-150 hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
                    color: '#11111b',
                    boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)'
                  }}
                  title="Enviar comentario / interrupción"
                >
                  <Send size={11} />
                  <span>Comentar</span>
                </button>
              )}
              <button
                onClick={abortAgent}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95 text-white"
                style={{
                  background: 'hsl(var(--destructive))',
                  boxShadow: '0 4px 12px rgba(243, 139, 168, 0.25)'
                }}
                title="Detener generación"
              >
                <div className="h-2.5 w-2.5 rounded-sm bg-current" />
              </button>
            </div>
          ) : input.trim() || attachments.length > 0 || mentions.length > 0 ? (
            <button
              onClick={handleSend}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
                color: '#11111b',
                boxShadow: '0 4px 12px rgba(137, 180, 250, 0.3)'
              }}
            >
              <Send size={13} className="ml-0.5" />
            </button>
          ) : (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-850 hover:text-foreground transition-all duration-150"
              style={{ background: '#1c1c2a' }}
            >
              <Mic size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
