import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Plus, Map, Users, BookOpen, ChevronRight } from 'lucide-react';
import { query, collection, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Campaign } from '../../types';
import { handleFirestoreError, OperationType } from '../../utils/errorUtils';
import { JoinCampaignModal } from '../../components/modals/JoinCampaignModal';

export interface PlayerCampaignListPageProps {
  userId: string;
  onSelectCampaign: (id: string) => void;
  onBack: () => void;
  id?: string;
}

export function PlayerCampaignListPage({ userId, onSelectCampaign, onBack, id }: PlayerCampaignListPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'campaigns'),
      where('playerIds', 'array-contains', userId)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Campaign[] = [];
      snap.forEach(d => list.push(d.data() as Campaign));
      setCampaigns(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    }, (e) => {
      handleFirestoreError(e, OperationType.LIST, 'campaigns');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return (
    <div id={id} className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-zinc-600 hover:text-white transition-colors text-[9px] uppercase font-black tracking-widest mb-1"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Minhas Campanhas</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Aventuras que você participa</p>
          </div>
          <button 
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} /> Entrar em uma Campanha
          </button>
        </header>

        <AnimatePresence>
          {isJoinModalOpen && (
            <JoinCampaignModal 
              userId={userId}
              onJoined={(id) => {
                setIsJoinModalOpen(false);
                onSelectCampaign(id);
              }}
              onClose={() => setIsJoinModalOpen(false)}
            />
          )}
        </AnimatePresence>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
             <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
             <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Buscando aventuras...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-20 border border-dashed border-zinc-800 rounded-[40px] flex flex-col items-center justify-center space-y-4 bg-zinc-900/10">
            <Map size={48} className="text-zinc-800" />
            <div className="text-center">
              <h3 className="text-xl font-black uppercase italic text-zinc-600">Nenhuma Campanha</h3>
              <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest mt-1">Peça o código ao seu Mestre para entrar</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map(camp => (
              <button 
                key={camp.id}
                onClick={() => onSelectCampaign(camp.id)}
                className="w-full text-left group bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 hover:border-amber-500/50 transition-all shadow-2xl relative overflow-hidden"
              >
                <div className="relative z-10 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white group-hover:text-amber-500 transition-colors">{camp.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Mestre:</span>
                       <span className="text-[9px] font-black uppercase text-amber-500/80 tracking-widest">{camp.gmId}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-zinc-600" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{camp.playerIds.length} Jogadores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-zinc-600" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{camp.characterIds.length} Fichas</span>
                    </div>
                  </div>
                </div>
                
                <ChevronRight className="absolute bottom-8 right-8 text-zinc-800 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" size={24} />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
