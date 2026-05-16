import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { LogIn, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Logo } from '../../components/Logo';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // FirebaseProvider will handle the state update
    } catch (err: any) {
      console.error("Login error:", err);
      setError('Error al iniciar sesión con Google. Intente nuevamente.');
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

          <div className="space-y-6">
            <p className="text-center text-sm font-medium text-slate-600">
              Acceda al sistema de gestión de mantenimiento usando su cuenta institucional.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} />
                <span className="text-xs font-semibold">{error}</span>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className={cn(
                "w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-xl border-2 border-slate-200 shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3",
                isLoading && "opacity-70 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="animate-spin text-blue-600" size={18} />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Continuar con Google</span>
                </>
              )}
            </button>
          </div>

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
