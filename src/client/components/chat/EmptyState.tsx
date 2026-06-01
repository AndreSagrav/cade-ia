import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  model: { label?: string } | null | undefined;
}

export function EmptyState({ model }: EmptyStateProps) {
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
