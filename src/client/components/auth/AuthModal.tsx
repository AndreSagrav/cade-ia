import { useState } from 'react';
import { Lock } from 'lucide-react';

interface AuthGateProps {
  onUnlock: () => void;
}

export function AuthGate({ onUnlock }: AuthGateProps) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('codeai-auth', data.token);
        onUnlock();
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error de conexión con el servidor');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="w-[340px] max-w-[90vw] rounded-xl border border-border bg-surface p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dim text-white shadow-lg">
            <span className="text-xl font-bold font-mono">⟨/⟩</span>
          </div>
          <h2 className="text-lg font-bold text-foreground">CodeAI Studio</h2>
          <p className="mt-1 text-xs text-muted-foreground">Inicia sesión para acceder</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={user}
            onChange={(e) => { setUser(e.target.value); setError(''); }}
            placeholder="Usuario (email)"
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
            <Lock size={14} className="text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Contraseña"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dim disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
