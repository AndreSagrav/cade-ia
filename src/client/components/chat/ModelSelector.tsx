import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const { selectedModel, setSelectedModel } = useChatStore();
  const current = AI_MODELS[selectedModel];

  return (
    <div className="relative border-b border-border px-4 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            current?.tier === 'free' ? 'bg-success' : 'bg-warning',
          )} />
          <span className="text-foreground">{current?.label ?? 'Seleccionar modelo'}</span>
        </div>
        <ChevronDown size={12} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
          {Object.values(AI_MODELS).map((model) => (
            <button
              key={model.id}
              onClick={() => { setSelectedModel(model.id); setOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted',
                model.id === selectedModel && 'bg-accent/10 text-accent',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  model.tier === 'free' ? 'bg-success' : model.tier === 'premium' ? 'bg-destructive' : 'bg-warning',
                )} />
                <span>{model.label}</span>
              </div>
              <span className="text-[9px] text-muted-foreground">
                {model.tier === 'free' ? 'gratis' : `$${model.cost.input}/M`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
