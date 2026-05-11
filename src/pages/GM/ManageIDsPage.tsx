import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Search, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile, Campaign } from '../../types';
import { handleFirestoreError, OperationType } from '../../utils/errorUtils';

export function ManageIDsPage({ onBack }: { onBack: () => void }) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchIDs = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      querySnapshot.forEach(doc => {
        list.push(doc.data() as UserProfile);
      });
      setProfiles(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIDs();
  }, []);

  const handleCreateID = async () => {
    setCreating(true);
    try {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let newId = '';
      let exists = true;
      while (exists) {
        newId = '';
        for (let i = 0; i < 6; i++) {
          newId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const check = await getDoc(doc(db, 'users', newId));
        exists = check.exists();
      }
      
      await setDoc(doc(db, 'users', newId), {
        id: newId,
        role: 'Jogador',
        createdAt: new Date().toISOString()
      });
      setNewlyCreatedId(newId);
      await fetchIDs();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!idToDelete) return;
    if (deleteConfirmText !== 'CONFIRMAR') return;
    
    const profileId = idToDelete;
    setIdToDelete(null);
    setDeleteConfirmText('');
    setLoading(true);
    
    try {
      const qChars = query(collection(db, 'characters'), where('userId', '==', profileId));
      const charSnaps = await getDocs(qChars);
      for (const charDoc of charSnaps.docs) {
        await deleteDoc(charDoc.ref);
      }

      const qCamps = query(collection(db, 'campaigns'), where('playerIds', 'array-contains', profileId));
      const campSnaps = await getDocs(qCamps);
      for (const campDoc of campSnaps.docs) {
        const data = campDoc.data() as Campaign;
        await updateDoc(campDoc.ref, {
          playerIds: data.playerIds.filter(id => id !== profileId)
        });
      }

      await deleteDoc(doc(db, 'users', profileId));
      await fetchIDs();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Gerenciar ID's</h1>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Controle de Acesso</p>
            </div>
          </div>
          <button 
            onClick={handleCreateID}
            disabled={creating}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> {creating ? 'Criando...' : 'Novo ID'}
          </button>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <input 
            type="text"
            placeholder="Filtrar por nome ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all"
          />
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500">ID</th>
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500">Nome / Apelido</th>
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500">Papel</th>
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-zinc-600 italic">Carregando ID's...</td>
                  </tr>
                ) : profiles.filter(p => 
                  p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-zinc-600 italic">Nenhum ID encontrado.</td>
                  </tr>
                ) : profiles.filter(p => 
                  p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).map(profile => (
                  <tr key={profile.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-8 py-6 font-mono text-xl font-bold text-amber-500">{profile.id}</td>
                    <td className="px-8 py-6 text-zinc-400 font-bold">{profile.nickname || <span className="opacity-20 italic">Aguardando vínculo...</span>}</td>
                    <td className="px-8 py-6">
                      <button 
                        onClick={async () => {
                          const newRole = profile.role === 'Mestre' ? 'Jogador' : 'Mestre';
                          if (confirm(`Alterar papel de ${profile.nickname || profile.id} para ${newRole}?`)) {
                            try {
                              await updateDoc(doc(db, 'users', profile.id), { role: newRole });
                              await fetchIDs();
                            } catch (e) {
                              handleFirestoreError(e, OperationType.UPDATE, `users/${profile.id}`);
                            }
                          }
                        }}
                        className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all ${profile.role === 'Mestre' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                      >
                        {profile.role || 'Jogador'}
                      </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setIdToDelete(profile.id)}
                        className="p-3 text-zinc-600 hover:text-rose-500 transition-colors bg-zinc-950/50 rounded-xl hover:bg-rose-500/10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create ID Success Modal */}
        <AnimatePresence>
          {newlyCreatedId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Check className="text-amber-500" size={32} />
                </div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">ID Criado com Sucesso!</h2>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2">Novo ID de Jogador</p>
                  <p className="text-5xl font-mono font-black text-amber-500 tracking-tighter">{newlyCreatedId}</p>
                </div>
                <button 
                  onClick={() => setNewlyCreatedId(null)}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all"
                >
                  Entendido
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {idToDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-md w-full bg-zinc-900 border border-rose-500/30 p-8 rounded-3xl shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="text-rose-500" size={24} />
                  </div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Excluir ID {idToDelete}?</h2>
                  <p className="text-zinc-500 text-xs text-center">
                    Esta ação é irreversível. Todas as fichas e participações em campanhas vinculadas a este ID serão removidas permanentemente.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest text-center">Digite <span className="text-white">CONFIRMAR</span> para prosseguir</p>
                    <input 
                      type="text"
                      placeholder="CONFIRMAR"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center text-white outline-none focus:border-rose-500/50 transition-all font-bold tracking-widest"
                      autoFocus
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setIdToDelete(null); setDeleteConfirmText(''); }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black uppercase text-[10px] tracking-widest py-4 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      disabled={deleteConfirmText !== 'CONFIRMAR'}
                      onClick={handleExecuteDelete}
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white font-black uppercase text-[10px] tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-rose-900/20"
                    >
                      Excluir Agora
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
