import { useState, useRef, useCallback } from 'react';
import { TerminalIcon, X, Plus, ChevronRight } from 'lucide-react';
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
    <div className="flex h-full flex-col overflow-hidden" style={{ background: '#11111b' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid hsl(var(--border-strong))' }}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} style={{ color: '#a6e3a1' }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#a6e3a1' }}>
            Terminal
          </span>
          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-mono" style={{ background: '#313244', color: '#585b70' }}>
            bash
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150"
            style={{ color: '#585b70' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#313244'; e.currentTarget.style.color = '#cdd6f4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#585b70'; }}
          >
            <Plus size={12} />
          </button>
          <button
            onClick={toggleTerminal}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150"
            style={{ color: '#585b70' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#313244'; e.currentTarget.style.color = '#cdd6f4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#585b70'; }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        className="flex-1 overflow-y-auto scroll-fade p-4 font-mono text-[11.5px] leading-6"
        style={{ color: '#cdd6f4' }}
        onClick={() => inputRef.current?.focus()}
      >
        {output.map((line, i) => (
          <div
            key={i}
            style={{ color: line.startsWith('[ERROR]') ? '#f38ba8' : line.startsWith('$') ? '#a6e3a1' : '#cdd6f4' }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderTop: '1px solid hsl(var(--border-strong))', background: '#181825' }}
      >
        <ChevronRight size={12} style={{ color: '#a6e3a1' }} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un comando..."
          className="flex-1 bg-transparent font-mono text-xs outline-none"
          style={{ color: '#cdd6f4' }}
        />
      </div>
    </div>
  );
}
