import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          // Try to get user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            login(userData, await fbUser.getIdToken());
          } else {
            // First time login - default to Technician as requested in security spec
            // unless it's the admin email from additional metadata
            const isAdminEmail = fbUser.email === 'diegoalejandro.narvaezmeza95@gmail.com';
            const newUser: User = {
              id: fbUser.uid,
              username: fbUser.email?.split('@')[0] || 'user',
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario',
              role: isAdminEmail ? 'ADMIN' : 'TECHNICIAN',
              status: 'ACTIVE'
            };
            
            // For now, let's just initialize the profile if it doesn't exist
            // Using setDoc directly here
            await setDoc(doc(db, 'users', fbUser.uid), {
                ...newUser,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
            });
            
            login(newUser, await fbUser.getIdToken());
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setError("Error al cargar el perfil de usuario.");
        }
      } else {
        logout();
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, [login, logout]);

  return (
    <FirebaseContext.Provider value={{ isReady, error }}>
      {!isReady ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium font-sans">Iniciando base de datos...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </FirebaseContext.Provider>
  );
};
