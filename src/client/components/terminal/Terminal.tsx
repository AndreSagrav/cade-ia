import { useState, useRef, useCallback } from 'react';
import { TerminalIcon, X, Plus } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import type { KeyboardEvent } from 'react';

export function Terminal() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([
    '$ Bienvenido a CodeAI Studio Terminal',
    '$ Escribe un comando para ejecutar...',
  ]);
  const [, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggleTerminal } = useSettingsStore();

  const handleRun = useCallback(async () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setHistory((h) => [...h, cmd]);
    setOutput((o) => [...o, `$ ${cmd}`]);
    setInput('');

    try {
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd }),
      });
      const data = await res.json();
      if (data.stdout) setOutput((o) => [...o, data.stdout]);
      if (data.stderr) setOutput((o) => [...o, `[ERROR] ${data.stderr}`]);
    } catch (err) {
      setOutput((o) => [...o, `[ERROR] No se pudo ejecutar el comando`]);
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border-t border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TerminalIcon size={11} />
          Terminal
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus size={11} />
          </button>
          <button
            onClick={toggleTerminal}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-5 text-foreground"
        onClick={() => inputRef.current?.focus()}
      >
        {output.map((line, i) => (
          <div key={i} className={line.startsWith('[ERROR]') ? 'text-destructive' : ''}>
            {line}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="font-mono text-xs text-accent">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un comando..."
          className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

