import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Search, ChevronDown, ChevronUp, Settings, Trash2, X, Sparkles, Wand2, Shield, Heart } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { CustomClass, MasterItem } from '../../../types';
import { handleFirestoreError, OperationType } from '../../../utils/errorUtils';
import { useNavigate } from 'react-router-dom';

interface AutoTextareaProps {
  value: string;
  onChange: (e: any) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
}

function AutoResizingTextarea({ value, onChange, ...props }: AutoTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        if (onChange) onChange(e);
        adjustHeight();
      }}
      {...props}
    />
  );
}

export function ShadowdarkClassesPage() {
  const navigate = useNavigate();
  const [classesList, setClassesList] = useState<CustomClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<CustomClass | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // Deletion States
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');

  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [hd, setHd] = useState<'1d4' | '1d6' | '1d8'>('1d6');
  const [weaponsArmor, setWeaponsArmor] = useState('');
  const [weapons, setWeapons] = useState('');
  const [selectedArmors, setSelectedArmors] = useState<string[]>([]);
  const [selectedShields, setSelectedShields] = useState<string[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [isSpellcaster, setIsSpellcaster] = useState(false);
  const [castAttribute, setCastAttribute] = useState<'INT' | 'WIS' | 'CHA'>('INT');
  const [magicType, setMagicType] = useState<'arcana' | 'miracle' | 'dark'>('arcana');

  const MAGIC_TYPE_LABELS: Record<string, string> = {
    arcana: 'Magias Arcanas (INT)',
    miracle: 'Milagre (SAB)',
    dark: 'Magia Negra (CAR)',
  };

  const availableArmors = Array.from(new Set([
    'Couro', 'Cota de Malha', 'Placas',
    ...masterItems.filter(item => item.category === 'Armadura').map(item => item.name)
  ]));

  const availableShields = Array.from(new Set([
    'Escudo',
    ...masterItems.filter(item => item.category === 'Escudo').map(item => item.name)
  ]));

  const getArmorText = (cls: CustomClass) => {
    const armors = cls.armors || [];
    if (armors.length === 0) return 'Nenhuma';
    if (availableArmors.length > 0 && armors.length === availableArmors.length) {
      return 'Todas as armaduras';
    }
    return armors.join(', ');
  };

  const getShieldText = (cls: CustomClass) => {
    const shields = cls.shields || [];
    if (shields.length === 0) return 'Nenhum';
    if (availableShields.length > 0 && shields.length === availableShields.length) {
      return 'Todos os escudos';
    }
    return shields.join(', ');
  };

  const getMagicTypeLabel = (cls: CustomClass) => {
    if (!cls.isSpellcaster) return 'Não Conjurador';
    const type = cls.magicType || (cls.castAttribute === 'WIS' ? 'miracle' : cls.castAttribute === 'CHA' ? 'dark' : 'arcana');
    return MAGIC_TYPE_LABELS[type] || 'Magias Arcanas (INT)';
  };
  
  // Spell grid state: Level 1 to 10 (rows), Tier 1 to 5 (cols)
  // Store as: Record<string, number[]> e.g. "1": [2, 0, 0, 0, 0]
  const [spellGrid, setSpellGrid] = useState<Record<string, number[]>>(() => {
    const grid: Record<string, number[]> = {};
    for (let lvl = 1; lvl <= 10; lvl++) {
      grid[lvl.toString()] = [0, 0, 0, 0, 0];
    }
    return grid;
  });

  // Starting Talents
  const [startingTalents, setStartingTalents] = useState<{ name: string; description: string; hasUses?: boolean; maxUses?: number }[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'master_items'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MasterItem[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as MasterItem);
      });
      setMasterItems(list);
    }, (error) => {
      console.error("Error loading master items:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'master_classes'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CustomClass[] = [];
      snapshot.forEach(doc => {
        list.push({ ...doc.data(), id: doc.id } as CustomClass);
      });
      setClassesList(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'master_classes');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setHd('1d6');
    setWeaponsArmor('');
    setWeapons('');
    setSelectedArmors([]);
    setSelectedShields([]);
    setIsSpellcaster(false);
    setCastAttribute('INT');
    setMagicType('arcana');
    
    // reset spell grid
    const grid: Record<string, number[]> = {};
    for (let lvl = 1; lvl <= 10; lvl++) {
      grid[lvl.toString()] = [0, 0, 0, 0, 0];
    }
    setSpellGrid(grid);
    setStartingTalents([]);
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cls: CustomClass) => {
    setEditingClass(cls);
    setName(cls.name);
    setHd(cls.hd);
    setWeaponsArmor(cls.weaponsArmor || '');
    setWeapons(cls.weapons || cls.weaponsArmor || '');
    setSelectedArmors(cls.armors || []);
    setSelectedShields(cls.shields || []);
    setIsSpellcaster(cls.isSpellcaster);
    setCastAttribute(cls.castAttribute || 'INT');
    const mType = cls.magicType || (cls.castAttribute === 'WIS' ? 'miracle' : cls.castAttribute === 'CHA' ? 'dark' : 'arcana');
    setMagicType(mType);
    setStartingTalents(cls.startingTalents || []);
    
    // load grid
    const grid: Record<string, number[]> = {};
    for (let lvl = 1; lvl <= 10; lvl++) {
      const existingRow = cls.spellsPerLevel?.[lvl.toString()];
      grid[lvl.toString()] = existingRow ? [...existingRow] : [0, 0, 0, 0, 0];
    }
    setSpellGrid(grid);
    setIsModalOpen(true);
  };

  const handleAddTalent = () => {
    setStartingTalents([...startingTalents, { name: '', description: '', hasUses: false, maxUses: 1 }]);
  };

  const handleRemoveTalent = (index: number) => {
    setStartingTalents(startingTalents.filter((_, i) => i !== index));
  };

  const handleTalentChange = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...startingTalents];
    updated[index] = { ...updated[index], [field]: value };
    setStartingTalents(updated);
  };

  const handleTalentExtraChange = (index: number, field: 'hasUses' | 'maxUses', value: any) => {
    const updated = [...startingTalents];
    updated[index] = { ...updated[index], [field]: value };
    setStartingTalents(updated);
  };

  const handleCellChange = (lvl: string, tierIndex: number, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    setSpellGrid(prev => ({
      ...prev,
      [lvl]: prev[lvl].map((v, i) => i === tierIndex ? val : v)
    }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const armorsText = selectedArmors.length === availableArmors.length ? 'Todas as armaduras' : selectedArmors.join(', ');
      const shieldsText = selectedShields.length === availableShields.length ? 'Todos os escudos' : selectedShields.join(', ');
      const parts = [
        weapons.trim() && `Armas: ${weapons.trim()}`,
        selectedArmors.length > 0 && `Armaduras: ${armorsText}`,
        selectedShields.length > 0 && `Escudos: ${shieldsText}`
      ].filter(Boolean);
      const generatedWeaponsArmor = parts.join(' | ');

      const payload: any = {
        name: name.trim(),
        hd,
        weaponsArmor: generatedWeaponsArmor,
        weapons: weapons.trim(),
        armors: selectedArmors,
        shields: selectedShields,
        isSpellcaster,
        startingTalents: startingTalents.filter(t => t.name.trim() !== ''),
      };

      if (isSpellcaster) {
        payload.magicType = magicType;
        payload.castAttribute = magicType === 'arcana' ? 'INT' : magicType === 'miracle' ? 'WIS' : 'CHA';
        payload.spellsPerLevel = spellGrid;
      }

      if (editingClass) {
        await updateDoc(doc(db, 'master_classes', editingClass.id), {
          ...payload,
          createdAt: editingClass.createdAt || Date.now()
        });
      } else {
        const newDocRef = doc(collection(db, 'master_classes'));
        await setDoc(newDocRef, {
          ...payload,
          id: newDocRef.id,
          createdAt: Date.now()
        });
      }

      setIsModalOpen(false);
      setEditingClass(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'master_classes');
    }
  };

  const handleDeleteClass = async (id: string | null) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'master_classes', id));
      if (expandedClassId === id) setExpandedClassId(null);
      setClassToDelete(null);
      setConfirmDeleteInput('');
    } catch (error) {
      console.error("Delete Error:", error);
      handleFirestoreError(error, OperationType.DELETE, `master_classes/${id}`);
    }
  };

  const filteredClasses = classesList.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6 sm:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => navigate('/gm/systems/shadowdark')} 
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">Classes Customizadas</h1>
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">Criar e Editar Perfis de Classes</p>
            </div>
          </div>
          <button 
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-widest px-6 py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Criar Classe
          </button>
        </header>

        {/* Filter Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 pl-12 text-sm text-white label-none outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-600"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Loading and Empty States */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-zinc-650 text-xs font-bold uppercase tracking-widest leading-none">Carregando classes...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-20 text-center bg-zinc-900/10 border border-dashed border-zinc-800/80 rounded-[32px] p-8">
            <Sparkles className="mx-auto text-zinc-700 mb-4" size={40} />
            <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Nenhuma Classe</h3>
            <p className="text-zinc-500 text-xs mt-1">Crie classes customizadas para enriquecer as opções de criação de heróis</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredClasses.map((cls) => {
              const isExpanded = expandedClassId === cls.id;
              return (
                <div 
                  key={cls.id}
                  className={`bg-zinc-900 border transition-all rounded-[24px] overflow-hidden ${
                    isExpanded ? 'border-amber-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' : 'border-zinc-850 hover:border-zinc-800'
                  }`}
                >
                  <div 
                    onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-zinc-850/20 transition-all select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center text-amber-500">
                        <span className="text-[9px] uppercase font-bold text-zinc-500">HD</span>
                        <span className="text-xs font-mono font-bold">{cls.hd}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black uppercase italic tracking-tighter text-white flex items-center gap-2">
                          {cls.name}
                          {cls.isSpellcaster && (
                            <span className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-black tracking-widest uppercase">
                              Conjurador
                            </span>
                          )}
                        </h3>
                        <p className="text-zinc-600 text-[10px] uppercase font-black tracking-wider mt-0.5">
                          Dado de Vida: {cls.hd} &bull; Magia: {getMagicTypeLabel(cls)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleOpenEdit(cls)}
                        className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                        title="Editar"
                      >
                        <Settings size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          setClassToDelete(cls.id);
                          setConfirmDeleteInput('');
                        }}
                        className="p-2.5 bg-zinc-950/80 border border-rose-950/10 hover:border-rose-900/30 rounded-lg text-rose-500 hover:text-rose-400 transition-all"
                        title="Apagar"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
                        className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-zinc-850 bg-zinc-950/40"
                      >
                        <div className="p-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest flex items-center gap-1">
                                <Shield size={10} /> Equipamentos Permitidos
                              </h4>
                              <div className="bg-zinc-950/65 border border-zinc-900 p-4 rounded-xl space-y-2.5 text-xs text-zinc-300">
                                <div>
                                  <strong className="text-[8px] uppercase font-black text-zinc-650 block mb-0.5">Armas:</strong>
                                  <span className="font-semibold">{cls.weapons || cls.weaponsArmor || 'Nenhuma'}</span>
                                </div>
                                {((cls.armors && cls.armors.length > 0) || !cls.weapons) && (
                                  <div>
                                    <strong className="text-[8px] uppercase font-black text-zinc-650 block mb-0.5">Armaduras:</strong>
                                    <span className="font-semibold">{getArmorText(cls)}</span>
                                  </div>
                                )}
                                {((cls.shields && cls.shields.length > 0) || !cls.weapons) && (
                                  <div>
                                    <strong className="text-[8px] uppercase font-black text-zinc-650 block mb-0.5">Escudos:</strong>
                                    <span className="font-semibold">{getShieldText(cls)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest flex items-center gap-1">
                                <Heart size={10} /> Atributo e Atributos de Magia
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-zinc-950/65 border border-zinc-900 p-3 rounded-xl">
                                  <span className="block text-[8px] uppercase font-black text-zinc-600">DADO DE VIDA</span>
                                  <span className="font-mono text-white text-sm font-bold">{cls.hd}</span>
                                </div>
                                <div className="bg-zinc-950/65 border border-zinc-900 p-3 rounded-xl">
                                  <span className="block text-[8px] uppercase font-black text-zinc-600">CONJURADOR</span>
                                  <span className="text-white text-sm font-bold uppercase">{cls.isSpellcaster ? getMagicTypeLabel(cls) : 'Não'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {cls.startingTalents && cls.startingTalents.length > 0 && (
                            <div className="space-y-3 border-t border-zinc-900 pt-4">
                              <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest flex items-center gap-1">
                                <Sparkles size={10} /> Talentos Iniciais
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {cls.startingTalents.map((t, idx) => (
                                  <div key={idx} className="bg-zinc-950/50 border border-zinc-900 p-4 rounded-xl">
                                    <div className="flex justify-between items-center">
                                      <h5 className="font-bold text-white text-sm uppercase italic tracking-wide">{t.name}</h5>
                                      {t.hasUses && (
                                        <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase">
                                          {t.maxUses} {t.maxUses === 1 ? 'Uso' : 'Usos'}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{t.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {cls.isSpellcaster && cls.spellsPerLevel && (
                            <div className="space-y-3 border-t border-zinc-900 pt-4 overflow-x-auto">
                              <h4 className="text-[10px] uppercase font-black text-rose-500 tracking-widest flex items-center gap-1">
                                <Wand2 size={10} /> Tabela de Magias Preparadas/Conhecidas por Nível
                              </h4>
                              <table className="w-full text-left text-xs border border-zinc-900 rounded-xl overflow-hidden leading-tight">
                                <thead>
                                  <tr className="bg-zinc-950 text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
                                    <th className="p-2 border-b border-zinc-900"></th>
                                    <th colSpan={5} className="p-2 text-center border-b border-zinc-800 text-[9px] uppercase font-black text-rose-500 tracking-wider">Grau das Magias</th>
                                  </tr>
                                  <tr className="bg-zinc-900 border-b border-zinc-900 text-[8px] uppercase tracking-widest text-zinc-650 font-bold">
                                    <th className="p-2">Nível</th>
                                    <th className="p-2 text-center">Grau 1</th>
                                    <th className="p-2 text-center">Grau 2</th>
                                    <th className="p-2 text-center">Grau 3</th>
                                    <th className="p-2 text-center">Grau 4</th>
                                    <th className="p-2 text-center">Grau 5</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                                  {Array.from({ length: 10 }).map((_, i) => {
                                    const lvl = (i + 1).toString();
                                    const row = cls.spellsPerLevel?.[lvl] || [0, 0, 0, 0, 0];
                                    return (
                                      <tr key={lvl} className="hover:bg-zinc-900/20 text-zinc-400">
                                        <td className="p-3 font-sans font-bold text-zinc-500">Nív {lvl}</td>
                                        {row.map((val, idx) => (
                                          <td key={idx} className="p-3 text-center font-bold text-rose-450/90">{val || '-'}</td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE & EDIT OVERLAY MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-850 rounded-[32px] w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/20 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-500">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                      {editingClass ? 'Editar Classe' : 'Criar Nova Classe'}
                    </h3>
                    <p className="text-[9px] uppercase font-black text-zinc-500 tracking-widest">
                      Defina os parâmetros essenciais de sua classe de RPG
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 bg-zinc-900 border border-zinc-805 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                {/* Nome da Classe, Dado de Vida e Conjurador Checkbox */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400 ml-1">Nome da Classe</label>
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Monge, Bárbaro..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-650"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400 ml-1">Dado de Vida</label>
                    <div className="relative">
                      <select
                        value={hd}
                        onChange={(e) => setHd(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none appearance-none cursor-pointer focus:border-amber-500/50 transition-all"
                      >
                        <option value="1d4">1d4</option>
                        <option value="1d6">1d6</option>
                        <option value="1d8">1d8</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                {/* Weapons and Armor Restrictives */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400 ml-1">Armas Permitidas</label>
                    <input 
                      type="text"
                      required
                      value={weapons}
                      onChange={(e) => setWeapons(e.target.value)}
                      placeholder="Ex: Armas leves, todas as armas corpo-a-corpo..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-semibold text-white outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-650"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950 p-5 border border-zinc-900 rounded-[24px]">
                    {/* Armaduras */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Armaduras Permitidas</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedArmors.length === availableArmors.length) {
                              setSelectedArmors([]);
                            } else {
                              setSelectedArmors([...availableArmors]);
                            }
                          }}
                          className="text-[9px] uppercase font-black text-amber-500 hover:text-amber-400 transition-all border border-amber-500/25 px-2 py-1 rounded bg-amber-500/5"
                        >
                          {selectedArmors.length === availableArmors.length ? 'Nenhuma' : 'Selecionar Todas'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto border border-zinc-850 rounded-xl p-3 bg-zinc-900/40 custom-scrollbar">
                        {availableArmors.map((armor) => {
                          const checked = selectedArmors.includes(armor);
                          return (
                            <label key={armor} className="flex items-center gap-2.5 cursor-pointer select-none text-zinc-300 hover:text-white text-xs py-0.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (checked) {
                                    setSelectedArmors(selectedArmors.filter((a) => a !== armor));
                                  } else {
                                    setSelectedArmors([...selectedArmors, armor]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-zinc-950 focus:ring-amber-500/50"
                              />
                              <span className="font-medium">{armor}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Escudos */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Escudos Permitidos</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedShields.length === availableShields.length) {
                              setSelectedShields([]);
                            } else {
                              setSelectedShields([...availableShields]);
                            }
                          }}
                          className="text-[9px] uppercase font-black text-amber-500 hover:text-amber-400 transition-all border border-amber-500/25 px-2 py-1 rounded bg-amber-500/5"
                        >
                          {selectedShields.length === availableShields.length ? 'Nenhum' : 'Selecionar Todos'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto border border-zinc-850 rounded-xl p-3 bg-zinc-900/40 custom-scrollbar">
                        {availableShields.map((shield) => {
                          const checked = selectedShields.includes(shield);
                          return (
                            <label key={shield} className="flex items-center gap-2.5 cursor-pointer select-none text-zinc-300 hover:text-white text-xs py-0.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (checked) {
                                    setSelectedShields(selectedShields.filter((s) => s !== shield));
                                  } else {
                                    setSelectedShields([...selectedShields, shield]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-zinc-950 focus:ring-amber-500/50"
                              />
                              <span className="font-medium">{shield}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spellcaster Section */}
                <div className="space-y-6 bg-zinc-950 border border-zinc-900 p-6 rounded-[24px]">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                        <Wand2 size={14} className="text-rose-500" /> Conjurador?
                      </h4>
                      <p className="text-[10px] font-medium text-zinc-500 leading-none">Esta classe possui habilidades mágicas ou rituais?</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isSpellcaster}
                        onChange={(e) => setIsSpellcaster(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
                    </label>
                  </div>

                  {isSpellcaster && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6 pt-4 border-t border-zinc-900"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400 ml-1">Tipo de Magia / Conjuração</label>
                        <div className="relative">
                          <select
                            value={magicType}
                            onChange={(e) => setMagicType(e.target.value as any)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none appearance-none cursor-pointer focus:border-amber-500/50 transition-all"
                          >
                            <option value="arcana">Magias Arcanas (Inteligência - INT)</option>
                            <option value="miracle">Milagre (Sabedoria - SAB)</option>
                            <option value="dark">Magia Negra (Carisma - CAR)</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
                        </div>
                      </div>

                      {/* Spell preparation/learning progression grid */}
                      <div className="space-y-3">
                        <label className="text-[10px] uppercase font-black tracking-widest text-rose-500 ml-1 block">
                          Tabela de Progressão de Magias (Quantas por Grau em cada Nível)
                        </label>
                        <div className="overflow-x-auto border border-zinc-900 rounded-xl">
                          <table className="w-full text-left text-xs leading-none">
                            <thead>
                              <tr className="bg-zinc-950 text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
                                <th className="p-2 border-b border-zinc-900"></th>
                                <th colSpan={5} className="p-2 text-center border-b border-zinc-800 text-[9px] uppercase font-black text-rose-500 tracking-wider">Grau das Magias</th>
                              </tr>
                              <tr className="bg-zinc-900 border-b border-zinc-900 text-[8px] uppercase tracking-widest text-zinc-650 font-bold">
                                <th className="p-2">Nível</th>
                                <th className="p-2 text-center">Grau 1</th>
                                <th className="p-2 text-center">Grau 2</th>
                                <th className="p-2 text-center">Grau 3</th>
                                <th className="p-2 text-center">Grau 4</th>
                                <th className="p-2 text-center">Grau 5</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900 font-mono">
                              {Array.from({ length: 10 }).map((_, i) => {
                                const lvl = (i + 1).toString();
                                const row = spellGrid[lvl] || [0, 0, 0, 0, 0];
                                return (
                                  <tr key={lvl} className="hover:bg-zinc-900/10 text-zinc-400">
                                    <td className="p-3 font-sans font-bold text-zinc-500 text-xs">Nív {lvl}</td>
                                    {row.map((val, idx) => (
                                      <td key={idx} className="p-2 text-center">
                                        <input 
                                          type="number"
                                          min={0}
                                          max={99}
                                          value={val}
                                          onChange={(e) => handleCellChange(lvl, idx, parseInt(e.target.value))}
                                          className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-center font-bold text-rose-400 outline-none focus:border-rose-500"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Starting Talents Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <h4 className="text-[10px] uppercase font-black text-zinc-400 tracking-widest flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" /> Talentos Iniciais
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddTalent}
                      className="text-[9px] uppercase font-black text-amber-500 hover:text-amber-400 flex items-center gap-1 py-1.5 px-3 rounded-lg border border-amber-500/10 hover:border-amber-500/30 transition-all bg-amber-500/5"
                    >
                      <Plus size={12} /> Adicionar Talento
                    </button>
                  </div>

                  {startingTalents.length === 0 ? (
                    <div className="py-8 text-center bg-zinc-900/20 border border-dashed border-zinc-850 rounded-2xl">
                      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nenhum talento inicial adicionado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {startingTalents.map((talent, idx) => (
                        <div key={idx} className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-[20px] relative space-y-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveTalent(idx)}
                            className="absolute right-3 top-3 p-1.5 bg-zinc-950 rounded-lg text-rose-500 border border-rose-950/20 hover:border-rose-500/20 transition-all"
                            title="Remover Talento"
                          >
                            <X size={12} />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1 md:col-span-1">
                              <label className="text-[8px] uppercase font-black text-zinc-500 ml-0.5">Nome do Talento</label>
                              <input 
                                type="text"
                                required
                                value={talent.name}
                                onChange={(e) => handleTalentChange(idx, 'name', e.target.value)}
                                placeholder="E.g. Sentidos Aguçados"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500/50"
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <label className="text-[8px] uppercase font-black text-zinc-500 ml-0.5">Descrição do Efeito</label>
                              <AutoResizingTextarea 
                                required
                                value={talent.description}
                                onChange={(e) => handleTalentChange(idx, 'description', e.target.value)}
                                placeholder="Ganhe vantagem em iniciativa e testes de audição."
                                rows={1}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-500/50 resize-none overflow-hidden min-h-[36px]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-900/30 pt-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 hover:text-white text-xs">
                              <input
                                type="checkbox"
                                checked={!!talent.hasUses}
                                onChange={(e) => handleTalentExtraChange(idx, 'hasUses', e.target.checked)}
                                className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-zinc-950 focus:ring-amber-500/50 cursor-pointer"
                              />
                              <span className="font-medium">Habilitar número limitado de usos</span>
                            </label>
                            
                            {talent.hasUses && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-black text-zinc-500">Máximo de usos por dia/descanso:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={talent.maxUses || 1}
                                  onChange={(e) => handleTalentExtraChange(idx, 'maxUses', parseInt(e.target.value) || 1)}
                                  className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-center text-xs font-bold text-white outline-none focus:border-amber-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Buttons */}
                <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    className="w-full sm:flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/10"
                  >
                    Confirmar e Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-6 py-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-black uppercase text-xs tracking-widest rounded-xl border border-zinc-800 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {classToDelete && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-850 rounded-[32px] p-6 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Apagar Classe Permanente?</h3>
              <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
                Esta ação apagará a classe de forma irreversível e removerá todas as suas progressões do grimório customizado. 
                Escreva <span className="text-rose-500 font-mono font-black select-all">APAGAR CLASSE</span> abaixo para prosseguir.
              </p>
              
              <input 
                type="text"
                placeholder="APAGAR CLASSE"
                value={confirmDeleteInput}
                onChange={(e) => setConfirmDeleteInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl mt-4 text-sm font-mono text-center text-white italic outline-none focus:border-rose-500/50 uppercase select-none"
              />

              <div className="flex gap-3 mt-6">
                <button
                  disabled={confirmDeleteInput !== 'APAGAR CLASSE'}
                  onClick={() => handleDeleteClass(classToDelete)}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl disabled:opacity-20 transition-all active:scale-95"
                >
                  Confirmar Exclusão
                </button>
                <button
                  onClick={() => {
                    setClassToDelete(null);
                    setConfirmDeleteInput('');
                  }}
                  className="px-5 py-3.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
