import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { query, collection, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Campaign } from '../../types';

export interface JoinCampaignModalProps {
  userId: string;
  onJoined: (id: string) => void;
  onClose: () => void;
}

export function JoinCampaignModal({ userId, onJoined, onClose }: JoinCampaignModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const q = query(collection(db, 'campaigns'), where('accessCode', '==', code.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError('Código de acesso inválido.');
        setLoading(false);
        return;
      }

      const campaignDoc = snap.docs[0];
      const campaign = campaignDoc.data() as Campaign;

      if (campaign.playerIds.includes(userId)) {
        onJoined(campaignDoc.id);
        setLoading(false);
        return;
      }

      const updatedPlayerIds = [...campaign.playerIds, userId];
      await updateDoc(doc(db, 'campaigns', campaignDoc.id), { playerIds: updatedPlayerIds });
      
      onJoined(campaignDoc.id);
    } catch (e) {
      console.error(e);
      setError('Ocorreu um erro ao tentar entrar na campanha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-8 space-y-8"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Entrar na Campanha</h2>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Insira o código fornecido pelo seu Mestre</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-2">
            <input 
              type="text" 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CÓDIGO (ex: Ab12)"
              maxLength={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-6 text-center text-3xl font-black uppercase tracking-[0.5em] text-amber-500 outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-800"
              autoFocus
            />
            {error && <p className="text-rose-500 text-[10px] font-black uppercase text-center">{error}</p>}
          </div>

          <div className="flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading || !code}
              className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-2xl text-[10px] uppercase font-black tracking-widest text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
