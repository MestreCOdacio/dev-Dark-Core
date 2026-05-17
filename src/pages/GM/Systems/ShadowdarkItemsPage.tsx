import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Search, ChevronDown, ChevronUp, Settings, Trash2, X, Droplets, Flame } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { MasterItem, ItemCategory } from '../../../types';
import { handleFirestoreError, OperationType } from '../../../utils/errorUtils';
import { useNavigate } from 'react-router-dom';

const WEAPON_PROPERTIES = ['Versátil', 'Acuidade', 'Arremessável', 'Distância', 'Duas Mãos'];
const ARMOR_DISADVANTAGES = ['Furtividade', 'Natação', 'Não pode Nadar'];

export function ShadowdarkItemsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  
  // Deletion States
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  
  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');

  const [formData, setFormData] = useState<Omit<MasterItem, 'id' | 'createdAt'>>({
    name: '',
    category: 'Geral',
    slots: 1,
    description: '',
    properties: [],
    range: '',
    damage: '',
    modifiers: '',
    ac: 10,
    sumDex: false,
    disadvantages: [],
    itemsPerSlot: 1,
    hands: 1,
    lightDuration: 3600,
    lightHasFuel: false,
    lightFuelItemId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'master_items'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MasterItem[] = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as MasterItem));
      setItems(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'master_items');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        description: formData.description.substring(0, 200)
      };

      if (editingItem) {
        await updateDoc(doc(db, 'master_items', editingItem.id), {
          ...dataToSave,
          createdAt: editingItem.createdAt || Date.now()
        });
      } else {
        const newItemRef = doc(collection(db, 'master_items'));
        await setDoc(newItemRef, {
          ...dataToSave,
          id: newItemRef.id,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'master_items');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Geral',
      slots: 1,
      description: '',
      properties: [],
      range: '',
      damage: '',
      modifiers: '',
      ac: 10,
      sumDex: false,
      disadvantages: [],
      itemsPerSlot: 1,
      hands: 1,
      lightDuration: 3600,
      lightHasFuel: false,
      lightFuelItemId: ''
    });
  };

  const deleteItem = async (id: string | null) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'master_items', id));
      if (expandedItemId === id) setExpandedItemId(null);
      setItemToDelete(null);
      setConfirmDeleteInput('');
    } catch (error) {
      console.error("Delete Error:", error);
      handleFirestoreError(error, OperationType.DELETE, `master_items/${id}`);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
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
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">Acervo de Itens</h1>
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">Equipamentos e Tesouros</p>
            </div>
          </div>
          <button 
            onClick={() => { 
              setEditingItem(null); 
              resetForm();
              setIsModalOpen(true); 
            }}
            className="flex items-center justify-center gap-2 px-6 py-4 sm:py-3 bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase font-black tracking-widest rounded-xl transition-all active:scale-95"
          >
            <Plus size={16} /> Novo Item
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
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Categoria:</span>
            <div className="flex-1 flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
              {(['all', 'Arma', 'Armadura', 'Escudo', 'Pacote', 'Iluminação', 'Geral'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCategoryFilter(t)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${categoryFilter === t ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'}`}
                >
                  {t === 'all' ? 'TODOS' : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pb-20">
          {loading ? (
            <div className="py-20 text-center text-zinc-600 italic font-bold">Carregando acervo...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-zinc-600 italic font-bold">Nenhum item encontrado.</div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                className={`group bg-zinc-950 border transition-all duration-300 rounded-3xl overflow-hidden ${expandedItemId === item.id ? 'border-amber-500/50' : 'border-zinc-900 hover:border-zinc-800'}`}
              >
                <div 
                  onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                  className="p-6 cursor-pointer flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="text-lg font-black italic uppercase tracking-tight text-white">{item.name}</h3>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{item.category}</p>
                      </div>
                    </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                       <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{item.slots} Espaço{item.slots !== 1 ? 's' : ''}</span>
                    </div>
                    {expandedItemId === item.id ? <ChevronUp className="text-zinc-600" size={20} /> : <ChevronDown className="text-zinc-600" size={20} />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedItemId === item.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-zinc-900 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {item.category === 'Arma' && (
                             <>
                               <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Dano</p>
                                 <p className="text-[11px] font-bold text-white">{item.damage || '-'}</p>
                               </div>
                               <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Alcance</p>
                                 <p className="text-[11px] font-bold text-white">{item.range || '-'}</p>
                               </div>
                             </>
                           )}
                           {item.category === 'Armadura' && (
                             <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">CA</p>
                               <p className="text-[11px] font-bold text-white">{item.ac}{item.sumDex ? ' + DEX' : ''}</p>
                             </div>
                           )}
                           {item.category === 'Escudo' && (
                             <>
                               <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Modificador</p>
                                 <p className="text-[11px] font-bold text-white">+2 CA</p>
                               </div>
                               <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Mãos</p>
                                 <p className="text-[11px] font-bold text-white">1 Mão</p>
                               </div>
                             </>
                           )}
                           {item.category === 'Pacote' && (
                             <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Itens / Espaço</p>
                               <p className="text-[11px] font-bold text-white">{item.itemsPerSlot}</p>
                             </div>
                           )}
                           {item.category === 'Iluminação' && (
                             <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Duração</p>
                               <p className="text-[11px] font-bold text-white">{(item.lightDuration || 3600) / 3600}h</p>
                             </div>
                           )}
                           <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                             <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Espaço</p>
                             <p className="text-[11px] font-bold text-white">{item.slots}</p>
                           </div>
                        </div>

                        {item.category === 'Arma' && item.properties && item.properties.length > 0 && (
                          <div className="space-y-2">
                             <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Propriedades</p>
                             <div className="flex flex-wrap gap-2">
                               {item.properties.map(p => (
                                 <span key={p} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[9px] font-black uppercase text-amber-500 rounded">{p}</span>
                               ))}
                             </div>
                          </div>
                        )}

                        {item.category === 'Armadura' && item.disadvantages && item.disadvantages.length > 0 && (
                          <div className="space-y-2">
                             <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Desvantagens</p>
                             <div className="flex flex-wrap gap-2">
                               {item.disadvantages.map(d => (
                                 <span key={d} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[9px] font-black uppercase text-rose-500 rounded">{d}</span>
                               ))}
                             </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Descrição</p>
                          <p className="text-sm text-zinc-400 leading-relaxed font-medium whitespace-pre-wrap">{item.description}</p>
                        </div>

                        <div className="pt-6 border-t border-zinc-900 flex justify-end gap-3">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingItem(item); 
                              setFormData({ 
                                ...item, 
                                properties: item.properties || [],
                                disadvantages: item.disadvantages || [],
                                range: item.range || '',
                                damage: item.damage || '',
                                modifiers: item.modifiers || '',
                                ac: item.ac || 10,
                                sumDex: item.sumDex || false,
                                itemsPerSlot: item.itemsPerSlot || 1,
                                slots: item.slots || 1,
                                hands: item.hands || 1,
                                lightDuration: item.lightDuration || 3600,
                                lightHasFuel: item.lightHasFuel || false,
                                lightFuelItemId: item.lightFuelItemId || ''
                              }); 
                              setIsModalOpen(true); 
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                          >
                            <Settings size={14} /> Editar
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setItemToDelete(item.id);
                              setConfirmDeleteInput('');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-rose-500 hover:border-rose-500/50 transition-all"
                          >
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>

                        <AnimatePresence>
                          {itemToDelete === item.id && (
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
                                  onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                  disabled={confirmDeleteInput !== 'DELETAR'}
                                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-20 text-white font-black uppercase text-[10px] py-2 rounded-lg transition-all"
                                >
                                  EXCLUIR AGORA
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setItemToDelete(null); }}
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
            onClick={() => { setIsModalOpen(false); setEditingItem(null); }}
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
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{editingItem ? 'Editar Item' : 'Novo Item'}</h2>
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">Defina as propriedades do equipamento</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setIsModalOpen(false); setEditingItem(null); }} 
                    className="p-3 bg-zinc-900 rounded-2xl text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-zinc-950">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Nome do Item</label>
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="ex: Espada Longa"
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Categoria</label>
                      <div className="relative">
                        <select 
                          value={formData.category}
                          onChange={e => {
                            const cat = e.target.value as ItemCategory;
                            setFormData({ 
                              ...formData, 
                              category: cat,
                              // Set defaults for shield if selected
                              ...(cat === 'Escudo' ? { slots: 1, hands: 1 } : {})
                            });
                          }}
                          className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all appearance-none cursor-pointer"
                        >
                          {['Arma', 'Armadura', 'Escudo', 'Pacote', 'Iluminação', 'Geral'].map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Weapon Specific Fields */}
                  {formData.category === 'Arma' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Alcance (A, P, L)</label>
                          <input 
                            type="text"
                            value={formData.range}
                            onChange={e => setFormData({ ...formData, range: e.target.value.substring(0, 1).toUpperCase() as any })}
                            placeholder="A, P ou L"
                            className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all text-center"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Dano</label>
                          <input 
                            type="text"
                            value={formData.damage}
                            onChange={e => setFormData({ ...formData, damage: e.target.value })}
                            placeholder="ex: 1d8"
                            className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all text-center"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Dano/Ataque Extras</label>
                          <input 
                            type="text"
                            value={formData.modifiers}
                            onChange={e => setFormData({ ...formData, modifiers: e.target.value })}
                            placeholder="+1 dano magico"
                            className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Propriedades</label>
                        <div className="flex flex-wrap gap-3">
                          {WEAPON_PROPERTIES.map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                const current = [...(formData.properties || [])];
                                if (current.includes(p)) {
                                  setFormData({ ...formData, properties: current.filter(x => x !== p) });
                                } else {
                                  setFormData({ ...formData, properties: [...current, p] });
                                }
                              }}
                              className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.properties?.includes(p) ? 'bg-amber-600 border-amber-500 text-white' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Armor Specific Fields */}
                  {formData.category === 'Armadura' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Valor de CA</label>
                            <input 
                              type="number"
                              value={formData.ac}
                              onChange={e => setFormData({ ...formData, ac: parseInt(e.target.value) || 0 })}
                              className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all"
                            />
                          </div>
                          <div className="flex items-center gap-4 pt-8">
                             <button
                               type="button"
                               onClick={() => setFormData({ ...formData, sumDex: !formData.sumDex })}
                               className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${formData.sumDex ? 'bg-amber-600 border-amber-500 text-white' : 'bg-zinc-900 border-zinc-800 text-transparent'}`}
                             >
                               <Plus size={16} />
                             </button>
                             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Somar Destreza?</span>
                          </div>
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Desvantagens</label>
                          <div className="flex flex-wrap gap-3">
                            {ARMOR_DISADVANTAGES.map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  const current = [...(formData.disadvantages || [])];
                                  if (current.includes(d)) {
                                    setFormData({ ...formData, disadvantages: current.filter(x => x !== d) });
                                  } else {
                                    setFormData({ ...formData, disadvantages: [...current, d] });
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.disadvantages?.includes(d) ? 'bg-rose-600 border-rose-500 text-white' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500'}`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {/* Shield Specific Fields */}
                  {formData.category === 'Escudo' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
                             <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Modificador de CA</p>
                             <p className="text-sm font-bold text-white">+2</p>
                             <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold">Fixo para Escudos</p>
                          </div>
                          <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
                             <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Mãos Requeridas</p>
                             <p className="text-sm font-bold text-white">1 Mão</p>
                             <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold">Fixo para Escudos</p>
                          </div>
                       </div>
                    </motion.div>
                  )}
                  {/* Bundle Specific Fields */}
                  {formData.category === 'Pacote' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                       <div className="space-y-3">
                          <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Itens por Espaço</label>
                          <input 
                            type="number"
                            value={formData.itemsPerSlot}
                            onChange={e => setFormData({ ...formData, itemsPerSlot: parseInt(e.target.value) || 1 })}
                            className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all"
                          />
                       </div>
                    </motion.div>
                  )}

                  {/* Lighting Specific Fields */}
                  {formData.category === 'Iluminação' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 p-6 bg-zinc-900/30 border border-zinc-800 rounded-3xl">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                             <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Duração (Horas)</label>
                             <div className="flex items-center gap-4">
                               <button 
                                 type="button"
                                 onClick={() => setFormData({ ...formData, lightDuration: Math.max(3600, (formData.lightDuration || 3600) - 3600) })}
                                 className="w-10 h-10 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"
                               ><ChevronDown size={18} /></button>
                               <div className="flex-1 text-center font-black text-white italic">{(formData.lightDuration || 3600) / 3600}h</div>
                               <button 
                                 type="button"
                                 onClick={() => setFormData({ ...formData, lightDuration: (formData.lightDuration || 3600) + 3600 })}
                                 className="w-10 h-10 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"
                               ><ChevronUp size={18} /></button>
                             </div>
                          </div>

                          <div className="flex items-center justify-between pt-6">
                             <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${formData.lightHasFuel ? 'bg-sky-500/10 border-sky-500/50 text-sky-500' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                                   <Droplets size={18} />
                                </div>
                                <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Consome Combustível?</span>
                             </div>
                             <button 
                               type="button"
                               onClick={() => setFormData({ ...formData, lightHasFuel: !formData.lightHasFuel })}
                               className={`w-12 h-6 rounded-full transition-all relative ${formData.lightHasFuel ? 'bg-sky-500' : 'bg-zinc-800'}`}
                             >
                               <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.lightHasFuel ? 'left-7' : 'left-1'}`} />
                             </button>
                          </div>
                       </div>

                       {formData.lightHasFuel && (
                         <div className="space-y-3">
                            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Selecione o Item de Combustível</label>
                            <div className="relative">
                              <select 
                                value={formData.lightFuelItemId}
                                onChange={e => setFormData({ ...formData, lightFuelItemId: e.target.value })}
                                className="w-full bg-zinc-950 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-sky-500/50 transition-all appearance-none cursor-pointer"
                              >
                                <option value="" className="bg-zinc-900 text-zinc-500 italic">Selecione um item (Geral ou Pacote)...</option>
                                {items.filter(i => i.category === 'Geral' || i.category === 'Pacote').map(item => (
                                  <option key={item.id} value={item.id} className="bg-zinc-900">{item.name}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={18} />
                            </div>
                         </div>
                       )}
                    </motion.div>
                  )}

                  {/* Common Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Espaço (Ocupado no Inventário)</label>
                      <input 
                        required
                        type="number"
                        value={formData.slots}
                        onChange={e => setFormData({ ...formData, slots: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500">Descrição</label>
                      <span className={`text-[9px] font-black ${formData.description.length > 200 ? 'text-rose-500' : 'text-zinc-700'}`}>
                        {formData.description.length} / 200
                      </span>
                    </div>
                    <textarea 
                      maxLength={200}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrição do item..."
                      className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-6 text-white font-medium outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all min-h-[120px] resize-none placeholder:text-zinc-700"
                    />
                  </div>
                </div>

                <div className="p-10 border-t border-zinc-900 bg-zinc-950/50 backdrop-blur-md">
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => { setIsModalOpen(false); setEditingItem(null); }}
                      className="flex-1 px-8 py-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-white hover:bg-zinc-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={formData.description.length > 200}
                      className="flex-[2] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl transition-all active:scale-[0.98]"
                    >
                      {editingItem ? 'Salvar Alterações' : 'Criar Item'}
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
