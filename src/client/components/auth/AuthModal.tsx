import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background: '#11111b',
      }}
    >
      {/* Animated gradient orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px] animate-float"
        style={{ background: 'rgba(137, 180, 250, 0.12)' }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[100px] animate-float"
        style={{ background: 'rgba(203, 166, 247, 0.10)', animationDelay: '1.5s' }}
      />
      <div
        className="absolute top-[40%] left-[60%] h-[300px] w-[300px] rounded-full blur-[80px] animate-float"
        style={{ background: 'rgba(245, 194, 231, 0.06)', animationDelay: '3s' }}
      />

      <div className="glass-modal relative w-[400px] max-w-[90vw] rounded-3xl p-10 animate-scale-in">
        {/* Gradient top border */}
        <div
          className="absolute top-0 left-6 right-6 h-[2px] rounded-full"
          style={{
            background: 'linear-gradient(90deg, #89b4fa, #cba6f7, #f5c2e7)',
            boxShadow: '0 0 20px rgba(137, 180, 250, 0.4)',
          }}
        />

        {/* Logo */}
        <div className="mb-10 text-center">
          <div
            className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl animate-gradient"
            style={{
              background: 'linear-gradient(135deg, #89b4fa, #cba6f7, #f5c2e7, #89b4fa)',
              backgroundSize: '200% 200%',
              boxShadow: '0 12px 40px rgba(137, 180, 250, 0.35)',
            }}
          >
            <Sparkles size={32} className="text-white" />
          </div>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #cdd6f4, #89b4fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            CodeAI Studio
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: '#a6adc8' }}>
            Inicia sesión para acceder
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#a6adc8' }}>
              Email
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => { setUser(e.target.value); setError(''); }}
              placeholder="tu@email.com"
              autoFocus
              className="w-full rounded-xl px-4 py-3.5 text-sm outline-none transition-all duration-200"
              style={{
                background: '#313244',
                border: '1px solid #45475a',
                color: '#cdd6f4',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#89b4fa'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(137,180,250,0.15)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#45475a'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#a6adc8' }}>
              Contraseña
            </label>
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3.5 transition-all duration-200"
              style={{
                background: '#313244',
                border: '1px solid #45475a',
              }}
            >
              <Lock size={14} style={{ color: '#585b70' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#cdd6f4' }}
              />
            </div>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-center text-xs font-medium"
              style={{ background: 'rgba(243, 139, 168, 0.1)', color: '#f38ba8', border: '1px solid rgba(243, 139, 168, 0.2)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all duration-200 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
              color: '#11111b',
              boxShadow: '0 4px 20px rgba(137, 180, 250, 0.3)',
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
