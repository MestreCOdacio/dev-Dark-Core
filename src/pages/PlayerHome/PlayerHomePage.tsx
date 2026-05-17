import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Map, Plus, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../utils/errorUtils';
import { PlayerNicknameModal } from '../../components/modals/PlayerNicknameModal';
import { EditIcon } from '../../components/ui/Icons';
import { useAuth } from '../../contexts/AuthContext';

export function PlayerHomePage() {
  const navigate = useNavigate();
  const { user, profile, logout, updateProfile } = useAuth();
  const userId = user?.uid || localStorage.getItem('shadowdark_userid') || '';
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNickname, setNewNickname] = useState(profile?.nickname || '');

  const updateNickname = async (nick: string) => {
    if (!nick.trim()) return;
    try {
      await updateProfile({ nickname: nick.trim() });
      setIsEditingName(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('shadowdark_userid');
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col justify-center">
      <AnimatePresence>
        {!profile?.nickname && (
          <PlayerNicknameModal onSave={updateNickname} />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto w-full space-y-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="bg-zinc-950 border border-amber-500/50 rounded-lg px-3 py-1 text-2xl font-black italic uppercase tracking-tighter text-white outline-none w-48"
                    autoFocus
                  />
                  <button onClick={() => updateNickname(newNickname)} className="p-2 bg-amber-500/10 text-amber-500 rounded-lg"><Plus size={16} /></button>
                  <button onClick={() => { setIsEditingName(false); setNewNickname(profile?.nickname || ''); }} className="p-2 text-zinc-600"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                    {profile?.nickname || 'Inominado'}
                  </h1>
                  <button 
                    onClick={() => { setIsEditingName(true); setNewNickname(profile?.nickname || ''); }}
                    className="p-2 text-zinc-700 hover:text-amber-500 transition-colors"
                  >
                    <EditIcon size={16} />
                  </button>
                </>
              )}
            </div>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">ID: <span className="font-mono text-amber-500/80">{userId}</span></p>
          </div>
          <button 
            onClick={handleLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-96">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full h-full group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl"
          >
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white group-hover:scale-105 transition-transform origin-left">Fichas</h2>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em]">Gerenciar seus personagens</p>
            
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
          </button>

          <button 
            onClick={() => navigate('/campaigns')}
            className="w-full h-full group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl"
          >
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white group-hover:scale-105 transition-transform origin-left">Campanhas</h2>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em]">Participe de aventuras</p>
            
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
            <Map size={120} className="absolute -top-4 -right-4 opacity-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
