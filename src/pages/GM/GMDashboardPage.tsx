import React from 'react';
import { ArrowLeft, Map, Settings, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function GMDashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    localStorage.removeItem('shadowdark_userid');
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col justify-center">
      <div className="max-w-4xl mx-auto w-full space-y-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Dashboard Mestre</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Dark Core RPG</p>
          </div>
          <button 
            onClick={handleLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button 
            onClick={() => navigate('/gm/campaigns')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-80"
          >
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Campanhas</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Gerenciar aventuras e participantes</p>
          </button>

          <button 
            onClick={() => navigate('/gm/systems')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-purple-500/50 transition-all shadow-2xl h-80"
          >
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Gerenciar Sistemas</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Shadowdark, Magias e Mais</p>
          </button>

          <button 
            onClick={() => navigate('/gm/ids')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-sky-500/50 transition-all shadow-2xl h-80"
          >
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Gerenciar Usuários</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Administrar acesso de jogadores</p>
          </button>
        </div>
      </div>
    </div>
  );
}
