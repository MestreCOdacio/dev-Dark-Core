import { useState } from 'react';
import { motion } from 'motion/react';
import { User } from 'lucide-react';

export interface PlayerNicknameModalProps {
  onSave: (nickname: string) => void;
  id?: string;
}

export function PlayerNicknameModal({ onSave, id }: PlayerNicknameModalProps) {
  const [nickname, setNickname] = useState('');
  
  return (
    <div id={id} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <User className="text-amber-500" size={24} />
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bem-vindo ao Dark Core RPG</h2>
          <p className="text-zinc-500 text-xs text-center">Antes de começar, como gostaria de ser chamado?</p>
        </div>

        <div className="space-y-4">
          <input 
            type="text"
            placeholder="Seu apelido..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center text-white outline-none focus:border-amber-500/50 transition-all font-bold"
            autoFocus
          />
          <p className="text-[10px] text-zinc-600 text-center italic">Você poderá alterar seu apelido futuramente na página inicial.</p>
          <button 
            disabled={!nickname.trim()}
            onClick={() => onSave(nickname.trim())}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all active:scale-95 shadow-lg"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
