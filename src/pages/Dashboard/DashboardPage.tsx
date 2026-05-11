import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CharacterState } from '../../types';
import { sanitizeCharacter } from '../../utils/characterUtils';
import { handleFirestoreError, OperationType } from '../../utils/errorUtils';

export interface DashboardPageProps {
  userId: string;
  onSelectChar: (id: string) => void;
  onCreateChar: () => void;
  onBack?: () => void;
  onLogout: () => void;
  id?: string;
}

export function DashboardPage({ 
  userId, 
  onSelectChar, 
  onCreateChar, 
  onBack,
  onLogout,
  id
}: DashboardPageProps) {
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [loading, setLoading] = useState(true);
  const [charToDelete, setCharToDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'characters'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars: CharacterState[] = [];
      snapshot.forEach((docSnap) => {
        chars.push(sanitizeCharacter(docSnap.data(), docSnap.id));
      });
      setCharacters(chars);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleDeleteChar = async () => {
    if (!charToDelete || confirmDelete !== 'CONFIRMAR') return;
    try {
      await deleteDoc(doc(db, 'characters', charToDelete));
      setCharacters(prev => prev.filter(c => c.id !== charToDelete));
      setCharToDelete(null);
      setConfirmDelete('');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `characters/${charToDelete}`);
    }
  };

  return (
    <div id={id} className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack} 
                className="flex items-center gap-2 text-zinc-600 hover:text-white transition-colors text-[9px] uppercase font-black tracking-widest"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
            )}
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Suas Fichas</h1>
              <div className="flex items-center gap-4">
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] ml-1">ID: {userId}</p>
                <span className="text-xs bg-amber-500 text-black px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                  {characters.length}/5 Fichas
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <button 
            onClick={onCreateChar}
            disabled={characters.length >= 5}
            className={`group h-32 border-2 border-dashed rounded-3xl flex items-center p-8 gap-6 transition-all ${characters.length >= 5 ? 'bg-zinc-950 border-zinc-900 cursor-not-allowed text-zinc-800' : 'bg-zinc-900/30 border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-zinc-600 hover:text-amber-500'}`}
          >
            <div className="w-12 h-12 rounded-2xl border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
              {characters.length >= 5 ? <AlertTriangle size={24} /> : <Plus size={24} />}
            </div>
            <div className="text-left">
              <span className="text-sm font-black uppercase tracking-widest block">
                {characters.length >= 5 ? 'Limite Atingido' : 'Nova Ficha'}
              </span>
              <span className="text-[10px] font-mono tracking-widest opacity-50 block">
                {characters.length}/5 FICHAS
              </span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-zinc-900/30 border border-zinc-800 animate-pulse rounded-3xl overflow-hidden" />
            ))
          ) : (
            characters.map((char) => (
              <motion.div
                key={char.id}
                layoutId={char.id}
                className="group relative aspect-[4/5] bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-left space-y-6 hover:border-zinc-500 transition-all shadow-2xl overflow-hidden"
              >
                <div 
                  onClick={() => onSelectChar(char.id)}
                  className="absolute inset-0 z-0 cursor-pointer"
                />
                
                <div className="space-y-2 relative z-10 pointer-events-none">
                  <span className="inline-block px-2 py-1 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded border border-amber-500/20">
                    Nível {char.level}
                  </span>
                  <h3 className="text-2xl font-black text-white group-hover:text-amber-400 transition-colors leading-tight">{char.name}</h3>
                </div>

                <div className="flex flex-col gap-1 relative z-10 pointer-events-none">
                   <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                     <span className="w-1 h-1 rounded-full bg-zinc-700" />
                     {char.class}
                   </div>
                   <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                     <span className="w-1 h-1 rounded-full bg-zinc-700" />
                     {char.ancestry}
                   </div>
                </div>

                <div className="pt-4 flex justify-between items-center relative z-10">
                   <button 
                     onClick={() => onSelectChar(char.id)}
                     className="bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all active:scale-95"
                   >
                     Abrir
                   </button>
                   <button 
                     onClick={() => setCharToDelete(char.id)}
                     className="p-2 text-zinc-700 hover:text-rose-500 transition-colors"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {charToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <Trash2 className="text-rose-500 mx-auto" size={32} />
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Deletar Ficha?</h2>
                <p className="text-zinc-500 text-xs">Esta operação é irreversível. Todas as magias, virtudes e itens serão perdidos.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Digite CONFIRMAR para deletar</label>
                  <input 
                    type="text" 
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center font-bold text-white outline-none focus:border-rose-500/50 transition-all"
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setCharToDelete(null); setConfirmDelete(''); }}
                    className="flex-1 px-4 py-4 rounded-xl border border-zinc-800 text-zinc-500 font-black uppercase text-xs tracking-widest hover:bg-zinc-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={confirmDelete !== 'CONFIRMAR'}
                    onClick={handleDeleteChar}
                    className="flex-1 px-4 py-4 rounded-xl bg-rose-600 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all"
                  >
                    Deletar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
