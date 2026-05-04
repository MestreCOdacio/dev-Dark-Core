/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Heart, 
  Zap, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUp, 
  ChevronsDown,
  User,
  Users,
  Sword,
  Swords,
  Target,
  X,
  Sparkles,
  Award,
  Bed,
  ChevronRight,
  History,
  Plus,
  ArrowLeft,
  ChevronLeft,
  Trash2,
  Backpack,
  Check,
  AlertTriangle,
  Search,
  Dices,
  Minus,
  Map,
  Settings,
  BookOpen,
  Clock
} from 'lucide-react';
import { 
  CharacterState, 
  ATTR_LABELS, 
  getModifier, 
  formatModifier,
  ArmorType,
  CharacterClass,
  Ancestry,
  Campaign,
  UserProfile,
  RollLog,
  InventoryItem,
  ItemType,
  Spell,
  SpellType,
  Trait
} from './types';
import { db, auth } from './firebase';
import { TRAITS_DATA } from './data/traits';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { CLASSES, ANCESTRIES } from './constants';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  // Use current user UID or a neutral placeholder for logging
  const currentUid = auth.currentUser?.uid || 'no-auth-session';
  const customId = localStorage.getItem('shadowdark_userid') || 'guest';

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: { 
      userId: currentUid,
      localCustomId: customId
    },
    operationType,
    path
  };

  console.error(`[Firestore Error] ${operationType} on ${path}:`, errMessage);
  
  if (errMessage.includes('permission-denied') || errMessage.includes('insufficient permissions')) {
    alert('Erro de Permissão: Você não tem autorização para realizar esta ação no banco de dados.');
  } else if (errMessage.includes('unavailable')) {
    alert('Erro de Conexão: O banco de dados parece estar offline ou inacessível.');
  } else {
    alert(`Erro no Banco de Dados (${operationType}): ${errMessage}`);
  }

  throw new Error(JSON.stringify(errInfo));
}

// Simple D20 Icon component
const D20Icon = ({ size = 18 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 2l10 5-10 5-10-5 10-5z" />
    <path d="M2 7l10 5 10-5" />
    <path d="M2 7l10 15 10-15" />
    <path d="M12 22V12" />
    <path d="M17 9.5L12 12l-5-2.5" />
  </svg>
);

interface RollNotification {
  id: string;
  type: 'crit-success' | 'crit-fail' | 'normal' | 'virtue' | 'sanity-success' | 'sanity-fail';
  value: number;
  modifier: number;
  attributeLabel: string;
  r1?: number;
  r2?: number;
  advDis?: 'advantage' | 'disadvantage' | null;
  timestamp: number;
}

const ARMOR_VALUES = {
  none: 10,
  leather: 11,
  chainmail: 13,
  plate: 15
};

const ARMOR_LABELS = {
  none: 'Sem Armadura',
  leather: 'Couro',
  chainmail: 'Cota de Malha',
  plate: 'Placas'
};

const getStressColor = (val: number) => {
  // Every 4 points of stress, shift color from soft yellow to strong orange
  if (val < 4) return 'bg-amber-300';
  if (val < 8) return 'bg-amber-500';
  if (val < 12) return 'bg-amber-600';
  if (val < 16) return 'bg-orange-600';
  return 'bg-orange-800';
};

// Initial state
const INITIAL_CHARACTER: Omit<CharacterState, 'id' | 'userId'> = {
  name: 'Explorador Sem Nome',
  level: 1,
  xp: 0,
  class: 'Guerreiro',
  ancestry: 'Humano',
  attributes: {
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
  },
  advDis: {},
  armor: {
    type: 'none',
    magicBonus: 0
  },
  shield: {
    active: false,
    magicBonus: 0
  },
  hp: {
    current: 8,
    max: 8,
    temp: 0,
  },
  inventory: [],
  spells: [],
  currency: { po: 0, pp: 0, pc: 0 },
  afflictions: [],
  virtues: [],
  stress: 1,
  virtueMargin: 2,
};

const generateAccessCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const playDiceSound = () => {
  const audio = new Audio('/sounds/som-dado.mp3');
  audio.volume = 0.3;
  audio.play().catch(e => console.log('Audio play failed:', e));
};

export default function App() {
  const [view, setView] = useState<'login' | 'player-home' | 'dashboard' | 'create' | 'sheet' | 'gm-dashboard' | 'gm-campaign-list' | 'gm-create' | 'gm-campaign' | 'gm-manage-ids' | 'player-campaign-list' | 'player-campaign' | 'gm-manage-systems' | 'gm-shadowdark-menu' | 'gm-shadowdark-spells'>('login');
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('shadowdark_userid'));
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    console.log("Firebase Auth Status:", auth.currentUser ? `User: ${auth.currentUser.uid}` : "No Auth Session");
    if (userId) {
      localStorage.setItem('shadowdark_userid', userId);
      
      const syncSession = async () => {
        try {
          // Tentamos buscar, mas se falhar (permissão), usamos fallback local
          const customDocSnap = await getDoc(doc(db, 'users', userId));
          if (customDocSnap.exists()) {
            const profile = customDocSnap.data() as UserProfile;
            setUserProfile(profile);
            if (profile.role === 'Mestre') setView('gm-dashboard');
            else setView('player-home');
            return;
          }
        } catch (e) {
          console.warn("Firestore profile sync failed, using fallback:", e);
        }

        // Fallback or Initial logic
        if (userId === 'MESTRE') {
          const mestreProfile: UserProfile = {
            id: 'MESTRE',
            nickname: 'Mestre do Jogo',
            role: 'Mestre',
            createdAt: new Date().toISOString()
          };
          setUserProfile(mestreProfile);
          setView('gm-dashboard');
        } else {
          setView('player-home');
        }
      };
      
      syncSession();
    }
  }, [userId]);

  if (!userId || view === 'login') {
    return <LoginPage onLogin={setUserId} onGMLogin={() => setUserId('MESTRE')} />;
  }

  if (view === 'gm-dashboard') {
    return (
      <GMDashboardPage 
        onViewCampaigns={() => setView('gm-campaign-list')}
        onManageIds={() => setView('gm-manage-ids')}
        onManageSystems={() => setView('gm-manage-systems')}
        onLogout={() => { setUserId(null); localStorage.removeItem('shadowdark_userid'); setView('login'); }}
      />
    );
  }

  if (view === 'gm-manage-systems') {
    return (
      <ManageSystemsPage 
        onSelectShadowdark={() => setView('gm-shadowdark-menu')}
        onBack={() => setView('gm-dashboard')}
      />
    );
  }

  if (view === 'gm-shadowdark-menu') {
    return (
      <ShadowdarkMenuPage 
        onSelectSpells={() => setView('gm-shadowdark-spells')}
        onBack={() => setView('gm-manage-systems')}
      />
    );
  }

  if (view === 'gm-shadowdark-spells') {
    return (
      <ShadowdarkSpellsPage 
        onBack={() => setView('gm-shadowdark-menu')}
      />
    );
  }

  if (view === 'gm-campaign-list') {
    return (
      <GMCampaignListPage 
        onSelectCampaign={(id) => { setSelectedCampaignId(id); setView('gm-campaign'); }}
        onCreateCampaign={() => setView('gm-create')}
        onBack={() => setView('gm-dashboard')}
        onLogout={() => { setUserId(null); localStorage.removeItem('shadowdark_userid'); setView('login'); }}
      />
    );
  }

  if (view === 'gm-manage-ids') {
    return (
      <ManageIDsPage onBack={() => setView('gm-dashboard')} />
    );
  }

  if (view === 'player-home') {
    return (
      <PlayerHomePage 
        userId={userId}
        profile={userProfile}
        onUpdateProfile={(p) => setUserProfile(p)}
        onGoToSheets={() => setView('dashboard')}
        onGoToCampaigns={() => setView('player-campaign-list')}
        onLogout={() => { setUserId(null); localStorage.removeItem('shadowdark_userid'); setView('login'); }}
      />
    );
  }

  if (view === 'player-campaign-list') {
    return (
      <PlayerCampaignListPage 
        userId={userId}
        onSelectCampaign={(id) => { setSelectedCampaignId(id); setView('player-campaign'); }}
        onBack={() => setView('player-home')}
      />
    );
  }

  if (view === 'player-campaign' && selectedCampaignId) {
    return (
      <CampaignViewPage 
        campaignId={selectedCampaignId}
        userId={userId}
        mode="player"
        onBack={() => { setSelectedCampaignId(null); setView('player-campaign-list'); }}
        onOpenSheet={(id) => { setSelectedCharId(id); setView('sheet'); }}
      />
    );
  }

  if (view === 'gm-create') {
    return (
      <CreateCampaignPage 
        onCreated={(id) => { setSelectedCampaignId(id); setView('gm-campaign'); }}
        onBack={() => setView('gm-dashboard')}
      />
    );
  }

  if (view === 'gm-campaign' && selectedCampaignId) {
    return (
      <CampaignViewPage 
        campaignId={selectedCampaignId}
        userId={userId}
        mode="gm"
        onBack={() => { setSelectedCampaignId(null); setView('gm-campaign-list'); }}
        onOpenSheet={(id) => { setSelectedCharId(id); setView('sheet'); }}
      />
    );
  }

  if (view === 'dashboard') {
    return (
      <DashboardPage 
        userId={userId} 
        onSelectChar={(id) => { setSelectedCharId(id); setView('sheet'); }}
        onCreateChar={() => setView('create')}
        onLogout={() => { setUserId(null); localStorage.removeItem('shadowdark_userid'); setView('login'); }}
      />
    );
  }

  if (view === 'create') {
    return (
      <CreateCharacterPage 
        userId={userId} 
        onCreated={(id) => { setSelectedCharId(id); setView('sheet'); }}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'sheet' && selectedCharId) {
    return (
      <CharacterSheet 
        charId={selectedCharId} 
        userProfile={userProfile}
        onBack={() => { 
          setSelectedCharId(null); 
          if (userId === 'MESTRE' && selectedCampaignId) {
            setView('gm-campaign');
          } else if (userId === 'MESTRE') {
            setView('gm-dashboard');
          } else if (selectedCampaignId) {
            setView('player-campaign');
          } else {
            setView('dashboard'); 
          }
        }} 
      />
    );
  }

  return <div className="min-h-screen bg-[#0c0c0e]" />;
}

function DeferredNumberInput({ 
  value, 
  onChange, 
  className,
  min,
  max,
  placeholder
}: { 
  value: number, 
  onChange: (v: number) => void,
  className?: string,
  min?: number,
  max?: number,
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleSync = () => {
    let n = parseInt(localValue);
    if (isNaN(n)) n = min ?? 0;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
    setLocalValue(n.toString());
  };

  return (
    <input 
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSync}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleSync();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

function UserSearchModal({ 
  onSelect, 
  onClose,
  existingIds = [],
  title = "Adicionar Jogador",
  description = "Pesquise por ID ou Nome"
}: { 
  onSelect: (userId: string) => void, 
  onClose: () => void,
  existingIds?: string[],
  title?: string,
  description?: string
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserProfile[] = [];
        snap.forEach(d => list.push(d.data() as UserProfile));
        setUsers(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filtered = users.filter(u => 
    u.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{title}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{description}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text"
              autoFocus
              placeholder="Buscar por ID ou Nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 transition-all font-bold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <p className="text-center text-zinc-600 italic py-8">Carregando usuários...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-zinc-600 italic py-8">Nenhum usuário encontrado.</p>
          ) : (
            filtered.map(u => {
              const isAdded = existingIds.includes(u.id);
              return (
                <div 
                  key={u.id}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isAdded ? 'bg-amber-500/5 border-amber-500/20' : 'bg-zinc-950 border-zinc-800'}`}
                >
                  <div>
                    <div className="text-sm font-bold text-white uppercase italic">{u.nickname || 'Inominado'}</div>
                    <div className="text-[10px] font-mono text-zinc-600 font-bold">ID: {u.id}</div>
                  </div>
                  {isAdded ? (
                    <button 
                      onClick={() => onSelect(u.id)}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-[9px] font-black uppercase text-rose-500 transition-all active:scale-95"
                    >
                      Remover
                    </button>
                  ) : (
                    <button 
                      onClick={() => onSelect(u.id)}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-500/50 transition-all active:scale-95"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CharacterSearchModal({ 
  onSelect, 
  onClose,
  userIds 
}: { 
  onSelect: (charId: string) => void, 
  onClose: () => void,
  userIds: string[]
}) {
  const [chars, setChars] = useState<CharacterState[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const list: CharacterState[] = [];
        if (userIds.length > 0) {
          // Chunk userIds to avoid Firestore 'in' limit (max 30, but playing safe with 10 or 30)
          const CHUNK_SIZE = 30; 
          for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
            const chunk = userIds.slice(i, i + CHUNK_SIZE);
            const q = query(
              collection(db, 'characters'), 
              where('userId', 'in', chunk)
            );
            const snap = await getDocs(q);
            snap.forEach(d => {
              const char = sanitizeCharacter(d.data(), d.id);
              // Filter in memory to handle undefined/null campaignId
              if (!char.campaignId) {
                list.push(char);
              }
            });
          }
        } else {
          const q = query(collection(db, 'characters'));
          const snap = await getDocs(q);
          snap.forEach(d => {
            const char = sanitizeCharacter(d.data(), d.id);
            if (!char.campaignId) {
              list.push(char);
            }
          });
        }
        setChars(list);

        // Fetch nicknames for all characters found
        const uIds = Array.from(new Set(list.map(c => c.userId)));
        const nickMap: Record<string, string> = {};
        for (const uid of uIds) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            nickMap[uid] = (uSnap.data() as UserProfile).nickname || uid;
          } else {
            nickMap[uid] = uid;
          }
        }
        setNicknames(nickMap);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userIds]);

  const filtered = chars.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (nicknames[c.userId] || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Adicionar Personagem</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Selecione uma ficha para participar</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text"
              autoFocus
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 transition-all font-bold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <p className="text-center text-zinc-600 italic py-8">Carregando fichas...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-zinc-600 italic py-8">Nenhuma ficha disponível.</p>
          ) : (
            filtered.map(c => (
              <button 
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 transition-all text-left group"
              >
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-500 transition-colors uppercase italic">{c.name}</div>
                  <div className="text-[10px] font-mono text-zinc-600 font-bold">{c.ancestry} {c.class} • Jogador: {nicknames[c.userId] || c.userId}</div>
                </div>
                <Plus size={16} className="text-zinc-700 group-hover:text-amber-500 transition-colors" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SpellSelectionModal({ onSelect, onClose }: { onSelect: (spell: Spell) => void, onClose: () => void }) {
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/99 backdrop-blur-xl">
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

const sanitizeCharacter = (data: any, id: string): CharacterState => {
  return {
    ...INITIAL_CHARACTER,
    ...data,
    id,
    attributes: {
      ...INITIAL_CHARACTER.attributes,
      ...(data.attributes || {})
    },
    hp: {
      ...INITIAL_CHARACTER.hp,
      ...(data.hp || {})
    },
    inventory: data.inventory || [],
    spells: data.spells || [],
    currency: data.currency || { po: 0, pp: 0, pc: 0 },
    afflictions: data.afflictions || [],
    virtues: data.virtues || [],
    armor: data.armor || { type: 'none', magicBonus: 0 },
    shield: data.shield || { active: false, magicBonus: 0 },
    advDis: data.advDis || { ...INITIAL_CHARACTER.advDis }
  };
};

function CharacterSheet({ charId, onBack, userProfile }: { charId: string, onBack: () => void, userProfile: UserProfile | null }) {
  const [character, setCharacter] = useState<CharacterState | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'equip' | 'talents' | 'spell' | 'traits' | 'extra'>('status');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', slots: 1, description: '', type: 'Item' as ItemType });

  const spellcasters: CharacterClass[] = ['Sacerdote', 'Mago', 'Bruxa', 'Cavaleiro Amaldiçoado'];
  const isSpellcaster = character ? spellcasters.includes(character.class) : false;

  useEffect(() => {
    const fetchChar = () => {
      const docRef = doc(db, 'characters', charId);
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setCharacter(sanitizeCharacter(docSnap.data(), docSnap.id));
        }
        setLoading(false);
      }, (e) => {
        handleFirestoreError(e, OperationType.GET, `characters/${charId}`);
        setLoading(false);
      });
    };
    const unsubscribe = fetchChar();
    return () => unsubscribe();
  }, [charId]);

  const updateCharacterInDB = async (updates: Partial<CharacterState>) => {
    if (!character) return;
    try {
      // Clean undefined values to avoid Firestore errors
      const cleanUpdates = JSON.parse(JSON.stringify(updates));
      await updateDoc(doc(db, 'characters', charId), cleanUpdates);
    } catch (e) {
      console.error("Failed to update character:", e);
    }
  };

  const addItem = async () => {
    if (!character) return;
    if (newItem.name.length === 0) return;
    
    const currentWeight = (character.inventory || []).reduce((acc, item) => acc + item.slots, 0);
    const maxWeight = Math.max(character.attributes.STR, 10);
    
    if (currentWeight + newItem.slots > maxWeight) {
      alert(`Peso total excedido! Limite atual: ${maxWeight}. Espaço necessário: ${newItem.slots}.`);
      return;
    }

    const itemToAdd = {
      id: Math.random().toString(36).substring(2, 11),
      name: newItem.name.substring(0, 30),
      slots: Math.max(0, newItem.slots),
      description: newItem.description.substring(0, 250),
      type: newItem.type
    };

    const updatedInventory = [...character.inventory, itemToAdd];
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
    setIsItemModalOpen(false);
    setNewItem({ name: '', slots: 1, description: '' });
  };

  const removeItem = async (itemId: string) => {
    if (!character) return;
    const updatedInventory = character.inventory.filter(i => i.id !== itemId);
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
  };

  const [isSpellModalOpen, setIsSpellModalOpen] = useState(false);
  const [spellToRemove, setSpellToRemove] = useState<string | null>(null);
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);

  const addSpell = async (spell: Spell) => {
    if (!character) return;
    if (character.spells.some(s => s.id === spell.id)) return;
    
    const updatedSpells = [...character.spells, spell].sort((a, b) => a.name.localeCompare(b.name));
    setCharacter(prev => prev ? { ...prev, spells: updatedSpells } : null);
    await updateCharacterInDB({ spells: updatedSpells });
  };

  const removeSpell = async (spellId: string) => {
    if (!character) return;
    const updatedSpells = character.spells.filter(s => s.id !== spellId);
    setCharacter(prev => prev ? { ...prev, spells: updatedSpells } : null);
    await updateCharacterInDB({ spells: updatedSpells });
    setSpellToRemove(null);
  };
  
  const [isTraitModalOpen, setIsTraitModalOpen] = useState(false);
  const [traitToRemove, setTraitToRemove] = useState<{ id: string, type: 'affliction' | 'virtue' } | null>(null);
  const [healingAfflictionId, setHealingAfflictionId] = useState<string | null>(null);
  const [sanityResult, setSanityResult] = useState<'success' | 'fail' | 'virtue' | null>(null);
  const [showVirtueChoice, setShowVirtueChoice] = useState(false);
  const [sanityLimitMessage, setSanityLimitMessage] = useState<string | null>(null);
  const [rolledTrait, setRolledTrait] = useState<{ trait: Trait, type: 'affliction' | 'virtue', isAggravated?: boolean } | null>(null);

  const logTraitRoll = async (trait: Trait, type: 'affliction' | 'virtue', customLabel?: string) => {
    if (!character) return;
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: type === 'virtue' ? 'virtue' : 'normal',
        value: trait.roll,
        modifier: 0,
        label: customLabel || (type === 'virtue' ? `Rolou Virtude: ${trait.name}` : `Rolou Aflição: ${trait.name}`),
        timestamp: Date.now(),
        advantageMode: 'none'
      });
    } catch (e) {
      console.error("Failed to log trait roll:", e);
    }
  };

  const rollTrait = async (type: 'affliction' | 'virtue') => {
    if (!character) return;
    
    if (type === 'virtue') {
      const maxVirtues = Math.max(1, character.afflictions.length);
      if (character.virtues.length >= maxVirtues) {
        setSanityLimitMessage("Você não possui aflições o suficiente para mais uma virtude.");
        return;
      }
    }

    let roll = Math.floor(Math.random() * 10) + 1;
    let isAggravated = false;
    
    if (type === 'affliction' && roll === 10) {
      isAggravated = true;
      roll = Math.floor(Math.random() * 9) + 1;
    }

    if (type === 'virtue' && roll === 10) {
      setShowVirtueChoice(true);
      setSanityResult(null);
      return;
    }

    const traitDataList = type === 'affliction' ? TRAITS_DATA.afflictions : TRAITS_DATA.virtues;
    const oppositeList = type === 'affliction' ? character.virtues : character.afflictions;
    
    let attempts = 0;
    let targetRoll = roll;
    let trait = traitDataList.find(t => t.roll === targetRoll);

    while (attempts < 50) {
      const opposite = oppositeList.find(o => o.roll === targetRoll);
      const duplicate = (type === 'affliction' ? character.afflictions : character.virtues).find(d => d.roll === targetRoll);

      if (!opposite && (!duplicate || (type === 'affliction' && !duplicate.isAggravated))) {
        trait = traitDataList.find(t => t.roll === targetRoll);
        break;
      }

      targetRoll = Math.floor(Math.random() * 9) + 1;
      attempts++;
    }
    
    if (trait) {
      if (type === 'affliction') {
        const existing = character.afflictions.find(a => a.name === trait!.name);
        const label = `Rolou Aflição: ${trait.name}${isAggravated ? ' (Agravada)' : ''}`;
        await logTraitRoll(trait as any, 'affliction', label);

        if (existing) {
          await upgradeToAggravated(existing.id);
          setRolledTrait({ trait: { ...trait, isAggravated: true } as any, type: 'affliction', isAggravated: true });
        } else {
          await addAffliction({ ...trait, isAggravated } as any);
          setRolledTrait({ trait: trait as any, type: 'affliction', isAggravated });
        }
      } else {
        await logTraitRoll(trait as any, 'virtue');
        await addVirtue(trait as any);
        setRolledTrait({ trait: trait as any, type: 'virtue' });
      }
    }
    setSanityResult(null);
  };

  const upgradeToAggravated = async (id: string) => {
    if (!character) return;
    const updated = character.afflictions.map(a => 
      a.id === id ? { ...a, isAggravated: true, healProgress: 0 } : a
    );
    setCharacter(p => p ? { ...p, afflictions: updated } : null);
    await updateCharacterInDB({ afflictions: updated });
  };

  const addAffliction = async (trait: Trait) => {
    if (!character) return;
    const existingIndex = character.afflictions.findIndex(a => a.name === trait.name);
    
    let updatedAfflictions;
    if (existingIndex !== -1) {
      // If already exists and not aggravated, upgrade it
      if (!character.afflictions[existingIndex].isAggravated) {
        updatedAfflictions = [...character.afflictions];
        updatedAfflictions[existingIndex] = { ...updatedAfflictions[existingIndex], isAggravated: true, healProgress: 0 };
      } else {
        // If already aggravated, this shouldn't happen due to re-roll, but just in case
        return;
      }
    } else {
      const newTrait: Trait = { 
        id: crypto.randomUUID(),
        name: trait.name,
        description: trait.description,
        roll: trait.roll
      };
      
      if (trait.isAggravated) {
        newTrait.isAggravated = true;
        newTrait.healProgress = 0;
      }
      
      updatedAfflictions = [...character.afflictions, newTrait];
    }
    
    setCharacter(prev => prev ? { ...prev, afflictions: updatedAfflictions } : null);
    await updateCharacterInDB({ afflictions: updatedAfflictions });
  };

  const addVirtue = async (trait: Trait) => {
    if (!character) return;
    const maxVirtues = Math.max(1, character.afflictions.length);
    if (character.virtues.length >= maxVirtues) {
       alert("Você não possui aflições o suficiente para mais uma virtude.");
       return;
    }
    if (character.virtues.some(v => v.name === trait.name)) return;
    const newTrait: Trait = {
      id: crypto.randomUUID(),
      name: trait.name,
      description: trait.description,
      roll: trait.roll
    };
    const updatedVirtues = [...character.virtues, newTrait];
    setCharacter(prev => prev ? { ...prev, virtues: updatedVirtues } : null);
    await updateCharacterInDB({ virtues: updatedVirtues });
  };

  const handleHealAffliction = async (afflictionId: string) => {
    if (!character) return;
    const affliction = character.afflictions.find(a => a.id === afflictionId);
    if (!affliction) return;

    if (affliction.isAggravated) {
      const progress = (affliction.healProgress || 0) + 1;
      if (progress < 2) {
        const updated = character.afflictions.map(a => 
          a.id === afflictionId ? { ...a, healProgress: progress } : a
        );
        setCharacter(p => p ? { ...p, afflictions: updated } : null);
        await updateCharacterInDB({ afflictions: updated });
        return;
      }
    }

    if (character.virtues.length > 0) {
      setHealingAfflictionId(afflictionId);
    } else {
      removeAffliction(afflictionId);
    }
  };

  const removeAffliction = async (id: string) => {
    if (!character) return;
    const updated = character.afflictions.filter(a => a.id !== id);
    setCharacter(p => p ? { ...p, afflictions: updated } : null);
    await updateCharacterInDB({ afflictions: updated });
  };

  const removeVirtue = async (id: string) => {
    if (!character) return;
    const updated = character.virtues.filter(v => v.id !== id);
    setCharacter(p => p ? { ...p, virtues: updated } : null);
    await updateCharacterInDB({ virtues: updated });
  };

  const completeHealing = async (virtueId: string) => {
    if (!character || !healingAfflictionId) return;
    const updatedAfflictions = character.afflictions.filter(a => a.id !== healingAfflictionId);
    const updatedVirtues = character.virtues.filter(v => v.id !== virtueId);
    setCharacter(p => p ? { ...p, afflictions: updatedAfflictions, virtues: updatedVirtues } : null);
    await updateCharacterInDB({ afflictions: updatedAfflictions, virtues: updatedVirtues });
    setHealingAfflictionId(null);
  };

  const [notifications, setNotifications] = useState<RollNotification[]>([]);
  const [history, setHistory] = useState<RollNotification[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTempHPOpen, setIsTempHPOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const [customDice, setCustomDice] = useState<Record<string, number>>({ '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 });
  const [customModifier, setCustomModifier] = useState<number>(0);
  const [isCustomDiceOpen, setIsCustomDiceOpen] = useState(false);
  const [lastCustomResult, setLastCustomResult] = useState<{ rolls: { d: number, v: number }[], total: number } | null>(null);

  const rollCustomDice = async () => {
    playDiceSound();
    const results: { d: number, v: number }[] = [];
    let diceSum = 0;
    
    Object.entries(customDice).forEach(([d, count]) => {
      const dieSize = parseInt(d);
      const dieCount = count as number;
      for (let i = 0; i < dieCount; i++) {
        const roll = Math.floor(Math.random() * dieSize) + 1;
        results.push({ d: dieSize, v: roll });
        diceSum += roll;
      }
    });

    if (results.length === 0) return;

    const total = diceSum + customModifier;
    setLastCustomResult({ rolls: results, total });

    const diceLabels = Object.entries(customDice)
      .filter(([_, count]) => (count as number) > 0)
      .map(([d, count]) => `${count}d${d}`)
      .join(' + ');
    
    const fullLabel = `Dados: ${diceLabels}${customModifier !== 0 ? ` ${customModifier > 0 ? '+' : ''}${customModifier}` : ''}`;

    const newNotify: RollNotification = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'normal',
      value: diceSum,
      modifier: customModifier,
      attributeLabel: fullLabel,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotify, ...prev].slice(0, 3));
    setHistory(prev => [newNotify, ...prev].slice(0, 50));

    // Save to Firestore
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character!.name,
        userId: character!.userId,
        type: 'normal',
        value: diceSum,
        modifier: customModifier,
        label: fullLabel,
        timestamp: Date.now(),
        advantageMode: 'none'
      });
    } catch (e) {
      console.error("Failed to sync custom roll:", e);
    }
    
    setIsCustomDiceOpen(false);
  };

  if (loading) return <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Carregando Ficha...</div>;
  if (!character) return <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest">Ficha não encontrada.</div>;

  const maxXP = character.level * 10;

  const updateAttribute = (key: keyof CharacterState['attributes'], val: number) => {
    const newValue = Math.max(1, Math.min(99, val));
    setCharacter(prev => prev ? {
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: newValue,
      }
    } : null);
    updateCharacterInDB({
      attributes: {
        ...character!.attributes,
        [key]: newValue
      }
    });
  };

  const updateHP = (amount: number) => {
    setCharacter(prev => {
      if (!prev) return null;
      let newTemp = prev.hp.temp;
      let newCurrent = prev.hp.current;

      if (amount < 0) {
        // Damage: reduce temp HP first
        const damage = Math.abs(amount);
        if (newTemp > 0) {
          if (newTemp >= damage) {
            newTemp -= damage;
          } else {
            const remainingDamage = damage - newTemp;
            newTemp = 0;
            newCurrent = Math.max(0, newCurrent - remainingDamage);
          }
        } else {
          newCurrent = Math.max(0, newCurrent - damage);
        }
      } else {
        // Healing: only regular HP
        newCurrent = Math.max(0, Math.min(prev.hp.max, prev.hp.current + amount));
      }

      const updatedHP = {
        ...prev.hp,
        current: newCurrent,
        temp: newTemp
      };

      updateCharacterInDB({ hp: updatedHP });

      return {
        ...prev,
        hp: updatedHP
      };
    });
  };

  const updateTempHP = (val: number) => {
    setCharacter(prev => {
      if (!prev) return null;
      // Temp HP doesn't stack, you keep the higher
      if (val > prev.hp.temp) {
        const updatedHP = { ...prev.hp, temp: val };
        updateCharacterInDB({ hp: updatedHP });
        return {
          ...prev,
          hp: updatedHP
        };
      }
      return prev;
    });
  };

  const clearTempHP = () => {
    setCharacter(prev => {
      if (!prev) return null;
      const updatedHP = { ...prev.hp, temp: 0 };
      updateCharacterInDB({ hp: updatedHP });
      return { ...prev, hp: updatedHP };
    });
  };

  const updateXP = (amount: number) => {
    if (!character) return;
    const newXP = Math.max(0, Math.min(character.level * 10, character.xp + amount));
    const realAmount = newXP - character.xp;
    if (realAmount === 0) return;

    setCharacter(prev => prev ? { ...prev, xp: newXP } : null);
    updateCharacterInDB({ xp: newXP });

    // Log XP (if positive)
    if (realAmount > 0) {
      const rollRef = doc(collection(db, 'rolls'));
      setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: 'normal',
        value: realAmount,
        modifier: 0,
        label: `Ganhou ${realAmount} XP`,
        timestamp: Date.now(),
        advantageMode: 'none'
      }).catch(e => console.error("History log failed:", e));
    }
  };

  const levelUp = async () => {
    if (!character) return;
    const maxXPNeeded = character.level * 10;
    if (character.xp < maxXPNeeded) return;
    
    const newLevel = character.level + 1;
    setCharacter(prev => prev ? { ...prev, level: newLevel, xp: 0 } : null);
    await updateCharacterInDB({ level: newLevel, xp: 0 });

    // Log Level Up
    const rollRef = doc(collection(db, 'rolls'));
    await setDoc(rollRef, {
      id: rollRef.id,
      characterId: charId,
      characterName: character.name,
      userId: character.userId,
      type: 'virtue', 
      value: newLevel,
      modifier: 0,
      label: `Subiu para o Nível ${newLevel}!`,
      timestamp: Date.now(),
      advantageMode: 'none'
    });
    
    // Artificial delay to prevent rapid-click race conditions during state transition
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const handleClearHistory = async () => {
    try {
      const q = query(collection(db, 'rolls'), where('characterId', '==', charId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      setHistory([]);
      setNotifications([]);
    } catch (e) {
      console.error("Failed to clear history from DB:", e);
      setHistory([]);
      setNotifications([]);
    }
  };

  const handleDeleteCharacter = async () => {
    if (confirmInput === 'CONFIRMO') {
      try {
        await deleteDoc(doc(db, 'characters', charId));
        onBack();
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `characters/${charId}`);
      }
    }
  };

  const updateStress = (amount: number) => {
    if (!character) return;
    const newStress = Math.max(1, Math.min(20, character.stress + amount));
    setCharacter(prev => prev ? { ...prev, stress: newStress } : null);
    updateCharacterInDB({ stress: newStress });
  };

  const toggleAdvDis = (attrKey: keyof CharacterState['attributes'], type: 'advantage' | 'disadvantage') => {
    setCharacter(prev => ({
      ...prev,
      advDis: {
        ...prev.advDis,
        [attrKey]: prev.advDis[attrKey] === type ? null : type
      }
    }));
  };

  const calcAC = () => {
    let base = ARMOR_VALUES[character.armor.type];
    const dexMod = getModifier(character.attributes.DEX);
    
    // Plate armor ignores DEX
    const dexToAdd = character.armor.type === 'plate' ? 0 : dexMod;
    const shieldBonus = character.shield.active ? 2 : 0;
    
    return base + dexToAdd + shieldBonus + character.armor.magicBonus + character.shield.magicBonus;
  };

  const handleSanityRoll = async () => {
    if (!character) return;
    playDiceSound();
    const roll = Math.floor(Math.random() * 20) + 1;
    const margin = character.virtueMargin || 2;
    const isVirtue = roll >= (20 - margin);
    const isSuccess = roll > character.stress;
    
    let type: RollNotification['type'] = 'normal';
    if (isVirtue) {
      type = 'virtue';
      setSanityResult('virtue');
    } else if (isSuccess) {
      type = 'sanity-success';
      setSanityResult('success');
    } else {
      type = 'sanity-fail';
      setSanityResult('fail');
    }
    
    const label = 'Teste de Sanidade';
    
    const newNotify: RollNotification = {
      id: Date.now().toString(),
      type,
      value: roll,
      modifier: 0,
      attributeLabel: label,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotify, ...prev].slice(0, 3));
    setHistory(prev => [newNotify, ...prev].slice(0, 50));

    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type,
        value: roll,
        modifier: 0,
        label,
        timestamp: Date.now(),
        advantageMode: 'none'
      });
    } catch (e) {
      console.error("Failed to sync sanity roll:", e);
    }

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotify.id));
    }, 5000);
  };

  const handleRoll = async (attrKey: keyof CharacterState['attributes']) => {
    playDiceSound();
    const advDis = character!.advDis[attrKey];
    let roll: number;
    let r1: number | undefined;
    let r2: number | undefined;
    
    if (advDis === 'advantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.max(r1, r2);
    } else if (advDis === 'disadvantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.min(r1, r2);
    } else {
      roll = Math.floor(Math.random() * 20) + 1;
    }

    const mod = getModifier(character.attributes[attrKey]);
    const label = ATTR_LABELS[attrKey];
    
    let type: RollNotification['type'] = 'normal';
    if (roll === 20) type = 'crit-success';
    if (roll === 1) type = 'crit-fail';

    const newNotify: RollNotification = {
      id: Date.now().toString(),
      type,
      value: roll,
      modifier: mod,
      attributeLabel: label,
      r1,
      r2,
      advDis,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotify, ...prev].slice(0, 3));
    setHistory(prev => [newNotify, ...prev].slice(0, 50));

    // Save to Firestore for GM
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type,
        value: roll,
        modifier: mod,
        label,
        timestamp: Date.now(),
        advantageMode: advDis || 'none'
      });
    } catch (e) {
      console.error("Failed to sync roll:", e);
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotify.id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#e4e4e7] p-4 md:p-8 font-sans selection:bg-amber-500/30">
      <style>{`
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      
      {/* Background Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#3f3f46_0%,transparent_70%)]" />
      </div>

      <main className="relative max-w-5xl mx-auto space-y-10">
        {/* Header Section */}
        <header className="space-y-6 px-2">
          <div className="flex items-center gap-2 mb-4">
             <button 
                onClick={onBack}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] uppercase font-black tracking-widest group w-fit"
              >
                <div className="p-1 rounded bg-zinc-900 border border-zinc-800 group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all">
                  <ChevronLeft size={14} />
                </div>
                Voltar
              </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black">
                Nome do Personagem
              </label>
              
              <div className="flex items-center justify-end">
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-start gap-6">
              <div className="flex-1 min-w-0 max-w-2xl relative group/name">
                {isEditingName ? (
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      autoFocus
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setCharacter(p => p ? ({ ...p, name: tempName }) : null);
                          updateCharacterInDB({ name: tempName });
                          setIsEditingName(false);
                        }
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      onBlur={() => {
                        setCharacter(p => p ? ({ ...p, name: tempName }) : null);
                        updateCharacterInDB({ name: tempName });
                        setIsEditingName(false);
                      }}
                      className="bg-zinc-950 border-b-2 border-amber-500 text-5xl md:text-6xl font-black text-white outline-none p-0 w-full italic"
                    />
                    <button 
                      onClick={() => {
                        setCharacter(p => p ? ({ ...p, name: tempName }) : null);
                        updateCharacterInDB({ name: tempName });
                        setIsEditingName(false);
                      }}
                      className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 hover:bg-amber-500/20 transition-all"
                    >
                      <Check size={24} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <h1 className="text-5xl md:text-6xl font-black text-white italic truncate leading-tight">
                      {character.name}
                    </h1>
                    <button 
                      onClick={() => {
                        setTempName(character.name);
                        setIsEditingName(true);
                      }}
                      className="mt-2 p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 hover:text-amber-500 hover:border-amber-500/50 transition-all opacity-0 group-hover/name:opacity-100"
                      title="Editar Nome"
                    >
                      <EditIcon size={18} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 pb-1">
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl h-[58px] overflow-hidden">
                  <div className="flex items-center gap-2 px-6 border-r border-zinc-800/50 h-full bg-zinc-950/30">
                    <span className="text-[11px] uppercase text-zinc-400 font-black tracking-widest whitespace-nowrap">{character.ancestry} {character.class}</span>
                  </div>
                  <button 
                    onClick={() => setIsHistoryOpen(true)}
                    className="px-6 h-full text-zinc-400 hover:text-white transition-all active:scale-95 flex items-center gap-3 group hover:bg-zinc-800/50"
                    title="Ver Histórico de Rolagens"
                  >
                    <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500 group-hover:text-amber-500 transition-colors font-black">Histórico</div>
                    <History size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Level & XP Integrated Bar */}
          <div className="bg-zinc-950/40 p-1 rounded-[2.5rem] border border-zinc-800/60 backdrop-blur-md">
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-0">
                <div className="md:col-span-2 flex flex-col items-center justify-center gap-1 py-8 border-r border-zinc-800/40">
                  <span className="text-[9px] uppercase text-zinc-600 font-black tracking-widest mb-1">Nível</span>
                  {localStorage.getItem('shadowdark_userid') === 'MESTRE' ? (
                    <DeferredNumberInput
                      value={character.level}
                      onChange={(v) => {
                        const newLevel = Math.max(0, Math.min(10, v));
                        setCharacter(p => p ? {...p, level: newLevel} : null);
                        updateCharacterInDB({ level: newLevel });
                      }}
                      className="text-5xl font-mono font-black text-amber-500 bg-transparent w-full text-center outline-none focus:text-amber-400 transition-colors p-0 border-none"
                      min={0}
                      max={10}
                    />
                  ) : (
                    <span className="text-5xl font-mono font-black text-amber-500 leading-none">
                      {character.level.toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
                
                <div className="md:col-span-10 space-y-4 px-10">
                  <div className="flex justify-between items-end px-1">
                     <div className="flex items-baseline gap-3">
                        <span className="text-[11px] uppercase font-black tracking-[0.2em] text-zinc-500">Experiência</span>
                        <div className="flex items-center gap-1">
                          {localStorage.getItem('shadowdark_userid') === 'MESTRE' ? (
                            <DeferredNumberInput
                              value={character.xp}
                              onChange={(v) => updateXP(v - character.xp)}
                              className="bg-transparent text-2xl font-black font-mono w-16 outline-none text-white focus:text-amber-500 transition-colors text-right"
                              min={0}
                              max={maxXP}
                            />
                          ) : (
                            <span className="text-2xl font-black font-mono text-white w-16 text-right">{character.xp}</span>
                          )}
                          <span className="text-zinc-700 text-xl font-mono">/</span>
                          <span className="text-zinc-600 font-mono text-xl font-black">{maxXP}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <AnimatePresence>
                         {character.xp >= maxXP && (
                           <motion.button
                             initial={{ scale: 0.8, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             exit={{ scale: 0.8, opacity: 0 }}
                             disabled={isLevelingUp}
                             onClick={async () => {
                               if (isLevelingUp) return;
                               setIsLevelingUp(true);
                               await levelUp();
                               setIsLevelingUp(false);
                             }}
                             className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3 rounded-xl disabled:opacity-50 active:scale-95 transition-all shadow-lg"
                           >
                             Subir de Nível
                           </motion.button>
                         )}
                       </AnimatePresence>
                     </div>
                  </div>
                <div className="relative h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 p-0.5">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${(character.xp / maxXP) * 100}%` }}
                    className="absolute inset-y-0 left-0 bg-amber-600 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800/50 pb-px gap-4 px-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button 
            onClick={() => setActiveTab('status')}
            className={`pb-4 px-2 text-[10px] uppercase font-black tracking-widest transition-all relative ${activeTab === 'status' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Status
            {activeTab === 'status' && <motion.div layoutId="activeTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('equip')}
            className={`pb-4 px-2 text-[10px] uppercase font-black tracking-widest transition-all relative ${activeTab === 'equip' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Equipamentos
            {activeTab === 'equip' && <motion.div layoutId="activeTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('talents')}
            className={`pb-4 px-2 text-[10px] uppercase font-black tracking-widest transition-all relative ${activeTab === 'talents' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Talentos
            {activeTab === 'talents' && <motion.div layoutId="activeTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
          {isSpellcaster && (
            <button 
              onClick={() => setActiveTab('spell')}
              className={`pb-4 px-2 text-[10px] uppercase font-black tracking-widest transition-all relative ${activeTab === 'spell' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Magias
              {activeTab === 'spell' && <motion.div layoutId="activeTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
            </button>
          )}
          <button 
            onClick={() => setActiveTab('traits')}
            className={`pb-4 px-2 text-[10px] uppercase font-black tracking-widest transition-all relative ${activeTab === 'traits' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Aflições & Virtudes
            {activeTab === 'traits' && <motion.div layoutId="activeTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('extra')}
            className={`pb-4 px-2 text-[10px] uppercase font-black tracking-widest transition-all relative ${activeTab === 'extra' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Extras <span className="opacity-40">(Breve)</span>
            {activeTab === 'extra' && <motion.div layoutId="activeTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
          <div className="flex-1" />
          <button 
            onClick={() => {
              setCustomDice({ '4': 0, '6': 0, '8': 0, '10': 0, '12': 0 });
              setCustomModifier(0);
              setIsCustomDiceOpen(true);
            }}
            className="pb-4 px-2 text-zinc-600 hover:text-amber-500 transition-colors"
            title="Rolar Dados"
          >
            <Dices size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'status' && (
            <motion.div 
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2"
            >
              
              {/* Column 1: Core Attributes */ }
              <section className="space-y-4">
                <div className="px-2 mb-2">
                  <h2 className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 font-black">Atributos</h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {(Object.entries(character.attributes) as [keyof CharacterState['attributes'], number][]).map(([key, val]) => (
                    <AttributeCard 
                      key={key}
                      value={val}
                      label={ATTR_LABELS[key]}
                      advDisStatus={character.advDis[key]}
                      onUpdate={(v) => updateAttribute(key, v)}
                      onRoll={() => handleRoll(key)}
                      onToggleAdvDis={(type) => toggleAdvDis(key, type)}
                    />
                  ))}
                </div>
              </section>

              {/* Column 2: Vitality (HP & Stress) */}
              <section className="space-y-8">
                <div className="px-2 mb-2">
                  <h2 className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 font-black">Medidores</h2>
                </div>
                
                {/* HP Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl relative group overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <button 
                      onClick={() => setIsTempHPOpen(!isTempHPOpen)}
                      className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all ${isTempHPOpen || character.hp.temp > 0 ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-700'}`}
                    >
                      <Zap size={16} fill={character.hp.temp > 0 ? "currentColor" : "none"} className={character.hp.temp > 0 ? "animate-pulse" : ""} />
                    </button>
                    <AnimatePresence>
                      {isTempHPOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-16 right-4 bg-zinc-950 border border-sky-900/50 p-3 rounded-2xl z-40 flex items-center gap-3 min-w-[140px]"
                        >
                          <input 
                            type="number" 
                            autoFocus
                            placeholder="Temp"
                            className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-sm font-mono font-bold text-sky-400 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateTempHP(parseInt((e.target as HTMLInputElement).value) || 0);
                                setIsTempHPOpen(false);
                              }
                            }}
                          />
                          <button onClick={() => { clearTempHP(); setIsTempHPOpen(false); }} className="text-xs font-black text-rose-500">LIMPAR</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600 ml-1 mb-1">Pontos de Vida</span>
                      <div className="flex items-baseline gap-2">
                        <DeferredNumberInput
                          value={character.hp.current}
                          onChange={(v) => updateHP(v - character.hp.current)}
                          className="bg-transparent text-6xl font-black font-mono text-red-500 w-16 outline-none focus:ring-0 text-center"
                        />
                        {character.hp.temp > 0 && (
                          <span className="text-sky-400 text-2xl font-black">+{character.hp.temp}</span>
                        )}
                        <span className="text-zinc-800 text-4xl font-black">/</span>
                        <DeferredNumberInput
                          value={character.hp.max}
                          onChange={(v) => setCharacter(prev => ({ ...prev!, hp: { ...prev!.hp, max: v } }))}
                          min={1}
                          className="bg-transparent text-4xl font-black font-mono text-zinc-700 w-16 outline-none hover:text-zinc-400 transition-colors text-center"
                        />
                      </div>
                    </div>

                    <div className="h-4 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex shadow-inner">
                      <motion.div 
                        initial={false}
                        animate={{ width: `${(character.hp.current / Math.max(character.hp.max, character.hp.current + character.hp.temp)) * 100}%` }}
                        className="h-full bg-red-600"
                      />
                      {character.hp.temp > 0 && (
                        <motion.div 
                          initial={false}
                          animate={{ width: `${(character.hp.temp / Math.max(character.hp.max, character.hp.current + character.hp.temp)) * 100}%` }}
                          className="h-full bg-sky-500"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <StatButton label="-5" onClick={() => updateHP(-5)} variant="danger" icon={<ChevronsDown size={14} />} />
                      <StatButton label="-1" onClick={() => updateHP(-1)} variant="danger" icon={<ChevronDown size={14} />} />
                      <StatButton label="+1" onClick={() => updateHP(1)} variant="success" icon={<ChevronUp size={14} />} />
                      <StatButton label="+5" onClick={() => updateHP(5)} variant="success" icon={<ChevronsUp size={14} />} />
                    </div>
                  </div>
                </div>

                {/* Stress Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl relative group/card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600 ml-1 mb-1">Acúmulo de Estresse</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-6xl font-black font-mono leading-none ${character.stress >= 15 ? "text-amber-500" : "text-amber-600"}`}>
                          {character.stress.toString().padStart(2, '0')}
                        </span>
                        <span className="text-zinc-800 text-3xl font-black">/</span>
                        <span className="text-zinc-700 text-3xl font-black">20</span>
                      </div>
                    </div>
                    <button 
                      onClick={handleSanityRoll}
                      className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-600 hover:text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all active:scale-95"
                      title="Teste de Sanidade"
                    >
                      <Dices size={20} />
                    </button>
                  </div>

                  <div className="flex gap-1 h-3">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm transition-all duration-300 border border-black/20 ${
                          i < character.stress ? getStressColor(i) : 'bg-zinc-950 border-zinc-900'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <StatButton label="-5" onClick={() => updateStress(-5)} variant="neutral" icon={<ChevronsDown size={14} />} />
                    <StatButton label="-1" onClick={() => updateStress(-1)} variant="neutral" icon={<ChevronDown size={14} />} />
                    <StatButton label="+1" onClick={() => updateStress(1)} variant="warning" icon={<ChevronUp size={14} />} />
                    <StatButton label="+5" onClick={() => updateStress(5)} variant="warning" icon={<ChevronsUp size={14} />} />
                  </div>
                  
                  <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                    <p className="text-[10px] text-zinc-500 font-bold italic tracking-wide leading-loose">
                       "A sanidade é uma chama frágil na escuridão. Proteja-a a todo custo."
                    </p>
                  </div>
                </div>
              </section>

              {/* Column 3: Combat (AC & Gear) */}
              <section className="space-y-8">
                <div className="px-2 mb-2">
                  <h2 className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 font-black">Combate</h2>
                </div>

                {/* AC Shield Display */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col gap-8 shadow-2xl relative group overflow-hidden">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,#27272a_0%,transparent_100%)] opacity-50" />
                   <div className="relative z-10 flex items-center gap-8">
                     <div className="relative">
                        <Shield size={100} className="text-zinc-800/80" strokeWidth={0.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                           <span className="text-6xl font-black font-mono text-white">
                             {calcAC()}
                           </span>
                        </div>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600 mb-1">Defesa</span>
                       <span className="text-xl font-black uppercase text-white italic tracking-tighter">Classe de Armadura</span>
                     </div>
                   </div>

                   {/* Integrated Armor/Shield Controls */}
                   <div className="w-full space-y-6 relative border-t border-zinc-800 pt-8 z-20">
                     <div className="space-y-4">
                       <label className="text-[9px] uppercase font-black tracking-widest text-zinc-600 ml-1">Equipamento Defensivo</label>
                       
                       <div className="flex flex-col gap-4">
                         {/* Armor Selector row */}
                         <div className="flex items-center gap-3">
                           <div className="relative flex-1">
                             <select 
                               value={character.armor.type}
                               onChange={(e) => setCharacter(prev => ({ ...prev, armor: { ...prev.armor, type: e.target.value as ArmorType } }))}
                               className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-xs font-bold text-white appearance-none cursor-pointer focus:border-amber-500/50 outline-none hover:bg-zinc-900 transition-all shadow-inner"
                             >
                               {(Object.keys(ARMOR_VALUES) as ArmorType[]).map(type => (
                                 <option key={type} value={type}>{ARMOR_LABELS[type]}</option>
                               ))}
                             </select>
                           </div>
                           
                           {character.armor.type !== 'none' && (
                             <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-2xl border border-zinc-800">
                                <label className="text-[8px] uppercase font-black text-zinc-700 ml-1">Magia: </label>
                                <MagicBonusButton 
                                  value={character.armor.magicBonus} 
                                  onSelect={(v) => setCharacter(prev => ({ ...prev, armor: { ...prev.armor, magicBonus: v } }))} 
                                />
                                {character.armor.magicBonus > 0 && <span className="text-[10px] font-black text-amber-500">+{character.armor.magicBonus}</span>}
                             </div>
                           )}
                         </div>
                         
                         <div className="flex flex-col gap-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                               <button 
                                 onClick={() => setCharacter(prev => ({ ...prev, shield: { ...prev.shield, active: !prev.shield.active } }))}
                                 className={`flex items-center gap-3 group`}
                               >
                                 <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${character.shield.active ? 'bg-amber-600 border-amber-500 shadow-lg text-white' : 'bg-transparent border-zinc-800 text-zinc-700 hover:border-zinc-600'}`}>
                                   <Shield size={18} fill={character.shield.active ? "currentColor" : "none"} />
                                 </div>
                                 <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${character.shield.active ? 'text-white' : 'text-zinc-600'}`}>Escudo (+2)</span>
                               </button>
                             </div>
                             
                             {character.shield.active && (
                               <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800">
                                  <label className="text-[8px] uppercase font-black text-zinc-700 ml-1">Magia: </label>
                                  <MagicBonusButton 
                                    value={character.shield.magicBonus} 
                                    onSelect={(v) => setCharacter(prev => ({ ...prev, shield: { ...prev.shield, magicBonus: v } }))} 
                                  />
                                  {character.shield.magicBonus > 0 && <span className="text-[10px] font-black text-amber-500">+{character.shield.magicBonus}</span>}
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'equip' && (
            <motion.div 
              key="equip"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 px-2"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Inventário</h3>
                     <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Gerencie sua carga e equipamentos</p>
                   </div>
                   <button 
                    onClick={() => setIsItemModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2"
                   >
                     <Plus size={16} /> Adicionar Item
                   </button>
                </div>
                
                {/* Currency Section - Circular Format */}
                <div className="flex justify-center gap-6 py-2 border-b border-zinc-800/30">
                  {[
                    { key: 'po', label: 'PO', color: 'border-amber-500/30 bg-amber-500/5 text-amber-500' },
                    { key: 'pp', label: 'PP', color: 'border-zinc-500/30 bg-zinc-500/5 text-zinc-400' },
                    { key: 'pc', label: 'PC', color: 'border-orange-700/30 bg-orange-700/5 text-orange-700' }
                  ].map(({ key, label, color }) => (
                    <div key={key} className="flex flex-col items-center gap-2">
                       <div className={`w-16 h-16 rounded-full border ${color} flex flex-col items-center justify-center relative overflow-hidden transition-all group`}>
                          <label className="text-[7px] font-black uppercase tracking-tighter opacity-60 mb-0.5">
                            {label}
                          </label>
                          <input 
                            type="number"
                            value={character.currency[key as keyof typeof character.currency]}
                            onChange={(e) => {
                               const val = parseInt(e.target.value) || 0;
                               const updatedCurrency = { ...character.currency, [key]: val };
                               setCharacter(p => p ? { ...p, currency: updatedCurrency } : null);
                               updateCharacterInDB({ currency: updatedCurrency });
                            }}
                            className="w-full bg-transparent border-none text-lg font-black text-white text-center focus:outline-none focus:ring-0 p-0 relative z-10"
                            style={{ MozAppearance: 'textfield' }}
                          />
                       </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Carga Atual</span>
                    <div className="font-mono text-sm font-bold">
                      <span className={`${((character?.inventory || []).reduce((acc, i) => acc + i.slots, 0) || 0) > Math.max(character?.attributes.STR || 0, 10) ? 'text-red-500' : 'text-amber-500'}`}>
                        {(character?.inventory || []).reduce((acc, i) => acc + i.slots, 0)}
                      </span>
                      <span className="text-zinc-600"> / {Math.max(character?.attributes.STR || 0, 10)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
                    <motion.div 
                      initial={false}
                      animate={{ width: `${Math.min(100, (((character?.inventory || []).reduce((acc, i) => acc + i.slots, 0) || 0) / Math.max(character?.attributes.STR || 0, 10)) * 100)}%` }}
                      className={`h-full transition-colors ${
                        ((character?.inventory || []).reduce((acc, i) => acc + i.slots, 0) || 0) > Math.max(character?.attributes.STR || 0, 10) ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {character?.inventory.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl opacity-50">
                      <Backpack size={32} className="mx-auto text-zinc-800 mb-2" />
                      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nenhum item carregado</p>
                    </div>
                  )}
                  {character?.inventory.map(item => (
                    <div key={item.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-white italic truncate">{item.name}</span>
                          <span className="text-[8px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 font-mono">{item.slots} Espaço(s)</span>
                        </div>
                        <p className="text-[10px] text-zinc-600 line-clamp-1">{item.description}</p>
                      </div>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-zinc-800 hover:text-rose-500 transition-colors ml-4"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'talents' && (
            <motion.div 
              key="talents"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 px-2"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8 min-h-[300px] flex items-center justify-center">
                 <div className="text-center space-y-2 opacity-30">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Talentos</h3>
                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Nenhum talento adquirido por enquanto</p>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'spell' && (
            <motion.div 
              key="spell"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 px-2"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">MAGIAS</h3>
                     <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Suas magias preparadas e conhecidas</p>
                   </div>
                   <button 
                    onClick={() => setIsSpellModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2 active:scale-95"
                   >
                     <Plus size={16} /> Aprender Magia
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {character?.spells.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl opacity-50">
                      <Sparkles size={32} className="mx-auto text-zinc-800 mb-2" />
                      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nenhuma magia aprendida</p>
                    </div>
                  )}
                  {character?.spells.map(spell => (
                    <motion.div 
                      key={spell.id}
                      layout
                      className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all group"
                    >
                      <div 
                        onClick={() => setExpandedSpellId(expandedSpellId === spell.id ? null : spell.id)}
                        className="p-6 cursor-pointer relative"
                      >
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpellToRemove(spell.id);
                          }}
                          className="absolute top-4 right-4 p-2 text-zinc-800 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                              {(Array.isArray(spell.type) ? spell.type : [spell.type]).map(t => (
                                <span key={t} className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${
                                  t === 'Milagre' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                                  t === 'Magia Negra' ? 'bg-purple-950/20 border-purple-500/30 text-purple-400' :
                                  'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                }`}>
                                  {t === 'Magia' ? 'Arcano' : t}
                                </span>
                              ))}
                            </div>
                            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest leading-none">Grau {spell.tier}</span>
                          </div>
                          <h4 className="text-lg font-black text-white italic uppercase tracking-tight leading-none group-hover:text-amber-500 transition-colors">{spell.name}</h4>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedSpellId === spell.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-zinc-900 bg-black/20"
                          >
                            <div className="p-6 pt-0 space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-[9px] uppercase font-black text-zinc-500 mt-4">
                                <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                                   <Zap size={12} className="text-zinc-600" /> 
                                   <div className="flex flex-col">
                                      <span className="text-[7px] text-zinc-700">Alcance</span>
                                      <span className="text-zinc-300">{spell.range}</span>
                                   </div>
                                </div>
                                <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                                   <Clock size={12} className="text-zinc-600" /> 
                                   <div className="flex flex-col">
                                      <span className="text-[7px] text-zinc-700">Duração</span>
                                      <span className="text-zinc-300">{spell.duration}</span>
                                   </div>
                                </div>
                              </div>

                              <p className="text-[11px] text-zinc-400 leading-relaxed italic border-t border-zinc-900 pt-4">
                                {spell.description}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'traits' && (
            <motion.div 
              key="traits"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 px-2"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Aflições & Virtudes</h3>
                     <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Traços que moldam sua mente e alma</p>
                   </div>
                   {userProfile?.role === 'Mestre' && (
                      <button 
                        onClick={() => setIsTraitModalOpen(true)}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2"
                      >
                        <Settings size={16} /> Gerenciar
                      </button>
                   )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Afflictions */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                       <div className="w-2 h-2 rounded-full bg-rose-500" />
                       <h4 className="text-[10px] uppercase font-black text-rose-500 tracking-widest">Aflições</h4>
                    </div>
                    <div className="space-y-4">
                      {character?.afflictions.length === 0 ? (
                        <div className="py-8 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl opacity-50">
                           <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nenhuma aflição ativa</p>
                        </div>
                      ) : (
                        character.afflictions.map(a => (
                          <div key={a.id} className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl space-y-4 relative group">
                             <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                   <div className="flex items-center gap-2">
                                     <h5 className="text-lg font-black text-white italic uppercase tracking-tight">{a.name}</h5>
                                     {a.isAggravated && (
                                       <span className="text-[7px] font-black bg-rose-500 text-white px-1 py-0.5 rounded uppercase tracking-widest">Agravada</span>
                                     )}
                                   </div>
                                   {a.isAggravated && (
                                      <div className="flex gap-1">
                                         <div className={`w-1.5 h-1.5 rounded-full border border-rose-500/50 ${(a.healProgress || 0) >= 1 ? 'bg-rose-500' : 'bg-transparent'}`} />
                                         <div className={`w-1.5 h-1.5 rounded-full border border-rose-500/50 ${(a.healProgress || 0) >= 2 ? 'bg-rose-500' : 'bg-transparent'}`} />
                                      </div>
                                   )}
                                </div>
                                <button 
                                  onClick={() => handleHealAffliction(a.id)}
                                  className="text-[9px] font-black uppercase border border-rose-500/50 px-3 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                >
                                  Curar
                                </button>
                             </div>
                             <p className="text-[10px] text-zinc-400 italic leading-relaxed">{a.description}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Virtues */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                       <div className="w-2 h-2 rounded-full bg-sky-500" />
                       <h4 className="text-[10px] uppercase font-black text-sky-500 tracking-widest">Virtudes</h4>
                       <span className="text-[9px] text-zinc-600 ml-auto font-bold uppercase tracking-widest">
                          Limite: {character.virtues.length} / {Math.max(1, character.afflictions.length)}
                       </span>
                    </div>
                    <div className="space-y-4">
                      {character?.virtues.length === 0 ? (
                        <div className="py-8 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl opacity-50">
                           <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nenhuma virtude ativa</p>
                        </div>
                      ) : (
                        character.virtues.map(v => (
                          <div key={v.id} className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl space-y-3 relative group">
                             <div className="flex items-center justify-between">
                                <h5 className="text-lg font-black text-white italic uppercase tracking-tight">{v.name}</h5>
                                {userProfile?.role === 'Mestre' && (
                                   <button 
                                    onClick={() => removeVirtue(v.id)}
                                    className="p-2 text-zinc-800 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                   >
                                    <Trash2 size={14} />
                                   </button>
                                )}
                             </div>
                             <p className="text-[10px] text-zinc-400 italic leading-relaxed">{v.description}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'extra' && (
             <motion.div 
              key="extra"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-20 text-center space-y-4 px-2"
            >
              <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
                <Sparkles size={40} className="text-zinc-600" />
              </div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-zinc-700">Recurso em Desenvolvimento</h3>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-800">Em Breve</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Item Add Modal */}
        <AnimatePresence>
          {isItemModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-8 space-y-8"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Novo Item</h2>
                  <button onClick={() => setIsItemModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome do Item</label>
                    <input 
                      type="text" 
                      maxLength={30}
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({...prev, name: e.target.value}))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all font-mono italic"
                      placeholder="Ex: Espada de Ferro"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Tipo de Item</label>
                    <div className="relative">
                      <select 
                        value={newItem.type}
                        onChange={(e) => setNewItem(prev => ({...prev, type: e.target.value as ItemType}))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all font-mono italic appearance-none cursor-pointer"
                      >
                        <option value="Item">Item</option>
                        <option value="Arma" disabled className="text-zinc-700">Arma (Indisponível)</option>
                        <option value="Proteção" disabled className="text-zinc-700">Proteção (Indisponível)</option>
                        <option value="Pacote" disabled className="text-zinc-700">Pacote (Indisponível)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Espaços (Carga)</label>
                    <input 
                      type="number" 
                      min={0}
                      value={newItem.slots}
                      onChange={(e) => setNewItem(prev => ({...prev, slots: parseInt(e.target.value) || 0}))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white font-mono font-bold outline-none focus:border-amber-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Descrição</label>
                    <textarea 
                      maxLength={250}
                      value={newItem.description}
                      onChange={(e) => setNewItem(prev => ({...prev, description: e.target.value}))}
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-xs text-white font-bold outline-none focus:border-amber-500/50 transition-all resize-none"
                      placeholder="Breve descrição do item..."
                    />
                    <div className="text-[8px] text-right text-zinc-700 uppercase font-black tracking-tighter">
                      {newItem.description.length}/250
                    </div>
                  </div>
                </div>

                <button 
                  onClick={addItem}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl shadow-lg transition-all active:scale-95"
                >
                  Adicionar ao Inventário
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-16 text-center border-t border-zinc-900/50 pt-8 pb-12 opacity-30">
        <span className="text-[10px] font-black tracking-[0.5em] uppercase grayscale">Dark Core RPG</span>
      </footer>

      {/* Notifications Popups */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`pointer-events-auto p-4 pr-10 rounded-xl shadow-2xl border-l-4 min-w-[200px] relative backdrop-blur-md ${
                n.type === 'crit-success' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100' :
                n.type === 'crit-fail' ? 'bg-rose-950/80 border-rose-500 text-red-100' :
                n.type === 'virtue' ? 'bg-amber-500/20 border-amber-500 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]' :
                n.type === 'sanity-success' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100' :
                n.type === 'sanity-fail' ? 'bg-rose-950/80 border-rose-500 text-red-100' :
                'bg-zinc-900/80 border-zinc-500 text-zinc-100'
              }`}
            >
              <button 
                onClick={() => removeNotification(n.id)}
                className="absolute top-2 right-2 text-current opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
              
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-1">
                Rolagem de {n.attributeLabel}
              </div>
              
              <div className="font-bold text-sm">
                {n.type === 'crit-success' ? (
                  <span className="text-emerald-400 font-black uppercase tracking-tighter text-xl">Sucesso Crítico!</span>
                ) : n.type === 'crit-fail' ? (
                  <span className="text-rose-400 font-black uppercase tracking-tighter text-xl">Falha Crítica!</span>
                ) : n.type === 'virtue' ? (
                  <div className="flex flex-col">
                    <span className="text-amber-400 font-black uppercase tracking-tighter text-xl">VIRTUDE!</span>
                    <span className="text-white text-lg font-mono">Rolou: {n.value}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2 font-mono text-lg">
                      <span>{n.value}</span>
                      <span className="text-zinc-500 text-sm">{n.modifier >= 0 ? '+' : ''}{n.modifier}</span>
                      <span className="text-zinc-400 text-base">= {n.value + n.modifier}</span>
                    </div>
                    {(n.type === 'sanity-success' || n.type === 'sanity-fail') && (
                      <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border self-start ${
                        n.type === 'sanity-success' ? 'text-emerald-400 border-emerald-500/30' : 'text-rose-400 border-rose-500/30'
                      }`}>
                        {n.type === 'sanity-success' ? 'Sucesso' : 'Fracasso'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {n.advDis && n.type === 'normal' && n.r1 !== undefined && n.r2 !== undefined && (
                <div className="mt-2 flex gap-2 items-center text-[10px] font-mono opacity-50">
                  <span className={n.r1 === n.value ? "text-white font-bold underline" : ""}>{n.r1}</span>
                  <span>/</span>
                  <span className={n.r2 === n.value ? "text-white font-bold underline" : ""}>{n.r2}</span>
                  <span className="ml-1 uppercase tracking-tighter">({n.advDis === 'advantage' ? 'Vantagem' : 'Desvan.'})</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#121214] border-l border-zinc-800 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="text-amber-500" size={20} />
                  <h2 className="text-lg font-bold uppercase tracking-widest text-white italic">Histórico</h2>
                </div>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2 opacity-50">
                    <Sword size={40} strokeWidth={1} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Nenhuma rolagem ainda</span>
                  </div>
                ) : (
                  history.map((entry) => (
                    <div 
                      key={entry.id}
                      className={`p-4 rounded-xl border border-zinc-800 transition-all ${
                        entry.type === 'crit-success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                        entry.type === 'crit-fail' ? 'bg-rose-500/5 border-rose-500/20' :
                        entry.type === 'virtue' ? 'bg-amber-500/10 border-amber-500/30' :
                        entry.type === 'sanity-success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                        entry.type === 'sanity-fail' ? 'bg-rose-500/5 border-rose-500/20' :
                        'bg-zinc-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          {entry.attributeLabel}
                        </span>
                        <span className="text-[8px] font-mono text-zinc-600">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-mono font-black ${
                            entry.type === 'crit-success' || entry.type === 'sanity-success' ? 'text-emerald-500' :
                            entry.type === 'crit-fail' || entry.type === 'sanity-fail' ? 'text-rose-500' :
                            entry.type === 'virtue' ? 'text-amber-500' :
                            'text-white'
                          }`}>
                            {entry.value + entry.modifier}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono">
                            {entry.value} ({entry.modifier >= 0 ? '+' : ''}{entry.modifier})
                          </span>
                        </div>
                        
                        {entry.advDis ? (
                          <div className="flex gap-1 items-center bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                            <span className={`text-[8px] font-bold uppercase tracking-tighter ${
                              entry.advDis === 'advantage' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {entry.advDis === 'advantage' ? 'VAN' : 'DES'}
                            </span>
                          </div>
                        ) : (entry.type === 'sanity-success' || entry.type === 'sanity-fail' || entry.type === 'virtue') && (
                          <div className={`flex gap-1 items-center bg-zinc-950 px-2 py-0.5 rounded border ${
                            entry.type === 'virtue' ? 'border-amber-500/50' : 
                            entry.type === 'sanity-success' ? 'border-emerald-500/50' : 'border-rose-500/50'
                          }`}>
                            <span className={`text-[8px] font-bold uppercase tracking-tighter ${
                              entry.type === 'virtue' ? 'text-amber-500' : 
                              entry.type === 'sanity-success' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {entry.type === 'virtue' ? 'VIRTUDE' : entry.type === 'sanity-success' ? 'SUCESSO' : 'FRACASSO'}
                            </span>
                          </div>
                        )}
                      </div>

                      {entry.advDis && entry.type === 'normal' && entry.r1 !== undefined && entry.r2 !== undefined && (
                        <div className="mt-2 flex gap-2 items-center text-[9px] font-mono opacity-40">
                          <span className={entry.r1 === entry.value ? "text-white font-bold underline" : ""}>{entry.r1}</span>
                          <span>/</span>
                          <span className={entry.r2 === entry.value ? "text-white font-bold underline" : ""}>{entry.r2}</span>
                        </div>
                      )}

                      {entry.type === 'crit-success' && (
                        <div className="mt-1 text-[8px] font-black uppercase text-emerald-500 tracking-widest">
                          Sucesso Crítico
                        </div>
                      )}
                      {entry.type === 'crit-fail' && (
                        <div className="mt-1 text-[8px] font-black uppercase text-rose-500 tracking-widest">
                          Falha Crítica
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {history.length > 0 && (
                <div className="p-4 border-t border-zinc-800">
                  <button 
                    onClick={handleClearHistory}
                    className="w-full py-3 bg-zinc-900 hover:bg-rose-950/20 text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-rose-500 transition-all rounded-xl border border-zinc-800 hover:border-rose-900/30"
                  >
                    Limpar Histórico
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Dice Roller Modal */}
      <AnimatePresence>
        {isCustomDiceOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 mb-20">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomDiceOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Dices className="text-amber-500" size={20} />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white italic">Rolar Dados</h2>
                </div>
                <button onClick={() => setIsCustomDiceOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-5 gap-3">
                  {[4, 6, 8, 10, 12].map(d => (
                    <button 
                      key={d}
                      onClick={() => setCustomDice(prev => ({ ...prev, [d.toString()]: (prev[d.toString()] || 0) + 1 }))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCustomDice(prev => ({ ...prev, [d.toString()]: Math.max(0, (prev[d.toString()] || 0) - 1) }));
                      }}
                      className="group relative h-16 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/50 transition-all active:scale-95"
                    >
                      <div className="text-[10px] uppercase font-black text-zinc-500 group-hover:text-amber-500 leading-none mb-1">d{d}</div>
                      <div className="text-xl font-mono font-black text-white">{customDice[d.toString()] || 0}</div>
                      {(customDice[d.toString()] || 0) > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] font-black text-black">
                          {customDice[d.toString()]}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest pl-1">Modificador</label>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setCustomModifier(prev => prev - 1)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
                    >
                      <Minus size={16} />
                    </button>
                    <input 
                      type="number" 
                      value={customModifier}
                      onChange={(e) => setCustomModifier(parseInt(e.target.value) || 0)}
                      className="flex-1 h-10 bg-zinc-900 border border-zinc-800 rounded-lg text-center font-mono font-bold text-white focus:outline-none focus:border-amber-500/50"
                    />
                    <button 
                      onClick={() => setCustomModifier(prev => prev + 1)}
                      className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="mb-4 text-center">
                    <div className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest mb-1">Fórmula Atual</div>
                    <div className="text-sm font-mono text-amber-500 font-bold">
                      {Object.entries(customDice).filter(([_, count]) => (count as number) > 0).length > 0
                        ? `${Object.entries(customDice)
                            .filter(([_, count]) => (count as number) > 0)
                            .map(([d, count]) => `${count}d${d}`)
                            .join(' + ')} ${customModifier !== 0 ? (customModifier > 0 ? `+ ${customModifier}` : `- ${Math.abs(customModifier)}`) : ''}`
                        : 'Nenhum dado selecionado'}
                    </div>
                  </div>
                  
                  <button 
                    disabled={Object.values(customDice).every(v => (v as number) === 0)}
                    onClick={rollCustomDice}
                    className="w-full h-14 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-amber-500/10 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Dices size={20} />
                    Rolar Dados
                  </button>
                  <p className="text-[9px] text-zinc-500 text-center mt-3 uppercase font-bold">
                    Clique esquerdo para adicionar • Clique direito para remover
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Dice Result Modal */}
      <AnimatePresence>
        {lastCustomResult && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLastCustomResult(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm"
            >
              <div className="text-center space-y-6">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-black tracking-[0.3em] text-amber-500/50">Resultado</div>
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-mono font-black text-white tracking-tight drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  >
                    {lastCustomResult.total}
                  </motion.div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 px-4 max-h-[40vh] overflow-y-auto pt-4 pb-4">
                  {lastCustomResult.rolls.map((r, i) => (
                    <motion.div 
                      key={i}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center shadow-lg"
                    >
                      <span className="text-[8px] font-black text-zinc-500 uppercase leading-none mb-1">d{r.d}</span>
                      <span className="text-lg font-mono font-black text-white leading-none">{r.v}</span>
                    </motion.div>
                  ))}
                  {customModifier !== 0 && (
                     <motion.div 
                      className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center shadow-lg"
                    >
                      <span className="text-[8px] font-black text-zinc-500 uppercase leading-none mb-1">Mod</span>
                      <span className="text-lg font-mono font-black text-amber-500 leading-none">{customModifier > 0 ? '+' : ''}{customModifier}</span>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={() => setLastCustomResult(null)}
                  className="px-8 py-3 bg-zinc-900 border border-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-zinc-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {healingAfflictionId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-lg w-full space-y-6 shadow-2xl"
             >
               <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Escolha o Sacrifício</h3>
                  <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest leading-relaxed">
                    Para curar esta aflição, você deve abrir mão de uma de suas virtudes.
                  </p>
               </div>

               <div className="space-y-3">
                  {character?.virtues.map(v => (
                    <button 
                      key={v.id}
                      onClick={() => completeHealing(v.id)}
                      className="w-full text-left p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/5 group transition-all"
                    >
                       <div className="text-sm font-black text-white italic uppercase group-hover:text-sky-400 transition-colors">{v.name}</div>
                       <div className="text-[10px] text-zinc-500 italic mt-1">{v.description}</div>
                    </button>
                  ))}
               </div>

               <button 
                onClick={() => setHealingAfflictionId(null)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all"
               >
                 Cancelar
               </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sanityResult && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl relative overflow-hidden"
             >
                <div className={`absolute top-0 inset-x-0 h-1 ${
                  sanityResult === 'virtue' ? 'bg-sky-500' :
                  sanityResult === 'success' ? 'bg-emerald-500' :
                  'bg-rose-500'
                }`} />
                
                <div className="space-y-2">
                   <h3 className={`text-2xl font-black italic uppercase tracking-tighter ${
                     sanityResult === 'virtue' ? 'text-sky-400' :
                     sanityResult === 'success' ? 'text-emerald-400' :
                     'text-rose-400'
                   }`}>
                     {sanityResult === 'virtue' ? 'VIRTUDE!' :
                      sanityResult === 'success' ? 'SUCESSO!' :
                      'FALHA!'}
                   </h3>
                   <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">
                     {sanityResult === 'virtue' ? 'A luz brilha em seu espírito' :
                      sanityResult === 'success' ? 'Sua mente permanece firme' :
                      'A escuridão sussurra em seu ouvido'}
                   </p>
                </div>

                <div className="space-y-3">
                  {sanityResult === 'fail' && (
                    <button 
                      onClick={() => rollTrait('affliction')}
                      className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                    >
                      Rolar Aflição (1d10)
                    </button>
                  )}
                  {sanityResult === 'virtue' && !sanityLimitMessage && (
                    <button 
                      onClick={() => rollTrait('virtue')}
                      className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                    >
                      Rolar Virtude (1d10)
                    </button>
                  )}
                  {sanityLimitMessage && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400">
                       {sanityLimitMessage}
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setSanityResult(null);
                      setSanityLimitMessage(null);
                    }}
                    className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all"
                  >
                    Fechar
                  </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVirtueChoice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
             >
               <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Escolha sua Virtude</h2>
                    <p className="text-[10px] uppercase font-black text-sky-500 tracking-widest leading-relaxed">Sua vontade prevalece sobre o medo</p>
                  </div>
                  <X className="cursor-pointer text-zinc-500 hover:text-white" onClick={() => setShowVirtueChoice(false)} />
               </div>

               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {TRAITS_DATA.virtues.filter(v => v.roll < 10).map(v => {
                        const isConflict = character?.afflictions.some(a => a.roll === v.roll);
                        return (
                          <button 
                            key={v.roll}
                            disabled={isConflict}
                            onClick={() => {
                              addVirtue(v as any);
                              logTraitRoll(v as any, 'virtue', `Escolheu Virtude: ${v.name}`);
                              setShowVirtueChoice(false);
                            }}
                            className={`w-full text-left p-4 bg-zinc-950 border rounded-2xl transition-all group ${
                              isConflict 
                               ? 'border-zinc-900 opacity-20 grayscale pointer-events-none' 
                               : 'border-zinc-800 hover:border-sky-500/50 hover:bg-sky-500/5'
                            }`}
                          >
                             <div className={`text-sm font-black italic uppercase transition-colors ${isConflict ? 'text-zinc-700' : 'text-white group-hover:text-sky-400'}`}>
                                {v.name}
                                {isConflict && <span className="ml-2 text-[8px] font-black tracking-widest text-rose-500 opacity-50">(CONFLITO)</span>}
                             </div>
                             <div className="text-[10px] text-zinc-500 mt-1 line-clamp-3 leading-relaxed">{v.description}</div>
                          </button>
                        );
                     })}
                  </div>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rolledTrait && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
               animate={{ scale: 1, opacity: 1, rotate: 0 }}
               exit={{ scale: 0.8, opacity: 0, rotate: 5 }}
               className={`bg-zinc-900 border p-10 rounded-[3rem] max-w-sm w-full text-center space-y-8 relative overflow-hidden ${
                 rolledTrait.type === 'virtue' ? 'border-sky-500/50' : 'border-rose-500/50'
               }`}
             >
                <div className={`absolute top-0 inset-x-0 h-1.5 ${rolledTrait.type === 'virtue' ? 'bg-sky-500' : 'bg-rose-500'}`} />
                
                <div className="space-y-4">
                   <div className={`text-[10px] font-black uppercase tracking-[0.3em] ${rolledTrait.type === 'virtue' ? 'text-sky-500' : 'text-rose-500'}`}>
                      {rolledTrait.type === 'virtue' ? 'Nova Virtude' : rolledTrait.isAggravated ? 'Aflição Agravada' : 'Nova Aflição'}
                   </div>
                   <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                      {rolledTrait.trait.name}
                   </h3>
                </div>

                <div className="p-6 bg-black/40 rounded-3xl border border-zinc-800/50">
                   <p className="text-xs text-zinc-400 italic leading-relaxed">
                      {rolledTrait.trait.description}
                   </p>
                </div>

                <button 
                  onClick={() => setRolledTrait(null)}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${
                    rolledTrait.type === 'virtue' ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  Confirmar
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTraitModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="w-full max-w-4xl bg-[#0c0c0e] border border-zinc-800 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
             >
               <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Gerenciar Traços (GM)</h2>
                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest leading-relaxed">Adicione aflições ou virtudes manualmente</p>
                  </div>
                  <button onClick={() => setIsTraitModalOpen(false)} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all"><X size={20} /></button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
                  <div className="space-y-6">
                     <h4 className="text-[10px] uppercase font-black text-rose-500 tracking-widest px-1">Aflições Disponíveis</h4>
                     <div className="space-y-3">
                        {TRAITS_DATA.afflictions.map(a => (
                          <button 
                            key={a.roll}
                            onClick={() => { addAffliction(a as any); setIsTraitModalOpen(false); }}
                            className="w-full text-left p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-rose-500/50 hover:bg-rose-500/5 group transition-all"
                          >
                             <div className="text-sm font-black text-white italic uppercase group-hover:text-rose-400 transition-colors">{a.name}</div>
                             <div className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{a.description}</div>
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-6">
                     <h4 className="text-[10px] uppercase font-black text-sky-500 tracking-widest px-1">Virtudes Disponíveis</h4>
                     <div className="space-y-3">
                        {TRAITS_DATA.virtues.map(v => (
                          <button 
                            key={v.roll}
                            onClick={() => { addVirtue(v as any); setIsTraitModalOpen(false); }}
                            className="w-full text-left p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/5 group transition-all"
                          >
                             <div className="text-sm font-black text-white italic uppercase group-hover:text-sky-400 transition-colors">{v.name}</div>
                             <div className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{v.description}</div>
                          </button>
                        ))}
                     </div>
                  </div>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSpellModalOpen && (
          <SpellSelectionModal 
            onSelect={(spell) => {
              addSpell(spell);
              setIsSpellModalOpen(false);
            }} 
            onClose={() => setIsSpellModalOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {spellToRemove && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-rose-900/50 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Esquecer Magia?</h3>
                <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest leading-relaxed">
                  Esta magia será removida do seu grimório pessoal.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSpellToRemove(null)}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => removeSpell(spellToRemove)}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-600/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AttributeCard({ 
  value, 
  label, 
  onUpdate,
  onRoll,
  advDisStatus,
  onToggleAdvDis
}: { 
  value: number, 
  label: string, 
  onUpdate: (v: number) => void,
  onRoll: () => void,
  advDisStatus?: 'advantage' | 'disadvantage' | null,
  onToggleAdvDis: (type: 'advantage' | 'disadvantage') => void,
  key?: string | number
}) {
  const mod = getModifier(value);
  const [showAdvMenu, setShowAdvMenu] = useState(false);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 p-4 py-3 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-all shadow-lg relative">
      <div className="flex items-center gap-3">
        {/* Advantage Toggle Icon */}
        <div className="relative">
          <button 
            onClick={() => setShowAdvMenu(!showAdvMenu)}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              advDisStatus === 'advantage' ? 'bg-emerald-500 border-emerald-500' :
              advDisStatus === 'disadvantage' ? 'bg-rose-500 border-rose-500' :
              'bg-transparent border-zinc-700 hover:border-zinc-500'
            }`}
          />
          
          <AnimatePresence>
            {showAdvMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAdvMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-6 top-0 z-20 bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex flex-col gap-1 shadow-2xl min-w-[100px]"
                >
                  <button 
                    onClick={() => { onToggleAdvDis('advantage'); setShowAdvMenu(false); }}
                    className={`text-[10px] uppercase font-bold tracking-widest p-2 rounded hover:bg-emerald-500/10 text-left transition-colors ${advDisStatus === 'advantage' ? 'text-emerald-500' : 'text-zinc-400'}`}
                  >
                    Vantagem
                  </button>
                  <button 
                    onClick={() => { onToggleAdvDis('disadvantage'); setShowAdvMenu(false); }}
                    className={`text-[10px] uppercase font-bold tracking-widest p-2 rounded hover:bg-rose-500/10 text-left transition-colors ${advDisStatus === 'disadvantage' ? 'text-rose-500' : 'text-zinc-400'}`}
                  >
                    Desvantagem
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block">
            {label}
          </span>
          <div className="flex items-center gap-1">
            <DeferredNumberInput
              value={value}
              onChange={onUpdate}
              min={1}
              max={99}
              className="w-12 bg-transparent text-2xl font-mono font-bold text-white outline-none focus:text-amber-500 text-center"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* D20 Roll Button */}
        <button 
          onClick={onRoll}
          className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-white transition-all active:scale-95 border border-zinc-700/50 shadow-inner group-hover:border-amber-500/20"
          title={`Rolar ${label}`}
        >
          <D20Icon size={18} />
        </button>

        <div className="text-right min-w-[3rem] pr-2">
          <motion.div 
            key={mod}
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col items-end"
          >
            <span className={`text-2xl font-black font-mono italic ${mod > 0 ? 'text-emerald-500' : mod < 0 ? 'text-rose-500' : 'text-zinc-600'}`}>
              {formatModifier(mod)}
            </span>
            <span className="text-[8px] uppercase font-black text-zinc-600 tracking-tighter">Modificador</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatButton({ 
  label, 
  onClick, 
  variant = 'neutral',
  icon
}: { 
  label: string, 
  onClick: () => void, 
  variant?: 'danger' | 'success' | 'warning' | 'neutral',
  icon?: ReactNode
}) {
  const styles = {
    danger: 'bg-red-950/20 hover:bg-red-900/30 text-red-400 border-red-900/50',
    success: 'bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 border-emerald-900/50',
    warning: 'bg-amber-950/20 hover:bg-amber-900/30 text-amber-400 border-amber-900/50',
    neutral: 'bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-300 border-zinc-700/50',
  }[variant];

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-mono font-black uppercase transition-all active:scale-95 ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}

function LoginPage({ onLogin, onGMLogin }: { onLogin: (id: string) => void, onGMLogin: () => void }) {
  const [inputId, setInputId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGMMasterAuth, setIsGMMasterAuth] = useState(false);
  const [gmKey, setGmKey] = useState('');
  const handleLogin = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const cleanId = inputId.trim();
    if (!cleanId) return;
    setLoading(true);
    
    try {
      // Check if custom ID exists
      const docRef = doc(db, 'users', cleanId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        onLogin(cleanId);
      } else {
        // Se der erro ou não achar, mas o ID tiver 6 dígitos, permitimos entrar como convidado
        if (cleanId.length === 6 && !isNaN(Number(cleanId))) {
          onLogin(cleanId);
        } else {
          alert('ID não encontrado.');
        }
      }
    } catch (e) {
      console.warn("Login Firestore check failed, bypassing for convenience:", e);
      // Bypassing firestore check if it fails due to permissions during setup
      if (cleanId.length === 6 && !isNaN(Number(cleanId))) {
        onLogin(cleanId);
      } else {
        alert('Erro de conexão. Verifique suas regras do Firestore.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGMLogin = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (gmKey === 'Simples.') {
      setLoading(true);
      try {
        const mestreRef = doc(db, 'users', 'MESTRE');
        // Tentamos criar o registro, mas se falhar por permissão, ignoramos e seguimos
        await setDoc(mestreRef, {
          id: 'MESTRE',
          nickname: 'Mestre do Jogo',
          role: 'Mestre',
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn("Could not save Mestre record to DB:", err));
        
        onGMLogin();
      } catch (err) {
        console.error("Mestre Login Error:", err);
        onGMLogin();
      } finally {
        setLoading(false);
      }
    } else {
      alert('Chave Mestre incorreta.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-8 backdrop-blur-xl"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sword className="text-amber-500" size={32} />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Dark Core RPG</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
            {isGMMasterAuth ? 'Portal do Mestre' : 'Gerenciador de Fichas'}
          </p>
        </div>

        {!isGMMasterAuth ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Inserir seu ID</label>
                <input 
                  type="text" 
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  placeholder="Ex: 182305"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center font-mono text-2xl font-bold text-amber-500 outline-none focus:border-amber-500/50 transition-all shadow-inner"
                />
              </div>
              <button 
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-[0.2em] py-4 rounded-xl shadow-lg transition-all active:scale-95"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="space-y-3">
              <button 
                onClick={() => setIsGMMasterAuth(true)}
                className="w-full text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-amber-500 transition-colors py-2"
              >
                Sou o Mestre
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleGMLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Chave Mestre</label>
              <input 
                type="password" 
                value={gmKey}
                onChange={(e) => setGmKey(e.target.value)}
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center font-mono text-xl font-bold text-amber-500 outline-none focus:border-amber-500/50 transition-all shadow-inner"
              />
            </div>
            <div className="space-y-3">
              <button 
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs tracking-[0.2em] py-4 rounded-xl shadow-lg transition-all active:scale-95"
              >
                Autenticar Mestre
              </button>
              <button 
                type="button"
                onClick={() => setIsGMMasterAuth(false)}
                className="w-full text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-white transition-colors py-2"
              >
                Voltar
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
function MagicBonusButton({ 
  value, 
  onSelect 
}: { 
  value: number, 
  onSelect: (v: number) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
          value > 0 
            ? 'bg-amber-500 border-amber-500 text-white' 
            : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
        }`}
        title="Modificador Mágico"
      >
        <Sparkles size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute left-0 bottom-9 z-20 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 grid grid-cols-2 gap-1 shadow-2xl min-w-[100px]"
            >
              {[1, 2, 3, 4].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    onSelect(value === v ? 0 : v);
                    setIsOpen(false);
                  }}
                  className={`py-2 rounded-lg text-xs font-mono font-black transition-all ${
                    value === v 
                      ? 'bg-amber-500 text-white' 
                      : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  +{v}
                </button>
              ))}
              <button
                onClick={() => { onSelect(0); setIsOpen(false); }}
                className="col-span-2 py-1.5 text-[8px] uppercase tracking-widest font-bold text-zinc-500 hover:text-rose-400 transition-colors"
              >
                Limpar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardPage({ userId, onSelectChar, onCreateChar, onLogout }: { 
  userId: string, 
  onSelectChar: (id: string) => void,
  onCreateChar: () => void,
  onLogout: () => void
}) {
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [loading, setLoading] = useState(true);
  const [charToDelete, setCharToDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'characters'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars: CharacterState[] = [];
      snapshot.forEach((docSnap) => {
        chars.push(sanitizeCharacter(docSnap.data(), docSnap.id));
      });
      setCharacters(chars);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleDeleteChar = async () => {
    if (!charToDelete || confirmDelete !== 'CONFIRMAR') return;
    try {
      await deleteDoc(doc(db, 'characters', charToDelete));
      setCharacters(prev => prev.filter(c => c.id !== charToDelete));
      setCharToDelete(null);
      setConfirmDelete('');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `characters/${charToDelete}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Suas Fichas</h1>
            <div className="flex items-center gap-4">
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] ml-1">ID: {userId}</p>
              <span className="text-xs bg-amber-500 text-black px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                {characters.length}/5 Fichas
              </span>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <button 
            onClick={onCreateChar}
            disabled={characters.length >= 5}
            className={`group h-32 border-2 border-dashed rounded-3xl flex items-center p-8 gap-6 transition-all ${characters.length >= 5 ? 'bg-zinc-950 border-zinc-900 cursor-not-allowed text-zinc-800' : 'bg-zinc-900/30 border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-zinc-600 hover:text-amber-500'}`}
          >
            <div className="w-12 h-12 rounded-2xl border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
              {characters.length >= 5 ? <AlertTriangle size={24} /> : <Plus size={24} />}
            </div>
            <div className="text-left">
              <span className="text-sm font-black uppercase tracking-widest block">
                {characters.length >= 5 ? 'Limite Atingido' : 'Nova Ficha'}
              </span>
              <span className="text-[10px] font-mono tracking-widest opacity-50 block">
                {characters.length}/5 FICHAS
              </span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-zinc-900/30 border border-zinc-800 animate-pulse rounded-3xl overflow-hidden" />
            ))
          ) : (
            characters.map((char) => (
              <motion.div
                key={char.id}
                layoutId={char.id}
                className="group relative aspect-[4/5] bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-left space-y-6 hover:border-zinc-500 transition-all shadow-2xl overflow-hidden"
              >
                <div 
                  onClick={() => onSelectChar(char.id)}
                  className="absolute inset-0 z-0 cursor-pointer"
                />
                
                <div className="space-y-2 relative z-10 pointer-events-none">
                  <span className="inline-block px-2 py-1 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded border border-amber-500/20">
                    Nível {char.level}
                  </span>
                  <h3 className="text-2xl font-black text-white group-hover:text-amber-400 transition-colors leading-tight">{char.name}</h3>
                </div>

                <div className="flex flex-col gap-1 relative z-10 pointer-events-none">
                   <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                     <span className="w-1 h-1 rounded-full bg-zinc-700" />
                     {char.class}
                   </div>
                   <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                     <span className="w-1 h-1 rounded-full bg-zinc-700" />
                     {char.ancestry}
                   </div>
                </div>

                <div className="absolute bottom-6 left-8 right-8 flex justify-between items-center z-20">
                  <button 
                     onClick={(e) => { e.stopPropagation(); onSelectChar(char.id); }}
                     className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-white transition-colors"
                  >
                    Ver Ficha
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCharToDelete(char.id); setConfirmDelete(''); }}
                    className="p-2 text-zinc-800 hover:text-rose-500 transition-colors"
                    title="Excluir Ficha"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {charToDelete === char.id && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute inset-x-2 bottom-2 bg-zinc-950 border border-rose-900/50 rounded-2xl p-4 z-30 shadow-2xl space-y-3"
                    >
                      <p className="text-[8px] uppercase font-black text-rose-500 text-center tracking-tighter">Para excluir, digite "CONFIRMAR"</p>
                      <input 
                        type="text"
                        autoFocus
                        value={confirmDelete}
                        onChange={(e) => setConfirmDelete(e.target.value)}
                        placeholder="CONFIRMAR"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-center text-white font-black text-[10px] outline-none focus:border-rose-500/50 transition-all uppercase"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteChar(); }}
                          disabled={confirmDelete !== 'CONFIRMAR'}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-20 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          DELETAR
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCharToDelete(null); }}
                          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          X
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCharacterPage({ userId, onCreated, onBack }: {
  userId: string,
  onCreated: (id: string) => void,
  onBack: () => void
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<CharacterState, 'id' | 'userId'>>({
    ...INITIAL_CHARACTER,
    attributes: { ...INITIAL_CHARACTER.attributes },
    hp: { ...INITIAL_CHARACTER.hp }
  });

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
      onCreated(charId);
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
          <button onClick={onBack} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Criar Personagem</h1>
            <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest"> Dark Core RPG </p>
          </div>
        </header>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Basic Info */}
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

            {/* Selects */}
            <div className="space-y-6">
               <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Classe</label>
                <div className="relative">
                  <select 
                    value={formData.class}
                    onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value as CharacterClass }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm font-bold text-white appearance-none outline-none focus:border-amber-500/50 transition-all cursor-pointer"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
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

            {/* Attributes */}
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

function GMDashboardPage({ onViewCampaigns, onManageIds, onManageSystems, onLogout }: { 
  onViewCampaigns: () => void,
  onManageIds: () => void,
  onManageSystems: () => void,
  onLogout: () => void
}) {
  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col justify-center">
      <div className="max-w-4xl mx-auto w-full space-y-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Dashboard Mestre</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Dark Core RPG</p>
          </div>
          <button 
            onClick={onLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button 
            onClick={onViewCampaigns}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl h-80"
          >
            <div className="absolute top-8 left-8 p-4 bg-zinc-950 rounded-2xl text-amber-500 shadow-inner border border-zinc-800">
              <Map size={32} />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Campanhas</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Gerenciar aventuras e participantes</p>
          </button>

          <button 
            onClick={onManageSystems}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-purple-500/50 transition-all shadow-2xl h-80"
          >
            <div className="absolute top-8 left-8 p-4 bg-zinc-950 rounded-2xl text-purple-500 shadow-inner border border-zinc-800">
              <Settings size={32} />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Gerenciar Sistemas</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Shadowdark, Magias e Mais</p>
          </button>

          <button 
            onClick={onManageIds}
            className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 flex flex-col items-start justify-end gap-2 hover:border-sky-500/50 transition-all shadow-2xl h-80"
          >
            <div className="absolute top-8 left-8 p-4 bg-zinc-950 rounded-2xl text-sky-500 shadow-inner border border-zinc-800">
              <Users size={32} />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Gerenciar Usuários</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Administrar acesso de jogadores</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageSystemsPage({ onSelectShadowdark, onBack }: { onSelectShadowdark: () => void, onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-12">
        <header className="flex items-center gap-6">
          <button onClick={onBack} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Gerenciar Sistemas</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em]">Configure as regras e dados dos jogos</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button 
            onClick={onSelectShadowdark}
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

function ShadowdarkMenuPage({ onSelectSpells, onBack }: { onSelectSpells: () => void, onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8 flex flex-col items-center justify-center">
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

function ShadowdarkSpellsPage({ onBack }: { onBack: () => void }) {
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
    
    const matchesType = typeFilter === 'all' || (Array.isArray(spell.type) ? spell.type.includes(typeFilter) : spell.type === typeFilter);
    
    return matchesSearch && matchesTier && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6 sm:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <button onClick={onBack} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
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

function GMCampaignListPage({ onSelectCampaign, onCreateCampaign, onBack, onLogout }: { 
  onSelectCampaign: (id: string) => void,
  onCreateCampaign: () => void,
  onBack: () => void,
  onLogout: () => void
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [campToDelete, setCampToDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'campaigns'), where('gmId', '==', 'MESTRE'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const camps: Campaign[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Campaign;
        if (!data.accessCode) {
          const code = generateAccessCode();
          await updateDoc(docSnap.ref, { accessCode: code });
          camps.push({ ...data, accessCode: code });
        } else {
          camps.push(data);
        }
      }
      setCampaigns(camps);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'campaigns');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteCampaign = async () => {
    if (!campToDelete || confirmDelete !== 'CONFIRMAR') return;
    try {
      await deleteDoc(doc(db, 'campaigns', campToDelete));
      setCampaigns(prev => prev.filter(c => c.id !== campToDelete));
      
      // Detach character campaign IDs
      const q = query(collection(db, 'characters'), where('campaignId', '==', campToDelete));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, { campaignId: null });
      }
      setCampToDelete(null);
      setConfirmDelete('');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `campaigns/${campToDelete}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Suas Campanhas</h1>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Portal do Mestre</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button 
            onClick={onCreateCampaign}
            className="group aspect-[4/5] bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-zinc-600 hover:text-amber-500"
          >
            <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={32} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Nova Campanha</span>
          </button>

          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-zinc-900/30 border border-zinc-800 animate-pulse rounded-3xl overflow-hidden" />
            ))
          ) : (
            campaigns.map((camp) => (
              <motion.div
                key={camp.id}
                layoutId={camp.id}
                className="group relative aspect-[4/5] bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-left space-y-6 hover:border-zinc-500 transition-all shadow-2xl overflow-hidden"
              >
                <div onClick={() => onSelectCampaign(camp.id)} className="absolute inset-0 z-0 cursor-pointer" />
                
                <div className="absolute top-0 right-0 p-8 text-zinc-800/10 group-hover:text-amber-500/5 transition-colors pointer-events-none">
                  <User size={120} strokeWidth={1} />
                </div>
                
                <div className="space-y-2 relative z-10 pointer-events-none">
                  <h3 className="text-2xl font-black text-white group-hover:text-amber-400 transition-colors leading-tight">{camp.name}</h3>
                  <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                    {camp.characterIds.length} Personagens
                  </div>
                </div>

                <div className="absolute bottom-6 left-8 right-8 flex justify-between items-center z-20">
                  <button 
                     onClick={(e) => { e.stopPropagation(); onSelectCampaign(camp.id); }}
                     className="text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-white transition-colors"
                  >
                    Gerenciar
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCampToDelete(camp.id); setConfirmDelete(''); }}
                    className="p-2 text-zinc-800 hover:text-rose-500 transition-colors"
                    title="Excluir Campanha"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {campToDelete === camp.id && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute inset-x-2 bottom-2 bg-zinc-950 border border-rose-900/50 rounded-2xl p-4 z-30 shadow-2xl space-y-3"
                    >
                      <p className="text-[8px] uppercase font-black text-rose-500 text-center tracking-tighter">Para excluir, digite "CONFIRMAR"</p>
                      <input 
                        type="text"
                        autoFocus
                        value={confirmDelete}
                        onChange={(e) => setConfirmDelete(e.target.value)}
                        placeholder="CONFIRMAR"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-center text-white font-black text-[10px] outline-none focus:border-rose-500/50 transition-all uppercase"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(); }}
                          disabled={confirmDelete !== 'CONFIRMAR'}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-20 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          DELETAR
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCampToDelete(null); }}
                          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          X
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCampaignPage({ onCreated, onBack }: {
  onCreated: (id: string) => void,
  onBack: () => void
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState(false);
  const [isCharSearchOpen, setIsCharSearchOpen] = useState(false);

  const addPlayerId = (id: string) => {
    if (playerIds.includes(id)) {
      setPlayerIds(prev => prev.filter(p => p !== id));
      // Also remove characters of this player
      const q = query(collection(db, 'characters'), where('userId', '==', id));
      getDocs(q).then(snap => {
        const charIdsToRemove = snap.docs.map(d => d.id);
        setSelectedCharIds(prev => prev.filter(cid => !charIdsToRemove.includes(cid)));
      });
    } else {
      setPlayerIds(prev => [...prev, id]);
    }
  };

  const addCharacterId = (id: string) => {
    if (!selectedCharIds.includes(id)) {
      setSelectedCharIds(prev => [...prev, id]);
    }
    setIsCharSearchOpen(false);
  };

  const removePlayerId = (id: string) => {
    setPlayerIds(prev => prev.filter(p => p !== id));
    // Also remove associated characters if player is removed? 
    // Usually yes, to keep things consistent.
  };

  const removeCharId = (id: string) => {
    setSelectedCharIds(prev => prev.filter(cid => cid !== id));
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedCharIds.length === 0) return;
    setLoading(true);
    try {
      const campId = Math.random().toString(36).substring(2, 11);
      const newCamp: Campaign = {
        id: campId,
        name,
        gmId: 'MESTRE',
        playerIds,
        characterIds: selectedCharIds,
        createdAt: new Date().toISOString(),
        accessCode: generateAccessCode()
      };
      await setDoc(doc(db, 'campaigns', campId), newCamp);
      
      for (const charId of selectedCharIds) {
        await updateDoc(doc(db, 'characters', charId), { campaignId: campId });
      }

      onCreated(campId);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'campaigns');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <AnimatePresence>
        {isPlayerSearchOpen && (
          <UserSearchModal onSelect={addPlayerId} onClose={() => setIsPlayerSearchOpen(false)} />
        )}
        {isCharSearchOpen && (
          <CharacterSearchModal userIds={playerIds} onSelect={addCharacterId} onClose={() => setIsCharSearchOpen(false)} />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center gap-6">
          <button onClick={onBack} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Criar Campanha</h1>
            <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Portal do Mestre</p>
          </div>
        </header>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 space-y-8 backdrop-blur-xl shadow-2xl">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome da Campanha</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-xl font-bold text-white outline-none focus:border-amber-500/50 transition-all font-mono italic"
                placeholder="Ex: A Sombra do Corvo"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Jogadores Participantes</label>
                <button 
                  onClick={() => setIsPlayerSearchOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-white font-black uppercase text-[8px] tracking-widest transition-all flex items-center gap-2"
                >
                  <Plus size={12} /> Adicionar Jogador
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {playerIds.length === 0 && <p className="text-zinc-700 text-[10px] italic">Nenhum jogador selecionado.</p>}
                {playerIds.map(id => (
                  <div key={id} className="bg-zinc-900 border border-zinc-800 pl-3 pr-1 py-1 rounded-full flex items-center gap-2 group">
                    <span className="text-[10px] font-mono font-bold text-zinc-400">ID: {id}</span>
                    <button onClick={() => removePlayerId(id)} className="p-1 hover:text-rose-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Personagens (Fichas)</label>
                <button 
                  onClick={() => setIsCharSearchOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-white font-black uppercase text-[8px] tracking-widest transition-all flex items-center gap-2"
                >
                  <Plus size={12} /> Vincular Ficha
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {selectedCharIds.length === 0 && <p className="text-zinc-700 text-[10px] italic">Nenhuma ficha vinculada.</p>}
                {selectedCharIds.map(id => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-[10px]">
                    <span className="text-zinc-300 font-bold uppercase italic">{id}</span>
                    <button onClick={() => removeCharId(id)} className="text-rose-500 hover:text-rose-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={handleCreate}
            disabled={loading || !name.trim() || selectedCharIds.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-[0.3em] py-5 rounded-2xl shadow-lg transition-all"
          >
            {loading ? 'Criando...' : 'Criar Campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignViewPage({ campaignId, userId, mode = 'gm', onBack, onOpenSheet }: {
  campaignId: string,
  userId: string | null,
  mode?: 'gm' | 'player',
  onBack: () => void,
  onOpenSheet: (id: string) => void
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const [rolls, setRolls] = useState<RollLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingChars, setIsAddingChars] = useState(false);
  const [isAddingPlayers, setIsAddingPlayers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [removingCharId, setRemovingCharId] = useState<string | null>(null);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const [removeInput, setRemoveInput] = useState('');

  const [sidebarTab, setSidebarTab] = useState<'history' | 'players'>('history');
  
  const [activeMainTab, setActiveMainTab] = useState<'fichas' | 'combate' | 'recursos'>('fichas');
  
  const [isBulkXPModalOpen, setIsBulkXPModalOpen] = useState(false);
  const [isBulkRestModalOpen, setIsBulkRestModalOpen] = useState(false);
  const [bulkXPValue, setBulkXPValue] = useState(0);
  const [selectedBulkCharIds, setSelectedBulkCharIds] = useState<string[]>([]);
  
  const handleBulkXP = async () => {
    if (bulkXPValue <= 0 || selectedBulkCharIds.length === 0) return;
    try {
      const selectedChars = characters.filter(c => selectedBulkCharIds.includes(c.id));
      for (const char of selectedChars) {
        await updateDoc(doc(db, 'characters', char.id), { xp: char.xp + bulkXPValue });
      }
      
      // Unified Log
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: `campaign-${campaignId}`,
        characterName: 'Mestre',
        userId: userId || 'gm',
        type: 'normal',
        value: bulkXPValue,
        modifier: 0,
        label: `Distribuído ${bulkXPValue} XP para: ${selectedChars.map(c => c.name).join(', ')}`,
        timestamp: Date.now(),
        advantageMode: 'none'
      });

      setIsBulkXPModalOpen(false);
      setBulkXPValue(0);
      setSelectedBulkCharIds([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'characters_bulk_xp');
    }
  };

  const handleBulkRest = async () => {
    if (selectedBulkCharIds.length === 0) return;
    try {
      const selectedChars = characters.filter(c => selectedBulkCharIds.includes(c.id));
      for (const char of selectedChars) {
        await updateDoc(doc(db, 'characters', char.id), { 'hp.current': char.hp.max });
      }
      
      // Unified Log
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: `campaign-${campaignId}`,
        characterName: 'Mestre',
        userId: userId || 'gm',
        type: 'normal',
        value: 0,
        modifier: 0,
        label: `Descanso Coletivo realizado para: ${selectedChars.map(c => c.name).join(', ')}`,
        timestamp: Date.now(),
        advantageMode: 'none'
      });

      setIsBulkRestModalOpen(false);
      setSelectedBulkCharIds([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'characters_bulk_rest');
    }
  };

  const handleAddCharacter = async (charId: string) => {
    try {
      if (!campaign) return;
      const newCharIds = [...campaign.characterIds, charId];
      await updateDoc(doc(db, 'campaigns', campaignId), { characterIds: newCharIds });
      await updateDoc(doc(db, 'characters', charId), { campaignId: campaignId });
      setIsAddingChars(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  const handleRemovePlayer = async () => {
    if (!removingPlayerId || removeInput !== 'REMOVER') return;
    try {
      if (!campaign) return;
      const uId = removingPlayerId;
      const newPlayerIds = campaign.playerIds.filter(id => id !== uId);
      
      const q = query(collection(db, 'characters'), where('campaignId', '==', campaignId), where('userId', '==', uId));
      const snap = await getDocs(q);
      const charsToRemoveIds = snap.docs.map(d => d.id);
      
      const newCharIds = campaign.characterIds.filter(id => !charsToRemoveIds.includes(id));
      
      await updateDoc(doc(db, 'campaigns', campaignId), { 
        playerIds: newPlayerIds,
        characterIds: newCharIds
      });

      for (const d of snap.docs) {
        await updateDoc(d.ref, { campaignId: null });
      }
      setRemovingPlayerId(null);
      setRemoveInput('');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  const handleAddPlayer = async (uId: string) => {
    try {
      if (!campaign) return;
      
      if (campaign.playerIds.includes(uId)) {
        setRemovingPlayerId(uId);
        setRemoveInput('');
        setIsAddingPlayers(false);
        return;
      }
      
      const newPlayerIds = [...campaign.playerIds, uId];
      await updateDoc(doc(db, 'campaigns', campaignId), { playerIds: newPlayerIds });
      setIsAddingPlayers(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  const handleClearHistory = async () => {
    if (characters.length === 0) return;
    try {
      const q = query(collection(db, 'rolls'), where('characterId', 'in', [...characters.map(c => c.id), `campaign-${campaignId}`]));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      setRolls([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCampaign = async () => {
    if (confirmInput === 'CONFIRMAR') {
      try {
        await deleteDoc(doc(db, 'campaigns', campaignId));
        // Remove campaignId from characters
        for (const char of characters) {
          await updateDoc(doc(db, 'characters', char.id), { campaignId: null });
        }
        onBack();
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `campaigns/${campaignId}`);
      }
    }
  };

  const handleRemoveCharacter = async () => {
    if (!removingCharId || removeInput !== 'REMOVER') return;
    try {
      if (!campaign) return;
      const newCharIds = campaign.characterIds.filter(id => id !== removingCharId);
      await updateDoc(doc(db, 'campaigns', campaignId), { characterIds: newCharIds });
      await updateDoc(doc(db, 'characters', removingCharId), { campaignId: null });
      setRemovingCharId(null);
      setRemoveInput('');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    }
  };

  useEffect(() => {
    // 1. Fetch Campaign
    const unsubCamp = onSnapshot(doc(db, 'campaigns', campaignId), (docSnap) => {
      if (docSnap.exists()) {
        setCampaign(docSnap.data() as Campaign);
      }
    });

    // 2. Real-time Characters
    const qChars = query(collection(db, 'characters'), where('campaignId', '==', campaignId));
    const unsubChars = onSnapshot(qChars, (snap) => {
      const chars: CharacterState[] = [];
      snap.forEach(d => {
        chars.push(sanitizeCharacter(d.data(), d.id));
      });
      setCharacters(chars);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'characters'));

    // 3. Real-time Rolls
    const qRolls = query(
      collection(db, 'rolls'), 
      where('timestamp', '>', Date.now() - 3600000) // Last hour
    );
    const unsubRolls = onSnapshot(qRolls, (snap) => {
      setRolls(prev => {
        const logs: RollLog[] = [];
        snap.forEach(d => logs.push(d.data() as RollLog));
        return logs
          .filter(l => characters.some(c => c.id === l.characterId) || l.characterId === `campaign-${campaignId}`)
          .sort((a, b) => b.timestamp - a.timestamp);
      });
    }, (err) => console.error("Rolls error:", err));

    return () => {
      unsubCamp();
      unsubChars();
      unsubRolls();
    };
  }, [campaignId, characters.length]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar: History */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-950/50 flex flex-col order-2 md:order-1 h-full overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-zinc-900">
          <button 
            onClick={() => setSidebarTab('history')}
            className={`flex-1 py-4 text-[10px] uppercase font-black tracking-widest transition-all relative ${sidebarTab === 'history' ? 'text-amber-500 bg-zinc-900/50' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Histórico
            {sidebarTab === 'history' && <motion.div layoutId="sidebarTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500" />}
          </button>
          <button 
            onClick={() => setSidebarTab('players')}
            className={`flex-1 py-4 text-[10px] uppercase font-black tracking-widest transition-all relative ${sidebarTab === 'players' ? 'text-amber-500 bg-zinc-900/50' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Jogadores
            {sidebarTab === 'players' && <motion.div layoutId="sidebarTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <AnimatePresence mode="wait">
            {sidebarTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <History size={14} />
                    <h2 className="text-[10px] uppercase font-black tracking-widest">Registros</h2>
                  </div>
                  {mode === 'gm' && (
                    <button 
                      onClick={handleClearHistory}
                      className="text-[8px] uppercase font-black tracking-[0.2em] text-zinc-700 hover:text-amber-500 transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {rolls.length === 0 && <p className="text-zinc-700 text-[10px] uppercase font-bold text-center py-8 italic">Sem registros</p>}
                  <AnimatePresence mode="popLayout">
                    {rolls.slice(0, 20).map(roll => (
                      <motion.div 
                        key={roll.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`border rounded-xl p-3 space-y-2 group transition-colors ${
                          roll.type === 'virtue' ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50' :
                          roll.type === 'crit-success' || roll.type === 'sanity-success' ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' :
                          roll.type === 'crit-fail' || roll.type === 'sanity-fail' ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40' :
                          'bg-zinc-900 border-zinc-800/50 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-black uppercase text-amber-500 leading-none truncate max-w-[120px]">{roll.characterName}</span>
                          <div className="flex items-center gap-1.5">
                            {roll.type === 'virtue' ? (
                              <span className="text-[7px] font-black uppercase px-1 rounded border leading-none py-0.5 text-amber-500 border-amber-500/30 bg-amber-500/5">
                                VIRTUDE
                              </span>
                            ) : (roll.type === 'sanity-success' || roll.type === 'sanity-fail') ? (
                              <span className={`text-[7px] font-black uppercase px-1 rounded border leading-none py-0.5 ${
                                roll.type === 'sanity-success' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-rose-500 border-rose-500/30 bg-rose-500/5'
                              }`}>
                                {roll.type === 'sanity-success' ? 'SUCESSO' : 'FRACASSO'}
                              </span>
                            ) : roll.advantageMode && roll.advantageMode !== 'none' && (
                              <span className={`text-[7px] font-black uppercase px-1 rounded border leading-none py-0.5 ${
                                roll.advantageMode === 'advantage' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-rose-500 border-rose-500/30 bg-rose-500/5'
                              }`}>
                                {roll.advantageMode === 'advantage' ? 'VAN' : 'DES'}
                              </span>
                            )}
                            <span className="text-[8px] font-mono text-zinc-700">{new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-xl font-black font-mono ${
                            roll.type === 'crit-success' || roll.type === 'sanity-success' ? 'text-emerald-400' : 
                            roll.type === 'crit-fail' || roll.type === 'sanity-fail' ? 'text-rose-500' : 
                            roll.type === 'virtue' ? 'text-amber-500' : 'text-zinc-200'
                          }`}>
                            {roll.value + roll.modifier}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] uppercase font-black text-zinc-500 leading-none truncate">{roll.label}</div>
                            <div className="text-[7px] font-mono text-zinc-700 leading-none">d20({roll.value}){roll.modifier >= 0 ? '+' : ''}{roll.modifier}</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {sidebarTab === 'players' && (
              <motion.div 
                key="players"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users size={14} />
                      <h2 className="text-[10px] uppercase font-black tracking-widest">Ações</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {mode === 'gm' && (
                      <button 
                        onClick={() => setIsAddingPlayers(true)}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-3 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all"
                      >
                        <Plus size={14} /> Adicionar Jogador
                      </button>
                    )}
                    <button 
                      onClick={() => setIsAddingChars(true)}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-3 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all"
                    >
                      <Plus size={14} /> Vincular Ficha
                    </button>
                  </div>
                </div>

                <div className="space-y-4 border-t border-zinc-900 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users size={14} />
                      <h2 className="text-[10px] uppercase font-black tracking-widest">Membros ativos</h2>
                    </div>
                    <span className="text-[9px] bg-zinc-900 px-2 py-0.5 rounded text-zinc-600 font-black">{campaign?.playerIds.length || 0}</span>
                  </div>
                  <div className="space-y-2">
                    {campaign?.playerIds.map(pid => (
                      <div key={pid} className="flex items-center justify-between group p-2 rounded-xl hover:bg-zinc-900/50 transition-all border border-transparent hover:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                            <User size={14} className="text-zinc-600" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[120px]">{pid}</span>
                        </div>
                        {mode === 'gm' && (
                          <button 
                            onClick={() => { setRemovingPlayerId(pid); setRemoveInput(''); }}
                            className="p-1.5 text-zinc-800 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remover Jogador"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 order-1 md:order-2 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-12">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-zinc-600 hover:text-white transition-colors text-[9px] uppercase font-black tracking-widest mb-1"
              >
                <ChevronLeft size={16} /> Voltar para Campanhas
              </button>
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">{campaign?.name}</h1>
                {mode === 'gm' && (
                  <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center">
                    <span className="text-[7px] uppercase font-black text-zinc-600 leading-none">Acesso</span>
                    <span className="text-sm font-mono font-black text-amber-500 leading-none mt-1">{campaign?.accessCode}</span>
                  </div>
                )}
              </div>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Monitoramento em Tempo Real</p>
            </div>
          </header>

          <div className="flex gap-8 border-b border-zinc-900">
            <button 
              onClick={() => setActiveMainTab('fichas')}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === 'fichas' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Fichas
              {activeMainTab === 'fichas' && <motion.div layoutId="activeMainTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveMainTab('combate')}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === 'combate' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Combate <span className="text-[8px] opacity-40 lowercase font-bold tracking-normal italic">(Breve)</span>
              {activeMainTab === 'combate' && <motion.div layoutId="activeMainTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveMainTab('recursos')}
              className={`pb-4 px-2 text-xs uppercase font-black tracking-widest transition-all relative ${activeMainTab === 'recursos' ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              Recursos <span className="text-[8px] opacity-40 lowercase font-bold tracking-normal italic">(Breve)</span>
              {activeMainTab === 'recursos' && <motion.div layoutId="activeMainTab" className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
            </button>
          </div>

          <AnimatePresence>
            {isAddingChars && (
              <CharacterSearchModal 
                userIds={mode === 'player' ? (userId ? [userId] : []) : (campaign?.playerIds || [])} 
                onSelect={handleAddCharacter} 
                onClose={() => setIsAddingChars(false)} 
              />
            )}
            {isAddingPlayers && mode === 'gm' && (
              <UserSearchModal 
                onSelect={handleAddPlayer} 
                existingIds={campaign?.playerIds || []}
                onClose={() => setIsAddingPlayers(false)} 
              />
            )}
          </AnimatePresence>

                <AnimatePresence>
                  {removingPlayerId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl"
                      >
                        <div className="space-y-4">
                          <h4 className="text-xl font-black text-rose-500 uppercase italic">Remover Jogador</h4>
                          <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                            Você tem certeza que deseja remover o jogador <span className="text-white font-mono">{removingPlayerId}</span>? 
                            Todas as fichas dele serão desvinculadas desta campanha.
                          </p>
                          <div className="space-y-2">
                             <p className="text-[10px] uppercase font-black text-zinc-600 tracking-tighter">Digite "REMOVER" para confirmar:</p>
                             <input 
                               type="text"
                               value={removeInput}
                               onChange={(e) => setRemoveInput(e.target.value)}
                               className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-black text-center outline-none focus:border-rose-500 transition-all uppercase"
                               placeholder="REMOVER"
                             />
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <button 
                            onClick={handleRemovePlayer}
                            disabled={removeInput !== 'REMOVER'}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                          >
                            Remover
                          </button>
                          <button 
                            onClick={() => { setRemovingPlayerId(null); setRemoveInput(''); }}
                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                          >
                            Voltar
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeMainTab === 'fichas' && (
              <motion.div 
                key="fichas"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {mode === 'gm' && (
                  <div className="flex justify-end gap-2 px-1">
                    <button 
                      onClick={() => { setIsBulkXPModalOpen(true); setSelectedBulkCharIds(characters.map(c => c.id)); }}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 hover:text-amber-500 hover:border-amber-500/30 transition-all flex items-center gap-2 group"
                      title="Distribuir XP"
                    >
                      <Award size={14} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">XP</span>
                    </button>
                    <button 
                      onClick={() => { setIsBulkRestModalOpen(true); setSelectedBulkCharIds(characters.map(c => c.id)); }}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 hover:text-sky-500 hover:border-sky-500/30 transition-all flex items-center gap-2 group"
                      title="Descanso Total"
                    >
                      <Bed size={14} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">Descanso</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {characters.map(char => (
              <div key={char.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-2xl relative group overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white">{char.name}</h3>
                    <div className="text-[8px] uppercase tracking-[0.2em] font-black text-zinc-500">{char.ancestry} {char.class} (Nível {char.level})</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl flex flex-col items-center shadow-inner">
                      <span className="text-[7px] uppercase font-black text-zinc-600 tracking-tighter leading-none mb-1">C.A.</span>
                      <span className="text-xl font-black font-mono text-zinc-200">{
                        (() => {
                           const base = ARMOR_VALUES[char.armor.type];
                           const dexMod = getModifier(char.attributes.DEX);
                           const dexToAdd = char.armor.type === 'plate' ? 0 : dexMod;
                           const shieldBonus = char.shield.active ? 2 : 0;
                           return base + dexToAdd + shieldBonus + char.armor.magicBonus + char.shield.magicBonus;
                        })()
                      }</span>
                    </div>
                  </div>
                  
                  <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-2">
                    {mode === 'gm' && (removingCharId === char.id ? (
                      <div className="bg-zinc-950 border border-rose-900/50 p-2 rounded-xl flex items-center gap-2 shadow-2xl">
                         <input 
                           type="text"
                           value={removeInput}
                           onChange={(e) => setRemoveInput(e.target.value)}
                           placeholder='"REMOVER"'
                           className="bg-transparent text-[8px] font-black text-white w-20 outline-none border border-rose-900/30 px-1 py-0.5 rounded uppercase"
                         />
                         <button 
                           onClick={handleRemoveCharacter}
                           disabled={removeInput !== 'REMOVER'}
                           className="text-[8px] font-black uppercase text-rose-500 disabled:opacity-30"
                         >
                           OK
                         </button>
                         <button onClick={() => { setRemovingCharId(null); setRemoveInput(''); }} className="text-zinc-600">
                           <X size={12} />
                         </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setRemovingCharId(char.id)}
                        className="p-1 text-zinc-800 hover:text-rose-500 transition-colors"
                        title="Retirar da Campanha"
                      >
                        <X size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* HP Bars */}
                <div className="space-y-4 relative z-10">
                  <div className="space-y-2">
                     <div className="flex justify-between items-end">
                       <span className="text-[9px] uppercase font-black text-red-500/80 tracking-widest">Vida</span>
                       <div className="font-mono text-xs font-bold">
                         <span className="text-white">{char.hp.current}</span>
                         {char.hp.temp > 0 && <span className="text-sky-400"> +{char.hp.temp}</span>}
                         <span className="text-zinc-600"> / {char.hp.max}</span>
                       </div>
                     </div>
                     <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
                       <div 
                         className="h-full bg-red-500 transition-all duration-500" 
                         style={{ width: `${(char.hp.current / char.hp.max) * 100}%` }}
                       />
                       {char.hp.temp > 0 && (
                         <div 
                           className="h-full bg-sky-500 transition-all duration-500" 
                           style={{ width: `${(char.hp.temp / char.hp.max) * 100}%` }}
                         />
                       )}
                     </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] uppercase font-black text-amber-500/80 tracking-widest">Estresse</span>
                      <div className="font-mono text-[10px] font-bold">
                        <span className="text-white">{char.stress}</span>
                        <span className="text-zinc-600"> / 20</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 h-1.5 mt-1">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div 
                          key={i}
                          className={`flex-1 rounded-sm transition-all duration-300 ${
                            i < char.stress 
                              ? getStressColor(i) 
                              : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mini Attributes */}
                <div className="grid grid-cols-3 gap-2 relative z-10">
                  {(Object.entries(char.attributes) as [keyof CharacterState['attributes'], number][]).map(([key, val]) => (
                    <div key={key} className="bg-zinc-950 border border-zinc-800 py-2 rounded-xl flex flex-col items-center">
                      <span className="text-[7px] uppercase font-black text-zinc-600 tracking-tighter leading-none mb-0.5">{ATTR_LABELS[key]}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-white">{val}</span>
                        <span className="text-[9px] font-black text-zinc-500">{formatModifier(getModifier(val))}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 relative z-10">
                  <button 
                    onClick={() => {
                      if (mode === 'gm' || char.userId === userId) {
                        onOpenSheet(char.id);
                      } else {
                        alert('Você só pode abrir fichas vinculadas à sua conta.');
                      }
                    }}
                    disabled={mode === 'player' && char.userId !== userId}
                    className={`w-full text-[9px] uppercase font-black tracking-widest py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      (mode === 'gm' || char.userId === userId)
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700/50'
                        : 'bg-zinc-900/50 text-zinc-700 border-zinc-800/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    Abrir Ficha <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

          {activeMainTab === 'combate' && (
            <motion.div 
              key="combate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10"
            >
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                <Swords size={32} className="text-zinc-700" />
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-zinc-500">Modo de Combate</h3>
              <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest mt-1 italic">Em breve no Dark Core</p>
            </motion.div>
          )}

          {activeMainTab === 'recursos' && (
            <motion.div 
              key="recursos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10"
            >
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                <Backpack size={32} className="text-zinc-700" />
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-zinc-500">Gestão de Recursos</h3>
              <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest mt-1 italic">Em breve no Dark Core</p>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bulk Action Modals */}
      <AnimatePresence>
        {(isBulkXPModalOpen || isBulkRestModalOpen) && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-800 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl border ${isBulkXPModalOpen ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-sky-500/10 border-sky-500/20 text-sky-500'}`}>
                    {isBulkXPModalOpen ? <Award size={24} /> : <Bed size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                      {isBulkXPModalOpen ? 'Distribuir Experiência' : 'Descanso Coletivo'}
                    </h3>
                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">
                      {isBulkXPModalOpen ? 'Aumente o XP de múltiplos personagens' : 'Restaure PV de múltiplos personagens'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsBulkXPModalOpen(false); setIsBulkRestModalOpen(false); }}
                  className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                {isBulkXPModalOpen && (
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Quantidade de XP</label>
                    <div className="relative group">
                      <input 
                        type="number"
                        value={bulkXPValue || ''}
                        onChange={(e) => setBulkXPValue(Number(e.target.value))}
                        placeholder="Ex: 5"
                        className="w-full bg-zinc-900/50 border-2 border-zinc-800/50 rounded-2xl px-6 py-4 text-2xl font-black text-amber-500 outline-none focus:border-amber-500/50 focus:bg-zinc-900 transition-all font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Selecionar Fichas</h4>
                    <button 
                      onClick={() => {
                        if (selectedBulkCharIds.length === characters.length) {
                          setSelectedBulkCharIds([]);
                        } else {
                          setSelectedBulkCharIds(characters.map(c => c.id));
                        }
                      }}
                      className="text-[9px] uppercase font-black text-amber-500 hover:text-amber-400 transition-colors tracking-widest"
                    >
                      {selectedBulkCharIds.length === characters.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {characters.map(char => (
                      <button 
                        key={char.id}
                        onClick={() => {
                          if (selectedBulkCharIds.includes(char.id)) {
                            setSelectedBulkCharIds(selectedBulkCharIds.filter(id => id !== char.id));
                          } else {
                            setSelectedBulkCharIds([...selectedBulkCharIds, char.id]);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          selectedBulkCharIds.includes(char.id) 
                            ? (isBulkXPModalOpen ? 'bg-amber-500/10 border-amber-500/30' : 'bg-sky-500/10 border-sky-500/30')
                            : 'bg-zinc-900/30 border-zinc-800/50 opacity-40 grayscale'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-black text-[10px] text-zinc-500">
                            {char.level}
                          </div>
                          <div className="text-left">
                            <div className={`text-sm font-black uppercase italic ${selectedBulkCharIds.includes(char.id) ? 'text-white' : 'text-zinc-600'}`}>{char.name}</div>
                            <div className="text-[8px] uppercase tracking-widest font-black text-zinc-600">{char.class}</div>
                          </div>
                        </div>
                        {selectedBulkCharIds.includes(char.id) && (
                          <div className={`p-1.5 rounded-lg ${isBulkXPModalOpen ? 'bg-amber-500 text-black' : 'bg-sky-500 text-white'}`}>
                            <Check size={12} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-950/80 border-t border-zinc-900">
                <button 
                  onClick={isBulkXPModalOpen ? handleBulkXP : handleBulkRest}
                  disabled={selectedBulkCharIds.length === 0 || (isBulkXPModalOpen && bulkXPValue <= 0)}
                  className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-xl active:scale-95 disabled:opacity-30 disabled:grayscale ${
                    isBulkXPModalOpen ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/20'
                  }`}
                >
                  {isBulkXPModalOpen ? 'Confirmar Distribuição' : 'Confirmar Descanso'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditIcon({ size = 12, className = "" }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function PlayerNicknameModal({ onSave }: { onSave: (nickname: string) => void }) {
  const [nickname, setNickname] = useState('');
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <User className="text-amber-500" size={24} />
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bem-vindo ao Dark Core RPG</h2>
          <p className="text-zinc-500 text-xs text-center">Antes de começar, como gostaria de ser chamado?</p>
        </div>

        <div className="space-y-4">
          <input 
            type="text"
            placeholder="Seu apelido..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center text-white outline-none focus:border-amber-500/50 transition-all font-bold"
            autoFocus
          />
          <p className="text-[10px] text-zinc-600 text-center italic">Você poderá alterar seu apelido futuramente na página inicial.</p>
          <button 
            disabled={!nickname.trim()}
            onClick={() => onSave(nickname.trim())}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all active:scale-95 shadow-lg"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ManageIDsPage({ onBack }: { onBack: () => void }) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchIDs = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      querySnapshot.forEach(doc => {
        list.push(doc.data() as UserProfile);
      });
      setProfiles(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIDs();
  }, []);

  const handleCreateID = async () => {
    setCreating(true);
    try {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let newId = '';
      let exists = true;
      while (exists) {
        newId = '';
        for (let i = 0; i < 6; i++) {
          newId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const check = await getDoc(doc(db, 'users', newId));
        exists = check.exists();
      }
      
      await setDoc(doc(db, 'users', newId), {
        id: newId,
        role: 'Jogador',
        createdAt: new Date().toISOString()
      });
      setNewlyCreatedId(newId);
      await fetchIDs();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!idToDelete) return;
    if (deleteConfirmText !== 'CONFIRMAR') return;
    
    const profileId = idToDelete;
    setIdToDelete(null);
    setDeleteConfirmText('');
    setLoading(true); // Show loading during deletion
    
    try {
      // 1. Delete associated characters
      const qChars = query(collection(db, 'characters'), where('userId', '==', profileId));
      const charSnaps = await getDocs(qChars);
      for (const charDoc of charSnaps.docs) {
        await deleteDoc(charDoc.ref);
      }

      // 2. Remove from campaigns
      const qCamps = query(collection(db, 'campaigns'), where('playerIds', 'array-contains', profileId));
      const campSnaps = await getDocs(qCamps);
      for (const campDoc of campSnaps.docs) {
        const data = campDoc.data() as Campaign;
        await updateDoc(campDoc.ref, {
          playerIds: data.playerIds.filter(id => id !== profileId)
        });
      }

      // 3. Delete user profile
      await deleteDoc(doc(db, 'users', profileId));
      await fetchIDs();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Gerenciar ID's</h1>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Controle de Acesso</p>
            </div>
          </div>
          <button 
            onClick={handleCreateID}
            disabled={creating}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> {creating ? 'Criando...' : 'Novo ID'}
          </button>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <input 
            type="text"
            placeholder="Filtrar por nome ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all"
          />
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500">ID</th>
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500">Nome / Apelido</th>
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500">Papel</th>
                  <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-zinc-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-zinc-600 italic">Carregando ID's...</td>
                  </tr>
                ) : profiles.filter(p => 
                  p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-zinc-600 italic">Nenhum ID encontrado.</td>
                  </tr>
                ) : profiles.filter(p => 
                  p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (p.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).map(profile => (
                  <tr key={profile.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-8 py-6 font-mono text-xl font-bold text-amber-500">{profile.id}</td>
                    <td className="px-8 py-6 text-zinc-400 font-bold">{profile.nickname || <span className="opacity-20 italic">Aguardando vínculo...</span>}</td>
                    <td className="px-8 py-6">
                      <button 
                        onClick={async () => {
                          const newRole = profile.role === 'Mestre' ? 'Jogador' : 'Mestre';
                          if (confirm(`Alterar papel de ${profile.nickname || profile.id} para ${newRole}?`)) {
                            try {
                              await updateDoc(doc(db, 'users', profile.id), { role: newRole });
                              await fetchIDs();
                            } catch (e) {
                              handleFirestoreError(e, OperationType.UPDATE, `users/${profile.id}`);
                            }
                          }
                        }}
                        className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all ${profile.role === 'Mestre' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                      >
                        {profile.role || 'Jogador'}
                      </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setIdToDelete(profile.id)}
                        className="p-3 text-zinc-600 hover:text-rose-500 transition-colors bg-zinc-950/50 rounded-xl hover:bg-rose-500/10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create ID Success Modal */}
        <AnimatePresence>
          {newlyCreatedId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Check className="text-amber-500" size={32} />
                </div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">ID Criado com Sucesso!</h2>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2">Novo ID de Jogador</p>
                  <p className="text-5xl font-mono font-black text-amber-500 tracking-tighter">{newlyCreatedId}</p>
                </div>
                <button 
                  onClick={() => setNewlyCreatedId(null)}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all"
                >
                  Entendido
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {idToDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-md w-full bg-zinc-900 border border-rose-500/30 p-8 rounded-3xl shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="text-rose-500" size={24} />
                  </div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Excluir ID {idToDelete}?</h2>
                  <p className="text-zinc-500 text-xs text-center">
                    Esta ação é irreversível. Todas as fichas e participações em campanhas vinculadas a este ID serão removidas permanentemente.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest text-center">Digite <span className="text-white">CONFIRMAR</span> para prosseguir</p>
                    <input 
                      type="text"
                      placeholder="CONFIRMAR"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center text-white outline-none focus:border-rose-500/50 transition-all font-bold tracking-widest"
                      autoFocus
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setIdToDelete(null); setDeleteConfirmText(''); }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black uppercase text-[10px] tracking-widest py-4 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      disabled={deleteConfirmText !== 'CONFIRMAR'}
                      onClick={handleExecuteDelete}
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white font-black uppercase text-[10px] tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-rose-900/20"
                    >
                      Excluir Agora
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PlayerCampaignListPage({ userId, onSelectCampaign, onBack }: {
  userId: string,
  onSelectCampaign: (id: string) => void,
  onBack: () => void
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'campaigns'),
      where('playerIds', 'array-contains', userId)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Campaign[] = [];
      snap.forEach(d => list.push(d.data() as Campaign));
      setCampaigns(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    }, (e) => {
      handleFirestoreError(e, OperationType.LIST, 'campaigns');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-zinc-600 hover:text-white transition-colors text-[9px] uppercase font-black tracking-widest mb-1"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">Minhas Campanhas</h1>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-[0.3em] ml-1">Aventuras que você participa</p>
          </div>
          <button 
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} /> Entrar em uma Campanha
          </button>
        </header>

        <AnimatePresence>
          {isJoinModalOpen && (
            <JoinCampaignModal 
              userId={userId}
              onJoined={(id) => {
                setIsJoinModalOpen(false);
                onSelectCampaign(id);
              }}
              onClose={() => setIsJoinModalOpen(false)}
            />
          )}
        </AnimatePresence>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
             <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
             <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Buscando aventuras...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-20 border border-dashed border-zinc-800 rounded-[40px] flex flex-col items-center justify-center space-y-4 bg-zinc-900/10">
            <Map size={48} className="text-zinc-800" />
            <div className="text-center">
              <h3 className="text-xl font-black uppercase italic text-zinc-600">Nenhuma Campanha</h3>
              <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest mt-1">Peça o código ao seu Mestre para entrar</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map(camp => (
              <button 
                key={camp.id}
                onClick={() => onSelectCampaign(camp.id)}
                className="w-full text-left group bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 hover:border-amber-500/50 transition-all shadow-2xl relative overflow-hidden"
              >
                <div className="relative z-10 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white group-hover:text-amber-500 transition-colors">{camp.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Mestre:</span>
                       <span className="text-[9px] font-black uppercase text-amber-500/80 tracking-widest">{camp.gmId}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-zinc-600" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{camp.playerIds.length} Jogadores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-zinc-600" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{camp.characterIds.length} Fichas</span>
                    </div>
                  </div>
                </div>
                
                <ChevronRight className="absolute bottom-8 right-8 text-zinc-800 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" size={24} />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JoinCampaignModal({ userId, onJoined, onClose }: { userId: string, onJoined: (id: string) => void, onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const q = query(collection(db, 'campaigns'), where('accessCode', '==', code.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError('Código de acesso inválido.');
        setLoading(false);
        return;
      }

      const campaignDoc = snap.docs[0];
      const campaign = campaignDoc.data() as Campaign;

      if (campaign.playerIds.includes(userId)) {
        onJoined(campaignDoc.id);
        setLoading(false);
        return;
      }

      const updatedPlayerIds = [...campaign.playerIds, userId];
      await updateDoc(doc(db, 'campaigns', campaignDoc.id), { playerIds: updatedPlayerIds });
      
      onJoined(campaignDoc.id);
    } catch (e) {
      console.error(e);
      setError('Ocorreu um erro ao tentar entrar na campanha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-8 space-y-8"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Entrar na Campanha</h2>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Insira o código fornecido pelo seu Mestre</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-2">
            <input 
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CÓDIGO (ex: Ab12)"
              maxLength={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-6 text-center text-3xl font-black uppercase tracking-[0.5em] text-amber-500 outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-800"
              autoFocus
            />
            {error && <p className="text-rose-500 text-[10px] font-black uppercase text-center">{error}</p>}
          </div>

          <div className="flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading || !code}
              className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-2xl text-[10px] uppercase font-black tracking-widest text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function PlayerHomePage({ userId, profile, onUpdateProfile, onGoToSheets, onGoToCampaigns, onLogout }: { 
  userId: string, 
  profile: UserProfile | null, 
  onUpdateProfile: (p: UserProfile) => void,
  onGoToSheets: () => void,
  onGoToCampaigns: () => void,
  onLogout: () => void 
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNickname, setNewNickname] = useState(profile?.nickname || '');

  const updateNickname = async (nick: string) => {
    if (!nick.trim()) return;
    try {
      const updated = { 
        ...profile, 
        nickname: nick.trim(), 
        id: userId, 
        createdAt: profile?.createdAt || new Date().toISOString() 
      } as UserProfile;
      await updateDoc(doc(db, 'users', userId), { nickname: updated.nickname });
      onUpdateProfile(updated);
      setIsEditingName(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
    }
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
            onClick={onLogout}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors flex items-center gap-2"
          >
            Sair <ArrowLeft size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-96">
          <button 
            onClick={onGoToSheets}
            className="w-full h-full group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl"
          >
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white group-hover:scale-105 transition-transform origin-left">Fichas</h2>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em]">Gerenciar seus personagens</p>
            
            {/* Decorative background element */}
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
          </button>

          <button 
            onClick={onGoToCampaigns}
            className="w-full h-full group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[40px] p-12 flex flex-col items-start justify-end gap-2 hover:border-amber-500/50 transition-all shadow-2xl"
          >
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white group-hover:scale-105 transition-transform origin-left">Campanhas</h2>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em]">Participe de aventuras</p>
            
            {/* Decorative background element */}
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
            <Map size={120} className="absolute -top-4 -right-4 opacity-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
