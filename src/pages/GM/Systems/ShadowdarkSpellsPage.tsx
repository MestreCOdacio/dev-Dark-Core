import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ChevronDown, ChevronUp, Settings, Trash2, X } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Spell, SpellType } from '../../../types';
import { handleFirestoreError, OperationType } from '../../../utils/errorUtils';

export function ShadowdarkSpellsPage() {
  const navigate = useNavigate();
  const [spells, setSpells] = useState<Spell[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);
  
  // Deletion States
  const [spellToDelete, setSpellToDelete] = useState<string | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  
  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<SpellType | 'all'>('all');

  const [formData, setFormData] = useState<Omit<Spell, 'id' | 'createdAt'>>({
    name: '',
    tier: 1,
    range: '',
    duration: '',
    type: ['Arcano'],
    description: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'spells'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Spell[] = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Spell));
      setSpells(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'spells');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingSpell) {
        await updateDoc(doc(db, 'spells', editingSpell.id), {
          ...formData,
          createdAt: editingSpell.createdAt || Date.now()
        });
      } else {
        const newSpellRef = doc(collection(db, 'spells'));
        await setDoc(newSpellRef, {
          ...formData,
          id: newSpellRef.id,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
      setEditingSpell(null);
      setFormData({ name: '', tier: 1, range: '', duration: '', type: ['Arcano'], description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'spells');
    }
  };

  const deleteSpell = async (id: string | null) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'spells', id));
      if (expandedSpellId === id) setExpandedSpellId(null);
      setSpellToDelete(null);
      setConfirmDeleteInput('');
    } catch (error) {
      console.error("Delete Error:", error);
      handleFirestoreError(error, OperationType.DELETE, `spells/${id}`);
    }
  };

  const filteredSpells = spells.filter(spell => {
    const matchesSearch = spell.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || spell.tier === tierFilter;
    
    const matchesType = typeFilter === 'all' || (Array.isArray(spell.type) ? spell.type.includes(typeFilter as any) : spell.type === typeFilter);
    
    return matchesSearch && matchesTier && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6 sm:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <button onClick={() => navigate('/gm/systems/shadowdark')} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">Grimório Shadowdark</h1>
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">Arcanos, Milagres e Magia Negra</p>
            </div>
          </div>
          <button 
            onClick={() => { 
              setEditingSpell(null); 
              setFormData({ name: '', tier: 1, range: '', duration: '', type: ['Arcano'], description: '' }); 
              setIsModalOpen(true); 
            }}
            className="flex items-center justify-center gap-2 px-6 py-4 sm:py-3 bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase font-black tracking-widest rounded-xl transition-all active:scale-95"
          >
            <Plus size={16} /> Adicionar Magia
          </button>
        </header>

        {/* Filters */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[32px] p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-bold placeholder:text-zinc-700 outline-none focus:border-amber-500/50 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Grau:</span>
              <div className="flex-1 flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                {['all', 1, 2, 3, 4, 5].map(t => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t as any)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${tierFilter === t ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'}`}
                  >
                    {t === 'all' ? 'TODOS' : `G${t}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Tipo:</span>
              <div className="flex-1 flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                {['all', 'Arcano', 'Milagre', 'Magia Negra'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t as any)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${typeFilter === t ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'}`}
                  >
                    {t === 'all' ? 'TODOS' : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pb-20">
          {loading ? (
            <div className="py-20 text-center text-zinc-600 italic font-bold">Invocando grimório...</div>
          ) : filteredSpells.length === 0 ? (
            <div className="py-20 text-center text-zinc-600 italic font-bold">Nenhuma magia encontrada.</div>
          ) : (
            filteredSpells.map(spell => (
              <div 
                key={spell.id} 
                className={`group bg-zinc-950 border transition-all duration-300 rounded-3xl overflow-hidden ${expandedSpellId === spell.id ? 'border-amber-500/50' : 'border-zinc-900 hover:border-zinc-800'}`}
              >
                <div 
                  onClick={() => setExpandedSpellId(expandedSpellId === spell.id ? null : spell.id)}
                  className="p-6 cursor-pointer flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs border ${
                        (Array.isArray(spell.type) ? spell.type : [spell.type]).includes('Milagre') ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                        (Array.isArray(spell.type) ? spell.type : [spell.type]).includes('Magia Negra') ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 
                        'bg-sky-500/10 border-sky-500/20 text-sky-500'
                      }`}>
                        {spell.tier}
                      </div>
                      <div>
                        <h3 className="text-lg font-black italic uppercase tracking-tight text-white">{spell.name}</h3>
                        <div className="flex gap-2">
                          {(Array.isArray(spell.type) ? spell.type : [spell.type]).map(t => (
                            <p key={t} className={`text-[9px] font-black uppercase tracking-[0.2em] ${t === 'Arcano' ? 'text-sky-600' : t === 'Milagre' ? 'text-amber-600' : 'text-rose-600'}`}>{t}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                       <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{spell.range}</span>
                       <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{spell.duration}</span>
                    </div>
                    {expandedSpellId === spell.id ? <ChevronUp className="text-zinc-600" size={20} /> : <ChevronDown className="text-zinc-600" size={20} />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedSpellId === spell.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-zinc-900 space-y-6">
                        <div className="grid grid-cols-2 gap-4 sm:hidden">
                           <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                             <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Alcance</p>
                             <p className="text-[11px] font-bold text-white">{spell.range}</p>
                           </div>
                           <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                             <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Duração</p>
                             <p className="text-[11px] font-bold text-white">{spell.duration}</p>
                           </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Descrição do Efeito</p>
                          <p className="text-sm text-zinc-400 leading-relaxed font-medium whitespace-pre-wrap">{spell.description}</p>
                        </div>

                        <div className="pt-6 border-t border-zinc-900 flex justify-end gap-3">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingSpell(spell); 
                              setFormData({ ...spell, type: Array.isArray(spell.type) ? spell.type : [spell.type] }); 
                              setIsModalOpen(true); 
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                          >
                            <Settings size={14} /> Editar
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setSpellToDelete(spell.id);
                              setConfirmDeleteInput('');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-rose-500 hover:border-rose-500/50 transition-all"
                          >
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>

                        <AnimatePresence>
                          {spellToDelete === spell.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-4 p-4 bg-rose-950/20 border border-rose-900/40 rounded-2xl space-y-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-col gap-1 items-center">
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Confirmar Exclusão</p>
                                <p className="text-[10px] text-zinc-500 font-bold">Digite "DELETAR" para confirmar</p>
                              </div>
                              <input 
                                type="text"
                                value={confirmDeleteInput}
                                onChange={(e) => setConfirmDeleteInput(e.target.value)}
                                placeholder="DELETAR"
                                className="w-full bg-black/40 border border-rose-900/30 rounded-xl px-4 py-2 text-center text-white font-black text-xs outline-none focus:border-rose-500/50 transition-all placeholder:text-zinc-800"
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); deleteSpell(spell.id); }}
                                  disabled={confirmDeleteInput !== 'DELETAR'}
                                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-20 text-white font-black uppercase text-[10px] py-2 rounded-lg transition-all"
                                >
                                  EXCLUIR AGORA
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setSpellToDelete(null); }}
                                  className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black uppercase text-[10px] py-2 rounded-lg transition-all"
                                >
                                  CANCELAR
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div 
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm overflow-y-auto"
            onClick={() => { setIsModalOpen(false); setEditingSpell(null); }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[40px] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)] relative"
              style={{ maxHeight: 'calc(100vh - 4rem)' }}
            >
              <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
                <div className="p-10 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{editingSpell ? 'Editar Magia' : 'Nova Magia'}</h2>
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">Preencha os detalhes do grimório</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setIsModalOpen(false); setEditingSpell(null); }} 
                    className="p-3 bg-zinc-900 rounded-2xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-zinc-950">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Nome da Magia</label>
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="ex: Mísseis Mágicos"
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Grau</label>
                      <div className="relative">
                        <select 
                          value={formData.tier}
                          onChange={e => setFormData({ ...formData, tier: parseInt(e.target.value) })}
                          className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all appearance-none cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5].map(t => <option key={t} value={t} className="bg-zinc-900">Grau {t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Alcance</label>
                      <input 
                        required
                        type="text"
                        value={formData.range}
                        onChange={e => setFormData({ ...formData, range: e.target.value })}
                        placeholder="ex: Perto, 30 pés"
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Duração</label>
                      <input 
                        required
                        type="text"
                        value={formData.duration}
                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                        placeholder="ex: Instatânea, 5 rodadas"
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Tipo de Magia</label>
                    <div className="grid grid-cols-3 gap-4">
                      {['Arcano', 'Milagre', 'Magia Negra'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const currentTypes = [...(formData.type as SpellType[])];
                            if (currentTypes.includes(t as any)) {
                              if (currentTypes.length > 1) {
                                setFormData({ ...formData, type: currentTypes.filter(type => type !== t) });
                              }
                            } else {
                              setFormData({ ...formData, type: [...currentTypes, t as any] });
                            }
                          }}
                          className={`py-4 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.type.includes(t as any) ? 'bg-amber-600 border-amber-500 text-white scale-[1.02]' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Descrição</label>
                    <textarea 
                      required
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="O que a magia faz?"
                      className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-6 text-white font-medium outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all min-h-[160px] resize-none placeholder:text-zinc-700"
                    />
                  </div>
                </div>

                <div className="p-10 border-t border-zinc-900 bg-zinc-950/50 backdrop-blur-md">
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => { setIsModalOpen(false); setEditingSpell(null); }}
                      className="flex-1 px-8 py-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-white hover:bg-zinc-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl transition-all active:scale-[0.98]"
                    >
                      {editingSpell ? 'Salvar Alterações' : 'Criar Magia'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
