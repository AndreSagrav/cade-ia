import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { SettingsModal } from './components/settings/SettingsModal';
import { AuthGate } from './components/auth/AuthModal';
import { useSettingsStore } from './store/settings-store';

export function App() {
  const theme = useSettingsStore((s) => s.theme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Verify saved token on mount
  useEffect(() => {
    const token = localStorage.getItem('codeai-auth');
    if (!token) { setAuthChecked(true); return; }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => { if (r.ok) setAuthenticated(true); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Global keyboard shortcut: Ctrl+,
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Verificando sesión...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onUnlock={() => setAuthenticated(true)} />;
  }

  return (
    <>
      <Layout onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
