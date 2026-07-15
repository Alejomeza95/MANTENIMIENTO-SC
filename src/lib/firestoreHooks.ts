import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, addDoc } from 'firebase/firestore';

export function useFirestoreCollection<T>(collectionPath: string, _constraints: any[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const colRef = collection(db, collectionPath);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setData(docs);
      setLoading(false);
    }, (err) => {
      console.error('Error in useFirestoreCollection:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionPath]);

  return { data, loading, error };
}

export async function addFirestoreDoc(collectionPath: string, data: any) {
  const colRef = collection(db, collectionPath);
  const newDoc = { 
    ...data, 
    createdAt: new Date().toISOString()
  };
  const docRef = await addDoc(colRef, newDoc);
  return docRef.id;
}

export async function updateFirestoreDoc(collectionPath: string, docId: string, data: any) {
  const docRef = doc(db, collectionPath, docId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteFirestoreDoc(collectionPath: string, docId: string) {
  const docRef = doc(db, collectionPath, docId);
  await deleteDoc(docRef);
}

