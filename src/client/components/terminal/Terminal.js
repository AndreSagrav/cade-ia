import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
import { TerminalIcon, X, Plus, ChevronRight } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { useEditorStore } from '@/store/editor-store';
export function Terminal() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState([
        '$ Bienvenido a CodeAI Studio Terminal',
        '$ Terminal lista. Escribe comandos...',
    ]);
    const [, setHistory] = useState([]);
    const inputRef = useRef(null);
    const { toggleTerminal } = useSettingsStore();
    const rootPath = useEditorStore((s) => s.rootPath);
    const sessionIdRef = useRef(null);
    const wapi = (typeof window !== 'undefined' ? window.api : null);
    const useIpc = !!(wapi && wapi.terminal && wapi.terminal.start);
    // Start persistent terminal session via IPC
    useEffect(() => {
        if (!useIpc || !rootPath)
            return;
        let mounted = true;
        let cleanupData = null;
        let cleanupExit = null;
        (async () => {
            try {
                const res = await wapi.terminal.start(rootPath, 'powershell.exe');
                if (!mounted)
                    return;
                if (res.error) {
                    setOutput((o) => [...o, `[ERROR] ${res.error}`]);
                    return;
                }
                sessionIdRef.current = res.sessionId;
                cleanupData = wapi.terminal.onData(res.sessionId, (data) => {
                    setOutput((o) => [...o, data]);
                });
                cleanupExit = wapi.terminal.onExit(res.sessionId, (code) => {
                    setOutput((o) => [...o, `$ Proceso terminado (código: ${code ?? '?'})`]);
                    sessionIdRef.current = null;
                });
            }
            catch (e) {
                if (mounted)
                    setOutput((o) => [...o, `[ERROR] ${e.message || 'No se pudo iniciar terminal'}`]);
            }
        })();
        return () => {
            mounted = false;
            if (cleanupData)
                cleanupData();
            if (cleanupExit)
                cleanupExit();
            if (sessionIdRef.current) {
                try {
                    wapi.terminal.kill(sessionIdRef.current);
                }
                catch { }
                sessionIdRef.current = null;
            }
        };
    }, [rootPath, useIpc]);
    const handleRun = useCallback(async () => {
        if (!input.trim())
            return;
        const cmd = input.trim();
        setHistory((h) => [...h, cmd]);
        setOutput((o) => [...o, `$ ${cmd}`]);
        setInput('');
        if (useIpc && sessionIdRef.current) {
            try {
                await wapi.terminal.input(sessionIdRef.current, cmd + '\r\n');
            }
            catch (e) {
                setOutput((o) => [...o, `[ERROR] ${e.message || 'No se pudo enviar comando'}`]);
            }
            return;
        }
        // Fallback HTTP (dev only)
        try {
            const res = await fetch('/api/terminal/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cmd }),
            });
            const data = await res.json();
            if (data.stdout)
                setOutput((o) => [...o, data.stdout]);
            if (data.stderr)
                setOutput((o) => [...o, `[ERROR] ${data.stderr}`]);
        }
        catch (err) {
            setOutput((o) => [...o, `[ERROR] No se pudo ejecutar el comando`]);
        }
    }, [input, useIpc]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRun();
        }
    };
    return (_jsxs("div", { className: "flex h-full flex-col overflow-hidden", style: { background: '#11111b' }, children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2", style: { borderBottom: '1px solid hsl(var(--border-strong))' }, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TerminalIcon, { size: 12, style: { color: '#a6e3a1' } }), _jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.15em]", style: { color: '#a6e3a1' }, children: "Terminal" }), _jsx("span", { className: "rounded-md px-1.5 py-0.5 text-[9px] font-mono", style: { background: '#313244', color: '#585b70' }, children: "bash" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150", style: { color: '#585b70' }, onMouseEnter: (e) => { e.currentTarget.style.background = '#313244'; e.currentTarget.style.color = '#cdd6f4'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#585b70'; }, children: _jsx(Plus, { size: 12 }) }), _jsx("button", { onClick: toggleTerminal, className: "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150", style: { color: '#585b70' }, onMouseEnter: (e) => { e.currentTarget.style.background = '#313244'; e.currentTarget.style.color = '#cdd6f4'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#585b70'; }, children: _jsx(X, { size: 12 }) })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto scroll-fade p-4 font-mono text-[11.5px] leading-6", style: { color: '#cdd6f4' }, onClick: () => inputRef.current?.focus(), children: output.map((line, i) => (_jsx("div", { style: { color: line.startsWith('[ERROR]') ? '#f38ba8' : line.startsWith('$') ? '#a6e3a1' : '#cdd6f4' }, children: line }, i))) }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-2.5", style: { borderTop: '1px solid hsl(var(--border-strong))', background: '#181825' }, children: [_jsx(ChevronRight, { size: 12, style: { color: '#a6e3a1' } }), _jsx("input", { ref: inputRef, type: "text", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Escribe un comando...", className: "flex-1 bg-transparent font-mono text-xs outline-none", style: { color: '#cdd6f4' } })] })] }));
}
