import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ManageSystemsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-12">
        <header className="flex items-center gap-6">
          <button onClick={() => navigate('/gm-dashboard')} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Gerenciar Sistemas</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em]">Configure as regras e dados dos jogos</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button 
            onClick={() => navigate('/gm/systems/shadowdark')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-80"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519074063912-ad25b5ceb967?q=80&w=1000&auto=format&fit=crop')] opacity-10 group-hover:opacity-20 transition-opacity bg-cover bg-center" />
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white relative z-10">Shadowdark RPG</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest relative z-10">Old-school fantasy gaming</p>
          </button>
        </div>
      </div>
    </div>
  );
}
