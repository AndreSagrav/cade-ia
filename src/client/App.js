import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { SettingsModal } from './components/settings/SettingsModal';
import { AuthGate } from './components/auth/AuthModal';
import { FolderPickerDialog } from './components/layout/FolderPickerDialog';
import { useSettingsStore } from './store/settings-store';
import { useEditorStore } from './store/editor-store';
import { useProject } from './lib/use-project';
export function App() {
    const theme = useSettingsStore((s) => s.theme);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const apiBase = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:') ? '' : 'http://localhost:3001';
    const rootPath = useEditorStore((s) => s.rootPath);
    const folderPickerOpen = useEditorStore((s) => s.folderPickerOpen);
    const setFolderPickerOpen = useEditorStore((s) => s.setFolderPickerOpen);
    const { handleRefreshTree, handleFolderSelected } = useProject();
    // Verify saved token on mount
    useEffect(() => {
        const token = localStorage.getItem('codeai-auth');
        if (!token) {
            setAuthChecked(true);
            return;
        }
        const wapi = (typeof window !== 'undefined' ? window.api : null);
        if (wapi?.auth?.verify) {
            wapi.auth.verify(token)
                .then((res) => { if (res?.ok)
                setAuthenticated(true); })
                .catch(() => { })
                .finally(() => setAuthChecked(true));
        }
        else {
            fetch(`${apiBase}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
                .then((r) => { if (r.ok)
                setAuthenticated(true); })
                .catch(() => { })
                .finally(() => setAuthChecked(true));
        }
    }, []);
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(prefersDark ? 'dark' : 'light');
        }
        else {
            root.classList.add(theme);
        }
    }, [theme]);
    // Global keyboard shortcut: Ctrl+,
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                setSettingsOpen((v) => !v);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    // Auto-refresh file tree on mount if we have a persisted rootPath
    useEffect(() => {
        if (authenticated && rootPath) {
            handleRefreshTree();
        }
    }, [authenticated, rootPath, handleRefreshTree]);
    useEffect(() => {
        if (!authenticated)
            return;
        const looksAbsolute = rootPath ? /^(?:[a-zA-Z]:\\|\\\\|\/)/.test(rootPath) : false;
        if (!rootPath || !looksAbsolute) {
            setFolderPickerOpen(true);
        }
    }, [authenticated, rootPath, setFolderPickerOpen]);
    if (!authChecked) {
        return (_jsx("div", { className: "flex h-screen items-center justify-center bg-background", children: _jsx("div", { className: "text-sm text-muted-foreground", children: "Verificando sesi\u00F3n..." }) }));
    }
    if (!authenticated) {
        return _jsx(AuthGate, { onUnlock: () => setAuthenticated(true) });
    }
    return (_jsxs(_Fragment, { children: [_jsx(Layout, { onOpenSettings: () => setSettingsOpen(true) }), _jsx(SettingsModal, { open: settingsOpen, onClose: () => setSettingsOpen(false) }), _jsx(FolderPickerDialog, { open: folderPickerOpen, onClose: () => setFolderPickerOpen(false), onSelect: handleFolderSelected })] }));
}
