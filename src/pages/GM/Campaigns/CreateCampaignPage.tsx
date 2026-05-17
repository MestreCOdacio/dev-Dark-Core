import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Campaign } from '../../../types';
import { generateAccessCode } from '../../../utils/characterUtils';
import { handleFirestoreError, OperationType } from '../../../utils/errorUtils';
import { UserSearchModal } from '../../../components/modals/UserSearchModal';
import { CharacterSearchModal } from '../../../components/modals/CharacterSearchModal';
import { useAuth } from '../../../contexts/AuthContext';

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState(false);
  const [isCharSearchOpen, setIsCharSearchOpen] = useState(false);

  const addPlayerId = (id: string) => {
    if (playerIds.includes(id)) {
      setPlayerIds(prev => prev.filter(p => p !== id));
      // Also remove characters of this player
      const q = query(collection(db, 'characters'), where('userId', '==', id));
      getDocs(q).then(snap => {
        const charIdsToRemove = snap.docs.map(d => d.id);
        setSelectedCharIds(prev => prev.filter(cid => !charIdsToRemove.includes(cid)));
      });
    } else {
      setPlayerIds(prev => [...prev, id]);
    }
  };

  const addCharacterId = (id: string) => {
    if (!selectedCharIds.includes(id)) {
      setSelectedCharIds(prev => [...prev, id]);
    }
    setIsCharSearchOpen(false);
  };

  const removePlayerId = (id: string) => {
    setPlayerIds(prev => prev.filter(p => p !== id));
  };

  const removeCharId = (id: string) => {
    setSelectedCharIds(prev => prev.filter(cid => cid !== id));
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedCharIds.length === 0) return;
    setLoading(true);
    try {
      const campId = Math.random().toString(36).substring(2, 11);
      const newCamp: Campaign = {
        id: campId,
        name,
        gmId: 'MESTRE',
        playerIds,
        characterIds: selectedCharIds,
        createdAt: new Date().toISOString(),
        accessCode: generateAccessCode()
      };
      await setDoc(doc(db, 'campaigns', campId), newCamp);
      
      for (const charId of selectedCharIds) {
        await updateDoc(doc(db, 'characters', charId), { campaignId: campId });
      }

      navigate(`/campaign/${campId}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'campaigns');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <AnimatePresence>
        {isPlayerSearchOpen && (
          <UserSearchModal onSelect={addPlayerId} onClose={() => setIsPlayerSearchOpen(false)} />
        )}
        {isCharSearchOpen && (
          <CharacterSearchModal userIds={playerIds} onSelect={addCharacterId} onClose={() => setIsCharSearchOpen(false)} />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center gap-6">
          <button onClick={() => navigate('/gm/campaigns')} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Criar Campanha</h1>
            <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Portal do Mestre</p>
          </div>
        </header>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome da Campanha</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-xl font-bold text-white outline-none focus:border-amber-500/50 transition-all font-mono italic"
                placeholder="Ex: A Sombra do Corvo"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Jogadores Participantes</label>
                <button 
                  onClick={() => setIsPlayerSearchOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-white font-black uppercase text-[8px] tracking-widest transition-all flex items-center gap-2"
                >
                  <Plus size={12} /> Adicionar Jogador
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {playerIds.length === 0 && <p className="text-zinc-700 text-[10px] italic">Nenhum jogador selecionado.</p>}
                {playerIds.map(id => (
                  <div key={id} className="bg-zinc-900 border border-zinc-800 pl-3 pr-1 py-1 rounded-full flex items-center gap-2 group">
                    <span className="text-[10px] font-mono font-bold text-zinc-400">ID: {id}</span>
                    <button onClick={() => removePlayerId(id)} className="p-1 hover:text-rose-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Personagens (Fichas)</label>
                <button 
                  onClick={() => setIsCharSearchOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-white font-black uppercase text-[8px] tracking-widest transition-all flex items-center gap-2"
                >
                  <Plus size={12} /> Vincular Ficha
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {selectedCharIds.length === 0 && <p className="text-zinc-700 text-[10px] italic">Nenhuma ficha vinculada.</p>}
                {selectedCharIds.map(id => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-[10px]">
                    <span className="text-zinc-300 font-bold uppercase italic">{id}</span>
                    <button onClick={() => removeCharId(id)} className="text-rose-500 hover:text-rose-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={handleCreate}
            disabled={loading || !name.trim() || selectedCharIds.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl shadow-lg transition-all"
          >
            {loading ? 'Criando...' : 'Criar Campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}
