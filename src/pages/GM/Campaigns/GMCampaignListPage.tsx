import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, User, Plus, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Campaign } from '../../../types';
import { generateAccessCode } from '../../../utils/characterUtils';
import { handleFirestoreError, OperationType } from '../../../utils/errorUtils';

export interface GMCampaignListPageProps {
  onSelectCampaign: (id: string) => void;
  onCreateCampaign: () => void;
  onBack: () => void;
  onLogout: () => void;
  id?: string;
}

export function GMCampaignListPage({ onSelectCampaign, onCreateCampaign, onBack, onLogout, id }: GMCampaignListPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [campToDelete, setCampToDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'campaigns'), where('gmId', '==', 'MESTRE'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const camps: Campaign[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Campaign;
        if (!data.accessCode) {
          const code = generateAccessCode();
          await updateDoc(docSnap.ref, { accessCode: code });
          camps.push({ ...data, accessCode: code });
        } else {
          camps.push(data);
        }
      }
      setCampaigns(camps);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'campaigns');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteCampaign = async () => {
    if (!campToDelete || confirmDelete !== 'CONFIRMAR') return;
    try {
      await deleteDoc(doc(db, 'campaigns', campToDelete));
      setCampaigns(prev => prev.filter(c => c.id !== campToDelete));
      
      // Detach character campaign IDs
      const q = query(collection(db, 'characters'), where('campaignId', '==', campToDelete));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, { campaignId: null });
      }
      setCampToDelete(null);
      setConfirmDelete('');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `campaigns/${campToDelete}`);
    }
  };

  return (
    <div id={id} className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Suas Campanhas</h1>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Portal do Mestre</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button 
            onClick={onCreateCampaign}
            className="group aspect-[4/5] bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-zinc-600 hover:text-amber-500"
          >
            <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={32} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Nova Campanha</span>
          </button>

          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-zinc-900/30 border border-zinc-800 animate-pulse rounded-3xl overflow-hidden" />
            ))
          ) : (
            campaigns.map((camp) => (
              <motion.div
                key={camp.id}
                layoutId={camp.id}
                className="group relative aspect-[4/5] bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-left space-y-6 hover:border-zinc-500 transition-all shadow-2xl overflow-hidden"
              >
                <div onClick={() => onSelectCampaign(camp.id)} className="absolute inset-0 z-0 cursor-pointer" />
                
                <div className="absolute top-0 right-0 p-8 text-zinc-800/10 group-hover:text-amber-500/5 transition-colors pointer-events-none">
                  <User size={120} strokeWidth={1} />
                </div>
                
                <div className="space-y-2 relative z-10 pointer-events-none">
                  <h3 className="text-2xl font-black text-white group-hover:text-amber-400 transition-colors leading-tight">{camp.name}</h3>
                  <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                    {camp.characterIds.length} Personagens
                  </div>
                </div>

                <div className="absolute bottom-6 left-8 right-8 flex justify-between items-center z-20">
                  <button 
                     onClick={(e) => { e.stopPropagation(); onSelectCampaign(camp.id); }}
                     className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-white transition-colors"
                  >
                    Gerenciar
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCampToDelete(camp.id); setConfirmDelete(''); }}
                    className="p-2 text-zinc-800 hover:text-rose-500 transition-colors"
                    title="Excluir Campanha"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {campToDelete === camp.id && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute inset-x-2 bottom-2 bg-zinc-950 border border-rose-900/50 rounded-2xl p-4 z-30 shadow-2xl space-y-3"
                    >
                      <p className="text-[8px] uppercase font-black text-rose-500 text-center tracking-tighter">Para excluir, digite "CONFIRMAR"</p>
                      <input 
                        type="text"
                        autoFocus
                        value={confirmDelete}
                        onChange={(e) => setConfirmDelete(e.target.value)}
                        placeholder="CONFIRMAR"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-center text-white font-black text-[10px] outline-none focus:border-rose-500/50 transition-all uppercase"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(); }}
                          disabled={confirmDelete !== 'CONFIRMAR'}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-20 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          DELETAR
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCampToDelete(null); }}
                          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          X
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
