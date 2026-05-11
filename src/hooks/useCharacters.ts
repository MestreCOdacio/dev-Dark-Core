import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { CharacterState } from '../types';
import { sanitizeCharacter } from '../utils/characterUtils';

export function useUserCharacters(userId: string | null) {
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCharacters([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'characters'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: CharacterState[] = [];
      snap.forEach(d => list.push(sanitizeCharacter(d.data(), d.id)));
      setCharacters(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { characters, loading };
}

export function useCharacter(charId: string | null) {
  const [character, setCharacter] = useState<CharacterState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!charId) {
      setCharacter(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'characters', charId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCharacter(sanitizeCharacter(docSnap.data(), docSnap.id));
      } else {
        setCharacter(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [charId]);

  const updateCharacter = async (updates: Partial<CharacterState>) => {
    if (!charId) return;
    const docRef = doc(db, 'characters', charId);
    // Remove functions or private fields that can't be stored in Firestore if any
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    await updateDoc(docRef, cleanUpdates);
  };

  return { character, loading, updateCharacter };
}
