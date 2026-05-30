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

  const rootPath = useEditorStore((s) => s.rootPath);
  const folderPickerOpen = useEditorStore((s) => s.folderPickerOpen);
  const setFolderPickerOpen = useEditorStore((s) => s.setFolderPickerOpen);
  const { handleRefreshTree, handleFolderSelected } = useProject();

  // Verify session on mount via Supabase
  useEffect(() => {
    import('./lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setAuthenticated(true);
          const keys = session.user.user_metadata?.codeai_keys;
          if (keys) {
            useSettingsStore.getState().hydrateFromCloud(keys);
          }
        }
        setAuthChecked(true);
      });

      // Listen for auth changes to sync state
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setAuthenticated(true);
          const keys = session.user.user_metadata?.codeai_keys;
          if (keys) {
            useSettingsStore.getState().hydrateFromCloud(keys);
          }
        } else if (event === 'SIGNED_OUT') {
          setAuthenticated(false);
        }
      });
    });
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

  // Auto-refresh file tree on mount if we have a persisted rootPath
  useEffect(() => {
    if (authenticated && rootPath) {
      handleRefreshTree();
    }
  }, [authenticated, rootPath, handleRefreshTree]);

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
      <FolderPickerDialog 
        open={folderPickerOpen} 
        onClose={() => setFolderPickerOpen(false)} 
        onSelect={handleFolderSelected} 
      />
    </>
  );
}
