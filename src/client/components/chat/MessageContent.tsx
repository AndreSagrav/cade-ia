import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {}
  };
  return (
    <div className="relative group">
      <pre className="prose-pre:bg-surface-hover prose-pre:border prose-pre:border-border rounded-md overflow-x-auto">
        <code className={`language-${lang || ''}`}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/70 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        title="Copiar código"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

export const markdownComponents = {
  code({ inline, className, children, ...props }: any) {
    const code = String(children ?? '');
    const match = /language-(\w+)/.exec(className || '');
    if (inline) {
      return <code className={className} {...props}>{children}</code>;
    }
    return <CodeBlock code={code} lang={match?.[1]} />;
  },
} as const;

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={className || "text-[13px] leading-relaxed prose prose-invert max-w-none text-foreground prose-p:leading-relaxed prose-pre:bg-surface-hover prose-pre:border prose-pre:border-border"}
    >
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
}

export { CodeBlock };
