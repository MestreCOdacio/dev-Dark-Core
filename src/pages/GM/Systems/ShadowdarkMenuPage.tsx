import React from 'react';
import { ArrowLeft, BookOpen, Package, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ShadowdarkMenuPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-12">
        <header className="flex items-center gap-6">
          <button onClick={() => navigate('/gm/systems')} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Shadowdark RPG</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em]">Gerenciamento de Conteúdo</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button 
            onClick={() => navigate('/gm/systems/shadowdark/spells')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-64"
          >
            <BookOpen className="text-zinc-600 group-hover:text-amber-550 transition-colors" size={32} />
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white mt-4">Magias</h3>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Grimório Global do Sistema</p>
          </button>

          <button 
            onClick={() => navigate('/gm/systems/shadowdark/items')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-64"
          >
            <Package className="text-zinc-600 group-hover:text-amber-550 transition-colors" size={32} />
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white mt-4">Itens</h3>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Acervo de Equipamentos</p>
          </button>

          <button 
            onClick={() => navigate('/gm/systems/shadowdark/classes')}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-64"
          >
            <Sparkles className="text-zinc-600 group-hover:text-amber-550 transition-colors" size={32} />
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white mt-4">Classes</h3>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Customização de Perfis</p>
          </button>
        </div>
      </div>
    </div>
  );
}
