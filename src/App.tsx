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
  Trait,
  RollNotification
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
import { CLASSES, ANCESTRIES, INITIAL_CHARACTER, ARMOR_VALUES, ARMOR_LABELS } from './constants';
import { handleFirestoreError, OperationType } from './utils/errorUtils';
import { 
  sanitizeCharacter, 
  generateAccessCode, 
  getStressColor, 
  getModifier, 
  formatModifier, 
  playDiceSound 
} from './utils/characterUtils';

// Pages
import { LoginPage } from './pages/Login/LoginPage';
import { PlayerHomePage } from './pages/PlayerHome/PlayerHomePage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { CreateCharacterPage } from './pages/Character/CreateCharacterPage';
import { GMDashboardPage } from './pages/GM/GMDashboardPage';
import { ManageSystemsPage } from './pages/GM/ManageSystemsPage';
import { ShadowdarkMenuPage } from './pages/GM/Systems/ShadowdarkMenuPage';
import { ShadowdarkSpellsPage } from './pages/GM/Systems/ShadowdarkSpellsPage';
import { ShadowdarkItemsPage } from './pages/GM/Systems/ShadowdarkItemsPage';
import { GMCampaignListPage } from './pages/GM/Campaigns/GMCampaignListPage';
import { CreateCampaignPage } from './pages/GM/Campaigns/CreateCampaignPage';
import { CampaignViewPage } from './pages/Campaign/CampaignViewPage';
import { PlayerCampaignListPage } from './pages/PlayerHome/PlayerCampaignListPage';
import { ManageIDsPage } from './pages/GM/ManageIDsPage';

// Modals
import { UserSearchModal } from './components/modals/UserSearchModal';
import { CharacterSearchModal } from './components/modals/CharacterSearchModal';
import { SpellSelectionModal } from './components/modals/SpellSelectionModal';
import { PlayerNicknameModal } from './components/modals/PlayerNicknameModal';
import { JoinCampaignModal } from './components/modals/JoinCampaignModal';

// Components
import { D20Icon, EditIcon } from './components/ui/Icons';
import { DeferredNumberInput } from './components/character/DeferredNumberInput';
import { AttributeCard } from './components/character/AttributeCard';
import { StatButton } from './components/character/StatButton';
import { MagicBonusButton } from './components/character/MagicBonusButton';

export default function App() {
  const [view, setView] = useState<'login' | 'player-home' | 'dashboard' | 'create' | 'sheet' | 'gm-dashboard' | 'gm-campaign-list' | 'gm-create' | 'gm-campaign' | 'gm-manage-ids' | 'player-campaign-list' | 'player-campaign' | 'gm-manage-systems' | 'gm-shadowdark-menu' | 'gm-shadowdark-spells' | 'gm-shadowdark-items'>('login');
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
        onSelectItems={() => setView('gm-shadowdark-items')}
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

  if (view === 'gm-shadowdark-items') {
    return (
      <ShadowdarkItemsPage 
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
        onBack={() => setView('player-home')}
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
      const oldHP = prev.hp.current;

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

      // Log Healing (Rest)
      if (amount > 0 && newCurrent > oldHP) {
        const healed = newCurrent - oldHP;
        const rollRef = doc(collection(db, 'rolls'));
        setDoc(rollRef, {
          id: rollRef.id,
          characterId: charId,
          characterName: prev.name,
          userId: prev.userId,
          type: 'normal',
          value: healed,
          modifier: 0,
          label: `Recuperou ${healed} PV (Descanso)`,
          timestamp: Date.now(),
          advantageMode: 'none'
        }).catch(e => console.error("History log failed:", e));
      }

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

  const updateArmor = (updates: Partial<CharacterState['armor']>) => {
    if (!character) return;
    const newArmor = { ...character.armor, ...updates };
    setCharacter(prev => prev ? { ...prev, armor: newArmor } : null);
    updateCharacterInDB({ armor: newArmor });
  };

  const updateShield = (updates: Partial<CharacterState['shield']>) => {
    if (!character) return;
    const newShield = { ...character.shield, ...updates };
    setCharacter(prev => prev ? { ...prev, shield: newShield } : null);
    updateCharacterInDB({ shield: newShield });
  };

  const updateXP = (amount: number) => {
    if (!character) return;
    const newXP = Math.max(0, character.xp + amount);
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
    const remainingXP = Math.max(0, character.xp - maxXPNeeded);
    setCharacter(prev => prev ? { ...prev, level: newLevel, xp: remainingXP } : null);
    await updateCharacterInDB({ level: newLevel, xp: remainingXP });

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
                  {(Object.entries(character.attributes) as [keyof CharacterState['attributes'], number][]).map(([attrKey, val]) => (
                    <AttributeCard 
                      key={attrKey}
                      value={val}
                      label={ATTR_LABELS[attrKey]}
                      advDisStatus={character.advDis[attrKey]}
                      onUpdate={(v) => updateAttribute(attrKey, v)}
                      onRoll={() => handleRoll(attrKey)}
                      onToggleAdvDis={(type) => toggleAdvDis(attrKey, type)}
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
                          onChange={(v) => {
                            const updatedHP = { ...character.hp, max: v };
                            setCharacter(prev => prev ? { ...prev, hp: updatedHP } : null);
                            updateCharacterInDB({ hp: updatedHP });
                          }}
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
                               onChange={(e) => updateArmor({ type: e.target.value as ArmorType })}
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
                                  onSelect={(v) => updateArmor({ magicBonus: v })} 
                                />
                                {character.armor.magicBonus > 0 && <span className="text-[10px] font-black text-amber-500">+{character.armor.magicBonus}</span>}
                             </div>
                           )}
                         </div>
                         
                         <div className="flex flex-col gap-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                               <button 
                                 onClick={() => updateShield({ active: !character.shield.active })}
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
                                    onSelect={(v) => updateShield({ magicBonus: v })} 
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
