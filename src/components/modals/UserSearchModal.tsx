import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Search, Plus } from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';

export interface UserSearchModalProps {
  onSelect: (userId: string) => void;
  onClose: () => void;
  existingIds?: string[];
  title?: string;
  description?: string;
  id?: string;
}

export function UserSearchModal({ 
  onSelect, 
  onClose,
  existingIds = [],
  title = "Adicionar Jogador",
  description = "Pesquise por ID ou Nome",
  id
}: UserSearchModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserProfile[] = [];
        snap.forEach(d => list.push(d.data() as UserProfile));
        setUsers(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filtered = users.filter(u => 
    u.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
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
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{title}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{description}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text"
              autoFocus
              placeholder="Buscar por ID ou Nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 transition-all font-bold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <p className="text-center text-zinc-600 italic py-8">Carregando usuários...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-zinc-600 italic py-8">Nenhum usuário encontrado.</p>
          ) : (
            filtered.map(u => {
              const isAdded = existingIds.includes(u.id);
              return (
                <div 
                  key={u.id}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isAdded ? 'bg-amber-500/5 border-amber-500/20' : 'bg-zinc-950 border-zinc-800'}`}
                >
                  <div>
                    <div className="text-sm font-bold text-white uppercase italic">{u.nickname || 'Inominado'}</div>
                    <div className="text-[10px] font-mono text-zinc-600 font-bold">ID: {u.id}</div>
                  </div>
                  {isAdded ? (
                    <button 
                      onClick={() => onSelect(u.id)}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-[9px] font-black uppercase text-rose-500 transition-all active:scale-95"
                    >
                      Remover
                    </button>
                  ) : (
                    <button 
                      onClick={() => onSelect(u.id)}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-500/50 transition-all active:scale-95"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
