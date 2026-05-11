import { ArrowLeft, BookOpen } from 'lucide-react';

export interface ShadowdarkMenuPageProps {
  onSelectSpells: () => void;
  onBack: () => void;
  id?: string;
}

export function ShadowdarkMenuPage({ onSelectSpells, onBack, id }: ShadowdarkMenuPageProps) {
  return (
    <div id={id} className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-12">
        <header className="flex items-center gap-6">
          <button onClick={onBack} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Shadowdark RPG</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em]">Gerenciamento de Conteúdo</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button 
            onClick={onSelectSpells}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-80"
          >
            <div className="absolute top-8 left-8 p-4 bg-zinc-950 rounded-2xl text-amber-500 border border-zinc-800 group-hover:scale-110 transition-transform">
              <BookOpen size={32} />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Magias</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Grimório Global do Sistema</p>
          </button>
        </div>
      </div>
    </div>
  );
}
