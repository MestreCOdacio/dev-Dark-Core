import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Search, Plus } from 'lucide-react';
import { getDocs, collection, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CharacterState, UserProfile } from '../../types';
import { sanitizeCharacter } from '../../utils/characterUtils';

export interface CharacterSearchModalProps {
  onSelect: (charId: string) => void;
  onClose: () => void;
  userIds: string[];
  id?: string;
}

export function CharacterSearchModal({ 
  onSelect, 
  onClose,
  userIds,
  id
}: CharacterSearchModalProps) {
  const [chars, setChars] = useState<CharacterState[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const list: CharacterState[] = [];
        if (userIds.length > 0) {
          const CHUNK_SIZE = 30; 
          for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
            const chunk = userIds.slice(i, i + CHUNK_SIZE);
            const q = query(
              collection(db, 'characters'), 
              where('userId', 'in', chunk)
            );
            const snap = await getDocs(q);
            snap.forEach(d => {
              const char = sanitizeCharacter(d.data(), d.id);
              if (!char.campaignId) {
                list.push(char);
              }
            });
          }
        } else {
          const q = query(collection(db, 'characters'));
          const snap = await getDocs(q);
          snap.forEach(d => {
            const char = sanitizeCharacter(d.data(), d.id);
            if (!char.campaignId) {
              list.push(char);
            }
          });
        }
        setChars(list);

        const uIds = Array.from(new Set(list.map(c => c.userId)));
        const nickMap: Record<string, string> = {};
        for (const uid of uIds) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            nickMap[uid] = (uSnap.data() as UserProfile).nickname || uid;
          } else {
            nickMap[uid] = uid;
          }
        }
        setNicknames(nickMap);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userIds]);

  const filtered = chars.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (nicknames[c.userId] || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id={id} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Adicionar Personagem</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Selecione uma ficha para participar</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text"
              autoFocus
              placeholder="Buscar personagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 transition-all font-bold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <p className="text-center text-zinc-600 italic py-8">Carregando fichas...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-zinc-600 italic py-8">Nenhuma ficha disponível encontrada.</p>
          ) : (
            filtered.map(c => (
              <button 
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between hover:border-amber-500/50 transition-all active:scale-[0.98] group"
              >
                <div className="text-left">
                  <div className="text-zinc-500 text-[8px] uppercase font-black tracking-tighter mb-1">
                    {nicknames[c.userId] || 'Carregando...'}
                  </div>
                  <div className="text-white font-black italic uppercase italic tracking-tighter group-hover:text-amber-500 transition-colors">
                    {c.name}
                  </div>
                  <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">
                    {c.ancestry} {c.class} • Nível {c.level}
                  </div>
                </div>
                <div className="bg-zinc-900 w-10 h-10 rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-700 group-hover:text-amber-500 group-hover:border-amber-500/50 transition-all">
                  <Plus size={18} />
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
