import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { User } from '../types';

interface FirebaseContextType {
  isReady: boolean;
  error: string | null;
}

const FirebaseContext = createContext<FirebaseContextType>({ isReady: false, error: null });

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, logout } = useAuthStore();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsReady((prev) => {
        if (!prev) {
          const domain = typeof window !== 'undefined' ? window.location.hostname : 'tu-app.run.app';
          setError(`La conexión está demorando. Asegúrate de:\n1. Habilitar Google Auth en Firebase.\n2. Crear Firestore Database.\n3. Agregar "${domain}" a "Dominios autorizados" en Firebase Console.`);
          return true;
        }
        return prev;
      });
    }, 15000);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      console.log("Auth state changed:", fbUser?.email);
      
      if (fbUser) {
        try {
          const userEmail = fbUser.email?.toLowerCase().trim() || '';
          const isAdminEmail = userEmail === 'diegoalejandro.narvaezmeza95@gmail.com';
          let userData: User | null = null;
          const userDocRef = doc(db, 'users', fbUser.uid);

          // Force admin status for the specific user regardless of Firestore
          if (isAdminEmail) {
            console.log("Admin detected by email:", userEmail);
          }

          // Attempt to fetch profile with a shorter internal timeout to avoid hanging
          try {
            console.log("Intentando obtener perfil para:", fbUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              userData = userDoc.data() as User;
              console.log("Perfil encontrado por UID");
            } else if (fbUser.email) {
              console.log("Buscando por email...", fbUser.email);
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', userEmail));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const preCreatedDoc = querySnapshot.docs[0];
                userData = {
                  ...preCreatedDoc.data(),
                  id: fbUser.uid,
                  email: fbUser.email
                } as User;
                
                console.log("Vinculando perfil existente a nuevo UID...");
                await setDoc(userDocRef, {
                  ...userData,
                  updatedAt: new Date().toISOString()
                });

                if (preCreatedDoc.id !== fbUser.uid) {
                  try { await deleteDoc(preCreatedDoc.ref); } catch (e) {}
                }
              }
            }
          } catch (fsErr: any) {
            console.error("Firestore read error:", fsErr);
            // Don't block the login if Firestore fails for an admin
            if (!isAdminEmail) {
              setError(`Error de base de datos: ${fsErr.message || "Permiso denegado"}. Verifica las reglas de Firestore.`);
            }
          }
          
          if (userData) {
            if (isAdminEmail) {
              userData.role = 'ADMIN';
              try { await updateDoc(userDocRef, { role: 'ADMIN' } as any); } catch (e) {}
            }
            try {
              const token = await fbUser.getIdToken();
              login(userData, token);
            } catch (authErr) {
              console.error("Token error:", authErr);
              login(userData, ''); 
            }
          } else {
            console.log("No se encontró perfil, creando uno nuevo...");
            const newUser: User = {
              id: fbUser.uid,
              username: fbUser.email?.split('@')[0] || 'user',
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario',
              email: fbUser.email || '',
              role: isAdminEmail ? 'ADMIN' : 'TECHNICIAN',
              status: 'ACTIVE'
            };
            
            try {
              await setDoc(userDocRef, {
                ...newUser,
                createdAt: new Date().toISOString()
              });
              console.log("Nuevo perfil creado con éxito");
            } catch (e: any) {
              console.error("No se pudo crear perfil inicial en Firestore:", e);
              // IF ADMIN, we MUST let them in even if database write fails
              if (!isAdminEmail) {
                setError(`No se pudo crear tu perfil: ${e.message || "Permisos insuficientes"}`);
              }
            }
            
            try {
              const token = await fbUser.getIdToken();
              login(newUser, token);
            } catch (e) {
              login(newUser, '');
            }
          }
        } catch (err: any) {
          console.error("Error crítico en autenticación:", err);
          setError(`Error de autenticación: ${err.message}`);
        }
      } else {
        logout();
      }
      
      clearTimeout(timeoutId);
      setIsReady(true);
    }, (authErr: any) => {
      clearTimeout(timeoutId);
      console.error("Error en observador Auth:", authErr);
      setError(`Error de Firebase: ${authErr.message || "No se pudo conectar"}`);
      setIsReady(true);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [login, logout]);

  return (
    <FirebaseContext.Provider value={{ isReady, error }}>
      {!isReady ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-6 max-w-sm text-center px-6">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="space-y-2">
              <p className="text-slate-900 font-bold">Iniciando Pure Backbone</p>
              <p className="text-slate-500 text-sm">Validando sesión...</p>
            </div>
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-red-800 text-sm font-medium whitespace-pre-line">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-3 text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        children
      )}
    </FirebaseContext.Provider>
  );
};