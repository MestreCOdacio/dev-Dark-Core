import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { CharacterState, CharacterClass, Ancestry, ATTR_LABELS } from '../../types';
import { INITIAL_CHARACTER, CLASSES, ANCESTRIES } from '../../constants';
import { handleFirestoreError, OperationType } from '../../utils/errorUtils';
import { DeferredNumberInput } from '../../components/ui/DeferredNumberInput';
import { useAuth } from '../../contexts/AuthContext';

export function CreateCharacterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || localStorage.getItem('shadowdark_userid') || '';
  
  const [loading, setLoading] = useState(false);
  const [customClasses, setCustomClasses] = useState<string[]>([]);
  const [formData, setFormData] = useState<Omit<CharacterState, 'id' | 'userId'>>({
    ...INITIAL_CHARACTER,
    attributes: { ...INITIAL_CHARACTER.attributes },
    hp: { ...INITIAL_CHARACTER.hp }
  });

  useEffect(() => {
    const q = query(collection(db, 'master_classes'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: string[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.name) {
          list.push(d.name);
        }
      });
      setCustomClasses(list);
    }, (e) => {
      console.error(e);
    });
    return () => unsubscribe();
  }, []);

  const availableClasses = [...CLASSES, ...customClasses];

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setLoading(true);
    try {
      const charId = Math.random().toString(36).substring(2, 11);
      const newChar: CharacterState = {
        ...formData,
        id: charId,
        userId: userId,
        campaignId: null,
        hp: { ...formData.hp, current: formData.hp.max }
      };
      await setDoc(doc(db, 'characters', charId), newChar);
      navigate(`/character/${charId}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center gap-6">
          <button onClick={() => navigate('/dashboard')} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Criar Personagem</h1>
            <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest"> Dark Core RPG </p>
          </div>
        </header>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6 md:col-span-2">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome do Herói</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-xl font-bold text-white outline-none focus:border-amber-500/50 transition-all"
                  placeholder="Ex: Ragnar, o Audaz"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nível (0-10)</label>
                  <DeferredNumberInput 
                    min={0} max={10}
                    value={formData.level}
                    onChange={(v) => setFormData(prev => ({ ...prev, level: v }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-lg font-mono font-bold text-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">PV Máximo</label>
                  <DeferredNumberInput 
                    value={formData.hp.max}
                    min={1}
                    onChange={(v) => setFormData(prev => ({ ...prev, hp: { ...prev.hp, max: v } }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-lg font-mono font-bold text-red-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Classe</label>
                <div className="relative">
                  <select 
                    value={formData.class}
                    onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value as CharacterClass }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm font-bold text-white appearance-none outline-none focus:border-amber-500/50 transition-all cursor-pointer"
                  >
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Ancestralidade</label>
                <div className="relative">
                  <select 
                    value={formData.ancestry}
                    onChange={(e) => setFormData(prev => ({ ...prev, ancestry: e.target.value as Ancestry }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm font-bold text-white appearance-none outline-none focus:border-amber-500/50 transition-all cursor-pointer"
                  >
                    {ANCESTRIES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600" size={16} />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Valor dos Atributos</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(Object.entries(formData.attributes) as [keyof CharacterState['attributes'], number][]).map(([key, val]) => (
                  <div key={key} className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center gap-1 group focus-within:border-amber-500/50 transition-all">
                    <span className="text-[8px] font-black uppercase text-zinc-600 tracking-tighter group-hover:text-amber-500 transition-colors">{ATTR_LABELS[key]}</span>
                    <DeferredNumberInput 
                      value={val}
                      min={1} max={99}
                      onChange={(v) => setFormData(prev => ({ 
                        ...prev, 
                        attributes: { ...prev.attributes, [key]: v } 
                      }))}
                      className="w-full bg-transparent text-center text-xl font-mono font-bold text-white outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl shadow-lg transition-all active:scale-95"
          >
            {loading ? 'Criando...' : 'Criar Ficha'}
          </button>
        </div>
      </div>
    </div>
  );
}
