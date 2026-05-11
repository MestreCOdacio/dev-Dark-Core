import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Search, ChevronDown, Sparkles, Plus } from 'lucide-react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Spell, SpellType } from '../../types';

export interface SpellSelectionModalProps {
  onSelect: (spell: Spell) => void;
  onClose: () => void;
  id?: string;
}

export function SpellSelectionModal({ onSelect, onClose, id }: SpellSelectionModalProps) {
  const [spells, setSpells] = useState<Spell[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<SpellType | 'Todos'>('Todos');
  const [filterTier, setFilterTier] = useState<number | 'Todos'>('Todos');

  useEffect(() => {
    const fetchSpells = async () => {
      try {
        const q = query(collection(db, 'spells'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Spell));
        setSpells(list);
      } catch (e) {
        console.error("Failed to fetch spells:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSpells();
  }, []);

  const filteredSpells = spells.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'Todos' || (Array.isArray(s.type) ? s.type.includes(filterType as any) : (s.type === filterType || (filterType === 'Arcano' && s.type === 'Magia') || (filterType === 'Magia' && s.type === 'Arcano')));
    const matchesTier = filterTier === 'Todos' || s.tier === filterTier;
    return matchesSearch && matchesType && matchesTier;
  });

  return (
    <div id={id} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/99 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-[#0c0c0e] border border-zinc-800 rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-zinc-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-black italic uppercase tracking-widest text-white leading-none">O Grimório</h2>
              <p className="text-[10px] uppercase font-black text-zinc-500 tracking-[0.3em]">Selecione uma magia para conjurar</p>
            </div>
            <button onClick={onClose} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all active:scale-95"><X size={24} /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-amber-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar magia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all font-mono italic"
              />
            </div>

            <div className="relative">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest outline-none focus:border-amber-500/50 focus:text-white transition-all font-mono appearance-none h-full cursor-pointer"
              >
                <option value="Todos">Todas as Origens</option>
                <option value="Arcano">Arcano</option>
                <option value="Milagre">Milagre</option>
                <option value="Magia Negra">Magia Negra</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                <ChevronDown size={18} />
              </div>
            </div>

            <div className="relative">
              <select 
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value === 'Todos' ? 'Todos' : parseInt(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest outline-none focus:border-amber-500/50 focus:text-white transition-all font-mono appearance-none h-full cursor-pointer"
              >
                <option value="Todos">Todos os Graus</option>
                {[1, 2, 3, 4, 5].map(t => (
                  <option key={t} value={t}>Grau {t}</option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[radial-gradient(circle_at_50%_0%,#18181b_0%,transparent_100%)]">
          {loading ? (
             <div className="h-40 flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Consultando Antigas Escrituras...</div>
          ) : filteredSpells.length === 0 ? (
             <div className="h-40 flex flex-col items-center justify-center text-zinc-600 space-y-4">
                <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800 opacity-20">
                   <Sparkles size={40} />
                </div>
                <p className="font-mono uppercase text-xs tracking-[0.3em]">Nenhum conhecimento encontrado</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {filteredSpells.map(spell => (
                 <button
                   key={spell.id}
                   onClick={() => onSelect(spell)}
                   className="flex flex-col p-6 bg-zinc-950 border border-zinc-800 rounded-3xl hover:border-amber-500/50 hover:bg-amber-500/[0.02] transition-all text-left group relative overflow-hidden active:scale-[0.98]"
                 >
                   <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <div className="p-2 bg-amber-500 rounded-xl text-black">
                        <Plus size={18} strokeWidth={3} />
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3 mb-3">
                     <div className="flex gap-2">
                       {(Array.isArray(spell.type) ? spell.type : [spell.type]).map(t => (
                         <span key={t} className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${
                           t === 'Milagre' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                           t === 'Magia Negra' ? 'bg-purple-950/20 border-purple-500/30 text-purple-400' :
                           'bg-sky-500/10 border-sky-500/30 text-sky-400'
                         }`}>
                            {t === 'Magia' ? 'Arcano' : t}
                         </span>
                       ))}
                     </div>
                     <div className="flex items-center gap-1.5 py-1 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">Grau {spell.tier}</span>
                     </div>
                   </div>

                   <h4 className="text-xl font-black text-white italic group-hover:text-amber-500 transition-colors uppercase tracking-tight mb-4">{spell.name}</h4>
                   
                   <div className="flex flex-wrap gap-4 text-[9px] uppercase font-black mb-4">
                      <div className="flex items-center gap-2 text-zinc-500"><div className="w-1 h-1 rounded-full bg-zinc-800" /> Alcance: <span className="text-zinc-300">{spell.range}</span></div>
                      <div className="flex items-center gap-2 text-zinc-500"><div className="w-1 h-1 rounded-full bg-zinc-800" /> Duração: <span className="text-zinc-300">{spell.duration}</span></div>
                   </div>

                   <p className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed italic border-t border-zinc-900 pt-4 group-hover:text-zinc-400 transition-colors">{spell.description}</p>
                 </button>
               ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
