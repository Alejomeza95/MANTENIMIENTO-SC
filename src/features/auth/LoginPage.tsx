import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { LogIn, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Logo } from '../../components/Logo';
import { User } from '../../types';
import { useFirestoreCollection } from '../../lib/firestoreHooks';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const { data: users } = useFirestoreCollection<User>('users');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulamos un retraso de red
    await new Promise(resolve => setTimeout(resolve, 800));

    // Lógica de autenticación mejorada
    // 1. Buscamos en los usuarios registrados en Firestore
    const foundUser = users.find(u => 
      (u.username.toLowerCase() === username.toLowerCase() || u.email?.toLowerCase() === username.toLowerCase()) && 
      (u as any).password === password
    );

    if (foundUser) {
      if (foundUser.status === 'INACTIVE') {
        setError('Su cuenta está desactivada. Contacte al administrador.');
        setIsLoading(false);
        return;
      }
      login(foundUser, `mock-token-${foundUser.id}`);
      return;
    }

    // 2. Credenciales por defecto como fallback (para primer acceso admin)
    if (username === 'admin' && password === 'admin') {
      const user: User = {
        id: 'admin-1',
        username: 'admin',
        email: 'admin@scpro.com',
        name: 'Administrador',
        role: 'ADMIN',
        status: 'ACTIVE'
      };
      login(user, 'mock-token-admin');
    } else {
      setError('Credenciales incorrectas. Verifique su usuario y contraseña.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-100">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div className="p-10">
          <div className="flex flex-col items-center mb-10">
            <Logo variant="full" size={80} className="flex-col items-center gap-4" />
            <p className="text-slate-500 text-xs mt-2 uppercase tracking-[0.2em] font-black">Gestión Inteligente de Activos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Usuario</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <LogIn size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-slate-900"
                  placeholder="Nombre de usuario"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Contraseña</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <ShieldCheck size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} />
                <span className="text-xs font-semibold">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                isLoading && "opacity-70 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col items-center gap-6">
            <div className="text-center space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                Sistema de Gestión SC Pro
              </p>
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">
                Seguridad & Control
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
