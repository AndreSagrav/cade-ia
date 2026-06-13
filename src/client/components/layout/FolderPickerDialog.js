import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Folder, HardDrive, ArrowUp, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
export function FolderPickerDialog({ open, onClose, onSelect }) {
    const [currentPath, setCurrentPath] = useState(null);
    const [parentPath, setParentPath] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pathInput, setPathInput] = useState('');
    const [error, setError] = useState(null);
    useEffect(() => {
        if (open) {
            const last = (typeof window !== 'undefined' ? window.localStorage.getItem('codeai-last-root') : null);
            if (last) {
                loadDirectory(last);
            }
            else {
                (async () => {
                    try {
                        const guess = await api.resolveFolder('PROYECTOS');
                        if (guess && guess.path && !guess.guessed) {
                            loadDirectory(guess.path);
                            return;
                        }
                    }
                    catch { }
                    loadDirectory(null);
                })();
            }
        }
        else {
            setCurrentPath(null);
            setItems([]);
        }
    }, [open]);
    const loadDirectory = async (path) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.listDirectories(path || undefined);
            if (res.ok) {
                setItems(res.items);
                setParentPath(res.parent);
                const curr = res.current || path || null;
                setCurrentPath(curr);
                setPathInput(curr || '');
            }
        }
        catch (err) {
            setError(err.message || 'Failed to load directory');
        }
        finally {
            setLoading(false);
        }
    };
    const handleSelect = () => {
        if (currentPath) {
            try {
                if (typeof window !== 'undefined')
                    window.localStorage.setItem('codeai-last-root', currentPath);
            }
            catch { }
            onSelect(currentPath);
            onClose();
        }
    };
    return (_jsx(Dialog.Root, { open: open, onOpenChange: (val) => !val && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "fixed inset-0 bg-background/80 backdrop-blur-sm z-50" }), _jsxs(Dialog.Content, { className: "fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-card border shadow-xl sm:rounded-xl z-50 flex flex-col max-h-[85vh]", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b", children: [_jsx(Dialog.Title, { className: "text-lg font-semibold", children: "Seleccionar Proyecto" }), _jsx(Dialog.Close, { className: "p-1 hover:bg-muted rounded-md", children: _jsx(X, { className: "w-5 h-5 text-muted-foreground" }) })] }), _jsxs("div", { className: "p-3 border-b flex items-center gap-2 bg-muted/30", children: [_jsx("button", { disabled: !parentPath || loading, onClick: () => loadDirectory(parentPath), className: "p-1.5 hover:bg-muted rounded-md disabled:opacity-50", title: "Subir de nivel", children: _jsx(ArrowUp, { className: "w-4 h-4" }) }), _jsx("input", { className: "text-sm flex-1 font-mono bg-background rounded border px-2 py-1 outline-none", placeholder: "Pega una ruta (p.ej. C:\\\\Users\\\\TuUsuario\\\\OneDrive\\\\Documentos\\\\PROYECTOS)", value: pathInput, onChange: (e) => setPathInput(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && pathInput && !loading)
                                        loadDirectory(pathInput); } }), _jsx("button", { className: "px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90", disabled: !pathInput || loading, onClick: () => loadDirectory(pathInput), children: "Ir" })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-2 min-h-[300px]", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) })) : error ? (_jsx("div", { className: "p-4 text-sm text-destructive text-center", children: error })) : items.length === 0 ? (_jsx("div", { className: "p-4 text-sm text-muted-foreground text-center", children: "Carpeta vac\u00EDa" })) : (_jsx("div", { className: "grid grid-cols-1 gap-1", children: items.map((item) => (_jsxs("button", { onClick: () => loadDirectory(item.path), className: "flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left transition-colors", children: [!currentPath ? (_jsx(HardDrive, { className: "w-5 h-5 text-blue-500" })) : (_jsx(Folder, { className: "w-5 h-5 text-yellow-500" })), _jsx("span", { className: "text-sm truncate select-none", children: item.name })] }, item.path))) })) }), _jsxs("div", { className: "p-4 border-t flex justify-end gap-2 bg-muted/20", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors", children: "Cancelar" }), _jsx("button", { onClick: handleSelect, disabled: !currentPath || loading, className: "px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50", children: "Abrir aqu\u00ED" })] })] })] }) }));
}
