import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Package,
  Check,
  AlertTriangle,
  Search,
  Dices,
  Minus,
  Map,
  Settings,
  BookOpen,
  Clock,
  Flame,
  Pause,
  Play,
  Droplets,
  Brain,
  Edit
} from 'lucide-react';
import { 
  CharacterState, 
  ATTR_LABELS, 
  ArmorType,
  CharacterClass,
  Campaign,
  UserProfile,
  InventoryItem,
  Spell,
  Trait,
  RollNotification,
  MasterItem,
  ItemCategory,
  CustomClass
} from '../../types';
import { db } from '../../firebase';
import { TRAITS_DATA } from '../../data/traits';
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs,
  deleteDoc,
  collection, 
  onSnapshot,
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { ARMOR_VALUES } from '../../constants';
import { handleFirestoreError, OperationType } from '../../utils/errorUtils';
import { 
  sanitizeCharacter, 
  getStressColor, 
  getModifier, 
  formatModifier, 
  playDiceSound 
} from '../../utils/characterUtils';

// Modals
import { SpellSelectionModal } from '../../components/modals/SpellSelectionModal';

// Components
import { D20Icon, EditIcon } from '../../components/ui/Icons';
import { DeferredNumberInput } from '../../components/character/DeferredNumberInput';
import { AttributeCard } from '../../components/character/AttributeCard';
import { StatButton } from '../../components/character/StatButton';
import { MagicBonusButton } from '../../components/character/MagicBonusButton';
import { useAuth } from '../../contexts/AuthContext';

// Icones customizados
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CircularProgress = ({ value, max, active }: { value: number, max: number, active: boolean }) => {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / max) * circumference;
  const dashoffset = circumference - progress;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className={`w-8 h-8 -rotate-90 ${active ? 'animate-pulse' : ''}`}>
          <circle
            cx="16"
            cy="16"
            r={radius}
            className="stroke-zinc-800 fill-none"
            strokeWidth="3"
          />
          <circle
            cx="16"
            cy="16"
            r={radius}
            className="stroke-amber-500 fill-none transition-all duration-300"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
           <Flame size={10} className={active ? 'text-amber-500' : 'text-zinc-700'} />
        </div>
      </div>
      <div className="flex flex-col">
        <span className={`text-[10px] font-mono font-black ${active ? 'text-amber-500' : 'text-zinc-500'}`}>
          {formatTime(value)}
        </span>
      </div>
    </div>
  );
};

export default function CharacterSheet() {
  const { id: charId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: userProfile, user } = useAuth();
  const isGM = userProfile?.role === 'Mestre' || user?.uid === 'MESTRE';
  
  const [character, setCharacter] = useState<CharacterState | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'combat' | 'equip' | 'talents' | 'spell' | 'traits' | 'extra'>('combat');
  const [advantageMode, setAdvantageMode] = useState<'none' | 'advantage' | 'disadvantage'>('none');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemSlots, setCustomItemSlots] = useState(1);
  const [customItemDescription, setCustomItemDescription] = useState("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [itemModalTab, setItemModalTab] = useState<ItemCategory>('Geral');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [hpAdjustAmount, setHpAdjustAmount] = useState<number>(1);
  const [notifications, setNotifications] = useState<RollNotification[]>([]);
  const [history, setHistory] = useState<RollNotification[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTempHPOpen, setIsTempHPOpen] = useState(false);
  const [isEditingMaxHp, setIsEditingMaxHp] = useState(false);
  const [tempMaxHp, setTempMaxHp] = useState<number>(0);
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [tempLevel, setTempLevel] = useState<number>(0);
  const [isEditingXP, setIsEditingXP] = useState(false);
  const [tempXP, setTempXP] = useState<number>(0);
  const [isEditingSpellMod, setIsEditingSpellMod] = useState(false);
  const [tempSpellMod, setTempSpellMod] = useState<number>(0);
  const [tempHPValue, setTempHPValue] = useState("");
  const [customDice, setCustomDice] = useState<Record<string, number>>({ '4': 0, '6': 0, '8': 0, '10': 0, '12': 0, '20': 0 });
  const [customModifier, setCustomModifier] = useState<number>(0);
  const [isCustomDiceOpen, setIsCustomDiceOpen] = useState(false);
  const [lastCustomResult, setLastCustomResult] = useState<{ rolls: { d: number, v: number }[], total: number } | null>(null);
  const [healingAfflictionId, setHealingAfflictionId] = useState<string | null>(null);
  const [expandedSpells, setExpandedSpells] = useState<Record<string, boolean>>({});
  const [spellAdvDis, setSpellAdvDis] = useState<Record<string, 'advantage' | 'disadvantage' | 'none'>>({});
  const [weaponAdvDis, setWeaponAdvDis] = useState<Record<string, 'advantage' | 'disadvantage' | 'none'>>({});
  const [customClasses, setCustomClasses] = useState<CustomClass[]>([]);

  const toggleSpellAdvDis = (spellId: string, mode: 'advantage' | 'disadvantage') => {
    setSpellAdvDis(prev => {
      const current = prev[spellId] || 'none';
      const next = current === mode ? 'none' : mode;
      return { ...prev, [spellId]: next };
    });
  };

  const toggleWeaponAdvDis = (weaponId: string, mode: 'advantage' | 'disadvantage') => {
    setWeaponAdvDis(prev => {
      const current = prev[weaponId] || 'none';
      const next = current === mode ? 'none' : mode;
      return { ...prev, [weaponId]: next };
    });
  };

  // Talent states
  const [isRollConfirmOpen, setIsRollConfirmOpen] = useState(false);
  const [isRollResultOpen, setIsRollResultOpen] = useState(false);
  const [rollResult, setRollResult] = useState<{ d1: number; d2: number; sum: number; effect: string } | null>(null);
  const [isGMAddTalentOpen, setIsGMAddTalentOpen] = useState(false);
  const [gmSelectedTalentRow, setGmSelectedTalentRow] = useState<number | 'custom'>(0);
  const [gmCustomName, setGmCustomName] = useState('');
  const [gmCustomDescription, setGmCustomDescription] = useState('');
  const [gmCustomType, setGmCustomType] = useState<'initial' | 'level' | 'ancestry'>('level');

  const toggleSpellExpanded = (spellId: string) => {
    setExpandedSpells(prev => ({ ...prev, [spellId]: !prev[spellId] }));
  };

  useEffect(() => {
    const q = query(collection(db, 'master_classes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CustomClass[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as CustomClass);
      });
      setCustomClasses(list);
    }, (e) => {
      console.error("Error loading master classes in Sheet:", e);
    });
    return () => unsubscribe();
  }, []);

  const currentClassDef = character ? customClasses.find(c => c.name.toLowerCase() === character.class.toLowerCase()) : null;
  const spellcasters: CharacterClass[] = ['Sacerdote', 'Mago', 'Bruxa', 'Cavaleiro Amaldiçoado'];

  useEffect(() => {
    if (!character) return;
    if (gmSelectedTalentRow === 'custom') {
      setGmCustomName('');
      setGmCustomDescription('');
    } else {
      const idx = gmSelectedTalentRow;
      const table = getClassRollTable(character.class, currentClassDef || undefined);
      const row = table[idx];
      if (row) {
        setGmCustomName(`${gmCustomType === 'initial' ? 'Talento Inicial' : gmCustomType === 'ancestry' ? 'Talento de Ancestralidade' : 'Talento de Nível'} (${row.range})`);
        setGmCustomDescription(row.effect);
      }
    }
  }, [gmSelectedTalentRow, gmCustomType, character, customClasses]);

  const isSpellcaster = character ? (spellcasters.includes(character.class) || !!currentClassDef?.isSpellcaster) : false;
  const maxXP = character ? character.level * 10 : 10;

  useEffect(() => {
    if (!charId) return;
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

  // Fetch rolls history
  useEffect(() => {
    if (!charId) return;
    const q = query(
      collection(db, 'rolls'),
      where('characterId', '==', charId),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RollNotification[];
      
      // Sort client-side to avoid needing a composite index
      logs.sort((a, b) => b.timestamp - a.timestamp);
      
      setHistory(logs);
    }, (e) => {
      // Don't crash if index is missing, just log
      console.warn("Rolls history error:", e);
    });
    return () => unsubscribe();
  }, [charId]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(0, -1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  // Fetch master items
  useEffect(() => {
    const q = query(collection(db, 'master_items'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MasterItem[] = [];
      snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as MasterItem));
      setMasterItems(list);
    });
    return () => unsubscribe();
  }, []);

  const updateCharacterInDB = async (updates: Partial<CharacterState>) => {
    if (!character || !charId) return;
    try {
      // Clean undefined values to avoid Firestore errors
      const cleanUpdates = JSON.parse(JSON.stringify(updates));
      await updateDoc(doc(db, 'characters', charId), cleanUpdates);
    } catch (e) {
      console.error("Failed to update character:", e);
    }
  };

  const calculateArmorClass = () => {
    if (!character) return 10;
    
    const dexMod = getModifier(character.attributes.DEX);
    
    // Check equipped items
    const equippedArmor = character.inventory.find(i => i.isEquipped && i.category === 'Armadura');
    const equippedShield = character.inventory.find(i => i.isEquipped && i.category === 'Escudo');
    
    let baseAC = 10 + dexMod;
    
    if (equippedArmor) {
      if (equippedArmor.sumDex) {
        baseAC = (equippedArmor.ac || 10) + dexMod;
      } else {
        baseAC = equippedArmor.ac || 10;
      }
    }
    
    const shieldBonus = equippedShield ? 2 : 0;
    
    return baseAC + shieldBonus + (character.armor.magicBonus || 0) + (character.shield.magicBonus || 0);
  };

  const calculateTotalSlots = () => {
    if (!character) return 0;
    return character.inventory.reduce((acc, item) => {
      if (item.category === 'Pacote' && item.itemsPerSlot && item.itemsPerSlot > 0) {
        const qty = item.quantity || 0;
        return acc + Math.ceil(qty / item.itemsPerSlot);
      }
      return acc + (item.slots || 0);
    }, 0);
  };

  const handleToggleEquip = async (itemId: string) => {
    if (!character) return;
    
    const itemToToggle = character.inventory.find(i => i.id === itemId);
    if (!itemToToggle) return;
    
    const isEquipping = !itemToToggle.isEquipped;
    
    let updatedInventory = character.inventory.map(item => {
      if (item.id === itemId) return { ...item, isEquipped: isEquipping };
      
      // Auto-unequip others of the same category
      if (isEquipping && item.category === itemToToggle.category && (item.category === 'Armadura' || item.category === 'Escudo')) {
        return { ...item, isEquipped: false };
      }
      
      return item;
    });
    
    await updateCharacterInDB({ inventory: updatedInventory });
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
  };

  const handleUpdateQuantity = async (itemId: string, delta: number) => {
    if (!character) return;
    const updatedInventory = character.inventory.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, (item.quantity || 0) + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });
    
    await updateCharacterInDB({ inventory: updatedInventory });
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
  };

  const rollWeaponAttack = async (item: InventoryItem) => {
    playDiceSound();
    if (!character || !charId) return;
    
    // Logic for attribute selection
    let attrKey: keyof CharacterState['attributes'] = 'STR';
    const props = item.properties || [];
    
    if (props.includes('Distância')) {
      attrKey = 'DEX';
    } else if (props.includes('Acuidade')) {
      attrKey = item.finesseAttribute || 'STR';
    }
    
    const mod = getModifier(character.attributes[attrKey]);
    
    // Parse extra modifiers if present
    let extraMod = 0;
    if (item.modifiers) {
      const match = item.modifiers.match(/([+-]\d+)/);
      if (match) extraMod = parseInt(match[1]);
    }
    
    let roll = 0;
    let r1: number | undefined;
    let r2: number | undefined;
    
    const activeAdvMode = weaponAdvDis[item.id] || 'none';
    
    if (activeAdvMode === 'advantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.max(r1, r2);
    } else if (activeAdvMode === 'disadvantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.min(r1, r2);
    } else {
      roll = Math.floor(Math.random() * 20) + 1;
    }
    
    const label = `Atk: ${item.name}${item.modifiers ? ` (${item.modifiers})` : ''}`;
    
    const newNotify: RollNotification = {
      id: Math.random().toString(36).substring(2, 11),
      type: roll === 20 ? 'crit-success' : roll === 1 ? 'crit-fail' : 'normal',
      value: roll,
      modifier: mod + extraMod,
      attributeLabel: label,
      r1,
      r2,
      advDis: activeAdvMode === 'none' ? null : activeAdvMode,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [newNotify, ...prev].slice(0, 3));
    
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: newNotify.type,
        value: roll,
        modifier: mod + extraMod,
        label: label,
        timestamp: Date.now(),
        advantageMode: activeAdvMode,
        r1: r1 || null,
        r2: r2 || null
      });
    } catch (e) { console.error(e); }
    
    // Reset specific weapon advantage after rolling
    setWeaponAdvDis(prev => ({ ...prev, [item.id]: 'none' }));
  };

  const handleUpdateFinesse = async (itemId: string, attr: 'STR' | 'DEX') => {
    if (!character) return;
    const updatedInventory = character.inventory.map(item => {
      if (item.id === itemId) return { ...item, finesseAttribute: attr };
      return item;
    });
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
  };

  const rollWeaponDamage = async (item: InventoryItem) => {
    playDiceSound();
    if (!character || !charId || !item.damage) return;
    
    const damageStr = item.damage.toLowerCase(); // e.g. "1d8"
    const match = damageStr.match(/(\d+)d(\d+)/);
    if (!match) return;
    
    const count = parseInt(match[1]);
    const size = parseInt(match[2]);
    
    let diceSum = 0;
    for (let i = 0; i < count; i++) {
       diceSum += Math.floor(Math.random() * size) + 1;
    }
    
    let extraMod = 0;
    if (item.modifiers) {
      const matchMod = item.modifiers.match(/([+-]\d+)/);
      if (matchMod) extraMod = parseInt(matchMod[1]);
    }
    
    const total = diceSum + extraMod;
    const label = `Dano: ${item.name} (${item.damage}${item.modifiers ? ` ${item.modifiers}` : ''})`;
    
    const newNotify: RollNotification = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'normal',
      value: diceSum,
      modifier: extraMod,
      attributeLabel: label,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [newNotify, ...prev].slice(0, 3));
    
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: 'normal',
        value: diceSum,
        modifier: extraMod,
        label: label,
        timestamp: Date.now(),
        advantageMode: 'none'
      });
    } catch (e) { console.error(e); }
  };

  const addMasterItemToInventory = async (mItem: MasterItem) => {
    if (!character) return;
    
    const currentWeight = calculateTotalSlots();
    const maxWeight = Math.max(character.attributes.STR, 10);
    
    if (currentWeight + mItem.slots > maxWeight) {
      alert(`Peso total excedido! Limite atual: ${maxWeight}. Espaço necessário: ${mItem.slots}.`);
      return;
    }

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      masterId: mItem.id,
      name: mItem.name,
      category: mItem.category,
      slots: mItem.slots,
      description: mItem.description,
      isEquipped: false,
      quantity: mItem.category === 'Pacote' ? (mItem.itemsPerSlot || 1) : 1,
      // Copies
      properties: mItem.properties,
      range: mItem.range,
      damage: mItem.damage,
      modifiers: mItem.modifiers,
      ac: mItem.ac,
      sumDex: mItem.sumDex,
      disadvantages: mItem.disadvantages,
      itemsPerSlot: mItem.itemsPerSlot,
      hands: mItem.hands,
      // Lighting
      ...(mItem.category === 'Iluminação' ? {
        lightDuration: mItem.lightDuration,
        lightRemaining: mItem.lightRemaining ?? mItem.lightDuration,
        lightIsActive: false,
        lightHasFuel: mItem.lightHasFuel,
        lightFuelItemId: mItem.lightFuelItemId,
        lightStartedAt: null
      } : {})
    };

    const updatedInventory = [...character.inventory, newItem];
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
  };

  const addCustomItemToInventory = async () => {
    if (!character || !customItemName) return;
    
    const currentWeight = calculateTotalSlots();
    const maxWeight = Math.max(character.attributes.STR, 10);
    
    if (currentWeight + customItemSlots > maxWeight) {
      alert(`Peso total excedido! Limite atual: ${maxWeight}. Espaço necessário: ${customItemSlots}.`);
      return;
    }

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      name: customItemName,
      category: 'Geral',
      slots: customItemSlots,
      description: customItemDescription,
      isEquipped: false,
      quantity: 1
    };

    const updatedInventory = [...character.inventory, newItem];
    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
    
    // Reset and close
    setCustomItemName("");
    setCustomItemSlots(1);
    setCustomItemDescription("");
    setIsCustomItemModalOpen(false);
  };

  const startEditingItem = (item: InventoryItem) => {
    setEditingItem({ ...item });
    setIsEditItemModalOpen(true);
  };

  const saveEditedItem = async () => {
    if (!character || !editingItem) return;
    
    // Check carrying limit if slots increased
    const originalItem = character.inventory.find(i => i.id === editingItem.id);
    const originalSlots = originalItem ? originalItem.slots : 0;
    const currentWeight = calculateTotalSlots();
    const maxWeight = Math.max(character.attributes.STR, 10);
    
    if (currentWeight - originalSlots + editingItem.slots > maxWeight) {
      alert(`Peso total excedido! Limite atual: ${maxWeight}. Peso com a modificação: ${currentWeight - originalSlots + editingItem.slots}.`);
      return;
    }

    const updatedInventory = character.inventory.map(item => {
      if (item.id === editingItem.id) {
        return { ...editingItem };
      }
      return item;
    });

    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
    
    setIsEditItemModalOpen(false);
    setEditingItem(null);
  };

  const toggleLightingItem = async (itemId: string) => {
    if (!character) return;
    
    const item = character.inventory.find(i => i.id === itemId);
    if (!item || item.category !== 'Iluminação') return;

    // Check fuel if needed
    if (!item.lightIsActive && item.lightHasFuel && item.lightFuelItemId) {
      const fuelItem = character.inventory.find(i => i.masterId === item.lightFuelItemId);
      if (!fuelItem) {
        alert("Você não possui o combustível necessário no inventário!");
        return;
      }
    }

    const now = Date.now() + timeOffset;
    let updatedInventory = character.inventory.map(i => {
      if (i.id === itemId) {
        if (i.lightIsActive) {
          // Deactivate/Pause
          const elapsed = (now - (i.lightStartedAt || now)) / 1000;
          return {
            ...i,
            lightIsActive: false,
            lightStartedAt: null,
            lightRemaining: Math.max(0, (i.lightRemaining || 0) - elapsed)
          };
        } else {
          // Activate
          return {
            ...i,
            lightIsActive: true,
            lightStartedAt: now
          };
        }
      }
      return i;
    });

    setCharacter(prev => prev ? { ...prev, inventory: updatedInventory } : null);
    await updateCharacterInDB({ inventory: updatedInventory });
  };

  const [localLightingState, setLocalLightingState] = useState<Record<string, number>>({});
  const [timeOffset, setTimeOffset] = useState(0);

  useEffect(() => {
    // Attempt to sync time with a public API to get server offset
    const syncTime = async () => {
      try {
        const start = Date.now();
        const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
        const data = await response.json();
        const serverTime = new Date(data.utc_datetime).getTime();
        const end = Date.now();
        const latency = (end - start) / 2;
        setTimeOffset(serverTime - (end - latency));
      } catch (e) {
        console.warn("Could not sync with server time, using local clock", e);
      }
    };
    syncTime();
  }, []);

  useEffect(() => {
    if (!character || !character.inventory) return;

    const interval = setInterval(() => {
      if (!character || !character.inventory) return;
      const now = Date.now() + timeOffset;
      const updatedLocal: Record<string, number> = {};
      let needsDBUpdate = false;
      let anyActive = false;
      const nextInventory = [...character.inventory];

      for (let i = 0; i < nextInventory.length; i++) {
        const item = nextInventory[i];
        if (item.category === 'Iluminação' && item.lightIsActive && item.lightStartedAt) {
          anyActive = true;
          const elapsed = (now - item.lightStartedAt) / 1000;
          const remaining = Math.max(0, (item.lightRemaining || 0) - elapsed);
          
          updatedLocal[item.id] = remaining;

          if (remaining <= 0) {
            needsDBUpdate = true;
            if (item.lightHasFuel && item.lightFuelItemId) {
              const fuelIndex = nextInventory.findIndex(f => f.masterId === item.lightFuelItemId);
              if (fuelIndex !== -1) {
                const fuelItem = nextInventory[fuelIndex];
                if ((fuelItem.quantity || 1) > 1) {
                  nextInventory[fuelIndex] = { ...fuelItem, quantity: (fuelItem.quantity || 1) - 1 };
                } else {
                  nextInventory.splice(fuelIndex, 1);
                  if (fuelIndex <= i) i--;
                }
                
                // Find torch again as index might have changed
                const torchIndex = nextInventory.findIndex(f => f.id === item.id);
                if (torchIndex !== -1) {
                  nextInventory[torchIndex] = { 
                    ...nextInventory[torchIndex], 
                    lightIsActive: false, 
                    lightStartedAt: null, 
                    lightRemaining: nextInventory[torchIndex].lightDuration 
                  };
                }
              } else {
                // No fuel present - just turn off
                const torchIndex = nextInventory.findIndex(f => f.id === item.id);
                if (torchIndex !== -1) {
                  nextInventory[torchIndex] = { ...nextInventory[torchIndex], lightIsActive: false, lightStartedAt: null, lightRemaining: 0 };
                }
              }
            } else {
              // Not a fuel item - consume itself
              nextInventory.splice(i, 1);
              i--;
            }
          }
        } else if (item.category === 'Iluminação') {
          updatedLocal[item.id] = item.lightRemaining || 0;
        }
      }

      if (anyActive) {
        setLocalLightingState(updatedLocal);
      }

      if (needsDBUpdate) {
        setCharacter(prev => prev ? { ...prev, inventory: nextInventory } : null);
        updateCharacterInDB({ inventory: nextInventory });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [character?.inventory]);

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
  const [sanityResult, setSanityResult] = useState<'success' | 'fail' | 'virtue' | null>(null);
  const [showVirtueChoice, setShowVirtueChoice] = useState(false);
  const [sanityLimitMessage, setSanityLimitMessage] = useState<string | null>(null);
  const [rolledTrait, setRolledTrait] = useState<{ trait: Trait, type: 'affliction' | 'virtue', isAggravated?: boolean } | null>(null);

  const logTraitRoll = async (trait: Trait, type: 'affliction' | 'virtue', customLabel?: string) => {
    if (!character || !charId) return;
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
    if (!charId || !character) return;
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
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

  const handleClearHistory = async () => {
    if (!charId) return;
    try {
      const q = query(collection(db, 'rolls'), where('characterId', '==', charId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      setHistory([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Carregando Ficha...</div>;
  if (!character) return <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest">Ficha não encontrada.</div>;

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

  const isValueInFormat = (val: number, rangeStr: string): boolean => {
    if (!rangeStr) return false;
    const parts = rangeStr.trim().split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0].trim(), 10);
      const max = parseInt(parts[1].trim(), 10);
      return val >= min && val <= max;
    } else {
      const single = parseInt(rangeStr.trim(), 10);
      return val === single;
    }
  };

  const getClassRollTable = (className: string, classDef?: CustomClass): { range: string; effect: string }[] => {
    if (classDef?.rollTable && classDef.rollTable.length === 5) {
      return classDef.rollTable;
    }
    
    const clsName = className.toLowerCase();
    if (clsName === 'guerreiro') {
      return [
        { range: '2', effect: '+1 no modificador de Força ou Destreza' },
        { range: '3-6', effect: 'Vantagem em rolagens de ataque com uma arma escolhida' },
        { range: '7-9', effect: '+1 em Jogadas de Proteção ou testes de Força/Destreza' },
        { range: '10-11', effect: '+2 de HP por nível adicional' },
        { range: '12', effect: 'Adicione seu nível às suas jogadas de dano físico' },
      ];
    } else if (clsName === 'sacerdote') {
      return [
        { range: '2', effect: '+1 no modificador de Sabedoria ou Constituição' },
        { range: '3-6', effect: 'Vantagem em rolagens de conjuração de um milagre conhecido' },
        { range: '7-9', effect: '+1 de defesa em armaduras médias e pesadas' },
        { range: '10-11', effect: '+1 em jogadas de afastar mortos-vivos (Turn Undead)' },
        { range: '12', effect: 'Escolha um milagre adicional de qualquer grau que possa conjurar' },
      ];
    } else if (clsName === 'mago') {
      return [
        { range: '2', effect: '+1 no modificador de Inteligência ou Constituição' },
        { range: '3-6', effect: 'Vantagem em rolagens de conjuração de uma magia conhecida' },
        { range: '7-9', effect: 'Aprenda 1 magia adicional de qualquer grau que possa conjurar' },
        { range: '10-11', effect: '+1 para todas as rolagens de conjuração arcana' },
        { range: '12', effect: '+1 no dano ou efeito de todas as suas magias arcanas' },
      ];
    } else if (clsName === 'ladino') {
      return [
        { range: '2', effect: '+1 no modificador de Destreza ou Carisma' },
        { range: '3-6', effect: '+1d6 de dano adicional em Ataque Furtivo' },
        { range: '7-9', effect: 'Vantagem em testes de Percepção ou iniciativa' },
        { range: '10-11', effect: 'Pode se camuflar perfeitamente se estiver nas sombras' },
        { range: '12', effect: 'Vantagem em testes de proteção contra venenos e armadilhas' },
      ];
    }
    
    return [
      { range: '2', effect: '+1 para Força, Destreza ou Constituição' },
      { range: '3-6', effect: '+1 para jogadas de ataque com armas' },
      { range: '7-9', effect: '+1 em jogadas de proteção ou testes de atributos' },
      { range: '10-11', effect: '+1 em rolagens de conjuração ou habilidades de classe' },
      { range: '12', effect: 'Vantagem em jogadas de iniciativa e testes de percepção' },
    ];
  };

  const getTalents = (): { name: string; description: string; type: 'initial' | 'level' | 'ancestry'; hasUses?: boolean; maxUses?: number; isCustom?: boolean }[] => {
    if (!character) return [];
    
    // 1. Core Starting talents
    let initialTalents: { name: string; description: string; type: 'initial'; hasUses?: boolean; maxUses?: number }[] = [];
    if (currentClassDef?.startingTalents) {
      initialTalents = currentClassDef.startingTalents.map(t => ({
        name: t.name,
        description: t.description,
        type: 'initial' as const,
        hasUses: t.hasUses,
        maxUses: t.maxUses
      }));
    } else {
      const clsName = character.class.toLowerCase();
      let fallbacks: { name: string; description: string }[] = [];
      if (clsName === 'guerreiro') {
        fallbacks = [
          { name: 'Especialista em Armas', description: '+1 para jogadas de ataque e dano com uma arma escolhida.' },
          { name: 'Firmeza', description: 'Adiciona seu nível à sua jogada de HP máximo.' }
        ];
      } else if (clsName === 'sacerdote') {
        fallbacks = [
          { name: 'Conjurar Milagres', description: 'Você pode conjurar milagres divinos.' },
          { name: 'Fugir do Mal', description: 'Vantagem em jogadas de proteção contra efeitos malignos.' }
        ];
      } else if (clsName === 'mago') {
        fallbacks = [
          { name: 'Conjuração Arcana', description: 'Você pode conjurar magias arcanas.' },
          { name: 'Saber Ancestral', description: 'Vantagem em testes para identificar itens mágicos ou fatos históricos.' }
        ];
      } else if (clsName === 'ladino') {
        fallbacks = [
          { name: 'Ataque Furtivo', description: '+1d6 de dano quando ataca um inimigo desprevenido ou flanqueado.' },
          { name: 'Habilidades de Ladino', description: 'Vantagem em testes de destreza englobando furtividade, ladinagem e escalada.' }
        ];
      }
      initialTalents = fallbacks.map(t => ({
        name: t.name,
        description: t.description,
        type: 'initial' as const
      }));
    }
    
    // 2. Acquired/stored Custom talents from DB
    const storedTalents = (character.talents || []).map(t => ({
      name: t.name,
      description: t.description,
      type: t.type || 'level',
      hasUses: !!t.hasUses,
      maxUses: t.maxUses,
      isCustom: true
    }));
    
    return [...initialTalents, ...storedTalents];
  };

  const handleAcquireTalentRoll = async () => {
    if (!character || !charId) return;
    
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    
    const table = getClassRollTable(character.class, currentClassDef || undefined);
    const match = table.find(row => isValueInFormat(sum, row.range));
    const effectText = match ? match.effect : "Efeito não cadastrado na tabela.";
    
    try {
      const newTalent = {
        name: `Talento de Nível (Rolado: ${sum})`,
        description: effectText,
        type: 'level' as const
      };
      
      const updatedTalents = [...(character.talents || []), newTalent];
      
      setCharacter(prev => {
        if (!prev) return null;
        return {
          ...prev,
          talents: updatedTalents
        };
      });
      
      await updateDoc(doc(db, 'characters', charId), {
        talents: updatedTalents
      });
      
      setRollResult({ d1, d2, sum, effect: effectText });
      setIsRollConfirmOpen(false);
      setIsRollResultOpen(true);
    } catch (err) {
      console.error("Error setting acquired talent:", err);
    }
  };

  const handleGMAddTalent = async () => {
    if (!character || !charId || !isGM) return;
    
    let finalName = gmCustomName.trim();
    let finalDesc = gmCustomDescription.trim();
    
    if (gmSelectedTalentRow !== 'custom') {
      const idx = typeof gmSelectedTalentRow === 'number' ? gmSelectedTalentRow : 0;
      const table = getClassRollTable(character.class, currentClassDef || undefined);
      const row = table[idx];
      if (row) {
        if (!finalName) {
          finalName = `${gmCustomType === 'initial' ? 'Talento Inicial' : gmCustomType === 'ancestry' ? 'Talento de Ancestralidade' : 'Talento de Nível'} (${row.range})`;
        }
        if (!finalDesc) {
          finalDesc = row.effect;
        }
      }
    }
    
    if (!finalName || !finalDesc) {
      return;
    }
    
    try {
      const newTalent = {
        name: finalName,
        description: finalDesc,
        type: gmCustomType
      };
      
      const updatedTalents = [...(character.talents || []), newTalent];
      
      setCharacter(prev => {
        if (!prev) return null;
        return {
          ...prev,
          talents: updatedTalents
        };
      });
      
      await updateDoc(doc(db, 'characters', charId), {
        talents: updatedTalents
      });
      
      setIsGMAddTalentOpen(false);
      setGmSelectedTalentRow(0);
      setGmCustomName('');
      setGmCustomDescription('');
      setGmCustomType('level');
    } catch (err) {
      console.error("Error manually adding talent:", err);
    }
  };

  const handleDeleteTalent = async (talentName: string) => {
    if (!character || !charId || !isGM) return;
    try {
      const updatedTalents = (character.talents || []).filter(t => t.name !== talentName);
      setCharacter(prev => {
        if (!prev) return null;
        return {
          ...prev,
          talents: updatedTalents
        };
      });
      await updateDoc(doc(db, 'characters', charId), {
        talents: updatedTalents
      });
    } catch (err) {
      console.error("Error removing talent:", err);
    }
  };

  const toggleTalentUse = async (talentName: string, maxUses: number, currentUses: number, increment: boolean) => {
    if (!character || !charId) return;
    const nextUses = increment
      ? Math.min(maxUses, currentUses + 1)
      : Math.max(0, currentUses - 1);

    try {
      const updatedTalentUses = {
        ...(character.talentUses || {}),
        [talentName]: nextUses
      };
      
      // Update local state and DB
      setCharacter(prev => {
        if (!prev) return null;
        return {
          ...prev,
          talentUses: updatedTalentUses
        };
      });
      await updateDoc(doc(db, 'characters', charId), {
        talentUses: updatedTalentUses
      });
    } catch (e) {
      console.error("Error toggling talent use:", e);
    }
  };

  const resetAllTalents = async () => {
    if (!character || !charId) return;
    try {
      setCharacter(prev => {
        if (!prev) return null;
        return {
          ...prev,
          talentUses: {}
        };
      });
      await updateDoc(doc(db, 'characters', charId), {
        talentUses: {}
      });
    } catch (e) {
      console.error("Error resetting all talents:", e);
    }
  };

  const updateArmor = (updates: Partial<CharacterState['armor']>) => {
    if (!character) return;
    const newArmor = { ...character.armor, ...updates };
    setCharacter(p => p ? { ...p, armor: newArmor } : null);
    updateCharacterInDB({ armor: newArmor });
  };

  const updateShield = (updates: Partial<CharacterState['shield']>) => {
    if (!character) return;
    const newShield = { ...character.shield, ...updates };
    setCharacter(p => p ? { ...p, shield: newShield } : null);
    updateCharacterInDB({ shield: newShield });
  };

  const updateXP = (amount: number) => {
    if (!character) return;
    const newXP = Math.max(0, character.xp + amount);
    setCharacter(prev => prev ? { ...prev, xp: newXP } : null);
    updateCharacterInDB({ xp: newXP });
  };

  const levelUp = async () => {
    if (!character) return;
    const maxXPNeeded = character.level * 10;
    if (character.xp < maxXPNeeded) return;

    const newLevel = character.level + 1;
    const remainingXP = Math.max(0, character.xp - maxXPNeeded);
    setCharacter(prev => prev ? { ...prev, level: newLevel, xp: remainingXP } : null);
    await updateCharacterInDB({ level: newLevel, xp: remainingXP });
    setIsLevelingUp(true);
  };

  const updateStress = (amount: number) => {
    if (!character) return;
    const newStress = Math.max(0, Math.min(20, character.stress + amount));
    setCharacter(prev => prev ? { ...prev, stress: newStress } : null);
    updateCharacterInDB({ stress: newStress });
    
    // If stress hits 20, automatic failure / roll insanity table
    if (newStress === 20 && amount > 0) {
      setSanityResult('fail');
    }
  };

  const toggleAdvDis = async (key: keyof CharacterState['attributes'], type: 'advantage' | 'disadvantage') => {
    if (!character) return;
    const current = character.advDis[key];
    let newVal: 'advantage' | 'disadvantage' | null = type;
    
    if (current === type) newVal = null;

    const updatedAdvDis = { ...character.advDis, [key]: newVal };
    setCharacter(p => p ? { ...p, advDis: updatedAdvDis } : null);
    await updateCharacterInDB({ advDis: updatedAdvDis });
  };

  const handleRoll = async (attrKey: keyof CharacterState['attributes']) => {
    playDiceSound();
    const val = character.attributes[attrKey];
    const mod = getModifier(val);
    const advMode = character.advDis[attrKey] || 'none';

    let diceValue = 0;
    let r1: number | undefined;
    let r2: number | undefined;

    if (advMode === 'advantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      diceValue = Math.max(r1, r2);
    } else if (advMode === 'disadvantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      diceValue = Math.min(r1, r2);
    } else {
      diceValue = Math.floor(Math.random() * 20) + 1;
    }

    const isCrit = diceValue === 20;
    const isFumble = diceValue === 1;

    const newNotify: RollNotification = {
      id: Math.random().toString(36).substring(2, 11),
      type: isCrit ? 'crit-success' : isFumble ? 'crit-fail' : 'normal',
      value: diceValue,
      modifier: mod,
      attributeLabel: ATTR_LABELS[attrKey],
      r1,
      r2,
      advDis: advMode === 'none' ? null : advMode,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotify, ...prev].slice(0, 3));
    // History is handled by onSnapshot now

    // Save to Firestore for GM tracking
    if (!charId) return;
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: newNotify.type,
        value: diceValue,
        modifier: mod,
        label: ATTR_LABELS[attrKey],
        timestamp: Date.now(),
        advantageMode: advMode,
        r1: r1 || null,
        r2: r2 || null
      });
    } catch (e) {
      console.error("Failed to sync roll:", e);
    }

    // Reset advantage/disadvantage after roll
    const updatedAdvDis = { ...character.advDis, [attrKey]: null };
    setCharacter(p => p ? { ...p, advDis: updatedAdvDis } : null);
    await updateCharacterInDB({ advDis: updatedAdvDis });
  };

  const handleSanityRoll = async () => {
    playDiceSound();
    const diceValue = Math.floor(Math.random() * 20) + 1;
    const dc = 12 + character.stress; // DC scales with stress
    
    let resTitle = "";
    let resType: RollNotification['type'] = 'normal';
    const label = "Teste de Sanidade";

    if (diceValue === 20) {
      resTitle = "VIRTUDE";
      resType = 'virtue';
    } else if (diceValue === 1) {
      resTitle = "AFLIÇÃO";
      resType = 'crit-fail';
    } else if (diceValue >= dc) {
      resTitle = "SUCESSO";
      resType = 'sanity-success';
    } else {
      resTitle = "FALHA";
      resType = 'sanity-fail';
    }

    const newNotify: RollNotification = {
      id: Math.random().toString(36).substring(2, 11),
      type: resType,
      value: diceValue,
      modifier: 0,
      attributeLabel: `${label}: ${resTitle}`,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotify, ...prev].slice(0, 3));

    if (!charId) return;
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: resType,
        value: diceValue,
        modifier: 0,
        label: `${label}: ${resTitle}`,
        timestamp: Date.now(),
        isSanityRoll: true,
        sanityResult: resTitle,
        dc
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpellRoll = async (spell: Spell) => {
    if (!character) return;
    playDiceSound();

    let attrKey: keyof CharacterState['attributes'] = 'INT';
    let attrLabel = 'Inteligência';

    if (currentClassDef?.isSpellcaster && currentClassDef?.castAttribute) {
      attrKey = currentClassDef.castAttribute;
      attrLabel = attrKey === 'INT' ? 'Inteligência' : attrKey === 'WIS' ? 'Sabedoria' : 'Carisma';
    } else if (character.class === 'Mago') {
      attrKey = 'INT';
      attrLabel = 'Inteligência';
    } else if (character.class === 'Sacerdote') {
      attrKey = 'WIS';
      attrLabel = 'Sabedoria';
    } else if (character.class === 'Bruxa' || character.class === 'Cavaleiro Amaldiçoado') {
      attrKey = 'CHA';
      attrLabel = 'Carisma';
    }

    const val = character.attributes[attrKey];
    const mod = getModifier(val);
    const spellMod = character.spellModifier ?? 0;
    const totalModifier = mod + spellMod;
    const targetDC = 10 + spell.tier;

    const spellMode = spellAdvDis[spell.id] || 'none';
    const advMode = spellMode !== 'none' ? spellMode : (character.advDis[attrKey] || 'none');
    let diceValue = 0;
    let r1: number | undefined;
    let r2: number | undefined;

    if (advMode === 'advantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      diceValue = Math.max(r1, r2);
    } else if (advMode === 'disadvantage') {
      r1 = Math.floor(Math.random() * 20) + 1;
      r2 = Math.floor(Math.random() * 20) + 1;
      diceValue = Math.min(r1, r2);
    } else {
      diceValue = Math.floor(Math.random() * 20) + 1;
    }

    const totalResult = diceValue + totalModifier;

    const isCritSuccess = diceValue === 20;
    const isCritFail = diceValue === 1;

    let resType: RollNotification['type'] = 'normal';
    let resTitle = '';

    if (isCritFail) {
      resType = 'crit-fail';
      resTitle = 'FALHA CRÍTICA';
    } else if (isCritSuccess) {
      resType = 'crit-success';
      resTitle = 'SUCESSO CRÍTICO';
    } else if (totalResult >= targetDC) {
      resType = 'sanity-success';
      resTitle = 'SUCESSO';
    } else {
      resType = 'sanity-fail';
      resTitle = 'FALHA';
    }

    const labelStr = `Conjuração: ${spell.name} (${resTitle} - Alvo: ${targetDC})`;

    const newNotify: RollNotification = {
      id: Math.random().toString(36).substring(2, 11),
      type: resType,
      value: diceValue,
      modifier: totalModifier,
      attributeLabel: `${attrLabel} [Magia]: ${resTitle}`,
      r1,
      r2,
      advDis: advMode === 'none' ? null : advMode,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotify, ...prev].slice(0, 3));

    if (!charId) return;
    try {
      const rollRef = doc(collection(db, 'rolls'));
      await setDoc(rollRef, {
        id: rollRef.id,
        characterId: charId,
        characterName: character.name,
        userId: character.userId,
        type: resType,
        value: diceValue,
        modifier: totalModifier,
        label: labelStr,
        timestamp: Date.now(),
        advantageMode: advMode,
        r1: r1 || null,
        r2: r2 || null,
        targetDC,
        isSpellRoll: true
      });
    } catch (e) {
      console.error("Failed to sync spell roll:", e);
    }

    // Reset advantage/disadvantage after roll
    setSpellAdvDis(prev => ({ ...prev, [spell.id]: 'none' }));
    const updatedAdvDis = { ...character.advDis, [attrKey]: null };
    setCharacter(p => p ? { ...p, advDis: updatedAdvDis } : null);
    await updateCharacterInDB({ advDis: updatedAdvDis });
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] pb-32">
      {/* Character Header */}
      <header className="sticky top-0 z-40 bg-[#0c0c0e]/80 backdrop-blur-xl border-b border-zinc-800/50 px-6 py-4">
        <div className="max-w-[98%] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="space-y-0.5">
               <div className="flex items-center gap-2">
                 {isEditingName ? (
                   <div className="flex items-center gap-2">
                     <input 
                       type="text"
                       value={tempName}
                       onChange={(e) => setTempName(e.target.value)}
                       className="bg-zinc-950 border border-amber-500/50 rounded-lg px-2 py-0.5 text-xl font-black italic uppercase tracking-tighter text-white outline-none w-48"
                       autoFocus
                     />
                     <button 
                       onClick={() => {
                         updateCharacterInDB({ name: tempName });
                         setIsEditingName(false);
                       }}
                       className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg"
                     ><Plus size={14} /></button>
                     <button 
                        onClick={() => setIsEditingName(false)}
                        className="p-1.5 text-zinc-600"
                     ><X size={14} /></button>
                   </div>
                 ) : (
                   <>
                     <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">{character.name}</h1>
                     <button 
                        onClick={() => {
                          setTempName(character.name);
                          setIsEditingName(true);
                        }}
                        className="p-1 text-zinc-700 hover:text-amber-500 transition-colors"
                     >
                       <EditIcon size={12} />
                     </button>
                   </>
                 )}
               </div>
               <div className="flex items-center gap-3">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                   NÍVEL {character.level.toString().padStart(2, '0')}
                 </span>
                 <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                   {character.ancestry} {character.class}
                 </span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsHistoryOpen(true)}
               className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
             >
               <History size={20} />
             </button>
             <button 
                onClick={() => setIsCustomDiceOpen(true)}
                className="p-3 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
             >
                <Dices size={20} />
             </button>
          </div>
        </div>
      </header>

      {/* Rolo de Notificações */}
      <div className="fixed bottom-24 right-6 left-6 z-[100] pointer-events-none flex flex-col items-end gap-3">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div 
              key={n.id}
              initial={{ x: 50, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 20, opacity: 0, scale: 0.9 }}
              className={`pointer-events-auto p-4 rounded-3xl border shadow-2xl flex items-center gap-4 min-w-[320px] relative transition-all ${
                n.type === 'virtue' ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]' :
                n.type === 'crit-success' ? 'bg-amber-500 border-amber-400 text-white' :
                n.type === 'crit-fail' ? 'bg-rose-600 border-rose-500 text-white' :
                n.type === 'sanity-success' ? 'bg-emerald-600 border-emerald-500 text-white' :
                'bg-zinc-900 border-zinc-800 text-white'
              }`}
            >
              <button 
                onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                className="absolute top-2 right-2 p-1 text-white/40 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>

              <div className="flex items-center gap-4 w-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-3xl shrink-0 ${
                  n.type === 'crit-success' || n.type === 'virtue' ? 'bg-white/20' :
                  n.type === 'crit-fail' ? 'bg-white/10' :
                  n.type === 'sanity-success' ? 'bg-white/20' :
                  'bg-amber-500/10 text-amber-500'
                }`}>
                  {n.value + n.modifier}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 truncate">{n.attributeLabel}</span>
                    {n.advDis && (
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        n.advDis === 'advantage' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {n.advDis === 'advantage' ? 'Vantagem' : 'Desvantagem'}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm font-bold flex items-center gap-2">
                    {n.type === 'crit-success' ? 'SUCESSO CRÍTICO!' : 
                     n.type === 'virtue' ? 'VIRTUDE!' :
                     n.type === 'crit-fail' ? 'FALHA CRÍTICA!' :
                     n.type === 'sanity-success' ? 'SUCESSO!' :
                     n.type === 'sanity-fail' ? 'FALHA!' :
                     <span>Result: <span className="font-mono">{n.value}</span> {n.modifier >= 0 ? '+' : ''}<span className="opacity-60">{n.modifier}</span></span>}
                    
                    {n.r1 && n.r2 && (
                      <div className="flex items-center gap-1 ml-auto opacity-40 font-mono text-xs">
                        (<span className={n.advDis === 'advantage' ? (n.r1 >= n.r2 ? 'text-white' : '') : (n.r1 <= n.r2 ? 'text-white' : '')}>{n.r1}</span>
                        <span>,</span>
                        <span className={n.advDis === 'advantage' ? (n.r2 >= n.r1 ? 'text-white' : '') : (n.r2 <= n.r1 ? 'text-white' : '')}>{n.r2}</span>)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <main className="max-w-[98%] mx-auto p-4 flex gap-6 items-start">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Core Stats */}
          <div className="lg:col-span-3 space-y-6">
          {/* HP Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 space-y-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 font-black">Pontos de Vida</h2>
                    <div className="text-2xl font-black text-white italic flex items-center gap-1">
                      {character.hp.current}
                      <span className="text-zinc-700 mx-1">/</span>
                      {isEditingMaxHp ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={tempMaxHp}
                            onChange={(e) => setTempMaxHp(parseInt(e.target.value) || 0)}
                            className="w-16 bg-zinc-950 border border-amber-500/50 rounded px-1 py-0.5 text-xl font-black text-white outline-none"
                            autoFocus
                          />
                          <button 
                            onClick={() => {
                              updateCharacterInDB({ hp: { ...character.hp, max: tempMaxHp } });
                              setIsEditingMaxHp(false);
                            }}
                            className="p-1 bg-amber-500/10 text-amber-500 rounded"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span className="text-zinc-500">{character.hp.max}</span>
                          <button 
                            onClick={() => {
                              setTempMaxHp(character.hp.max);
                              setIsEditingMaxHp(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-amber-500 transition-all"
                          >
                            <EditIcon size={12} />
                          </button>
                        </div>
                      )}
                      {character.hp.temp > 0 && <span className="text-sky-400 ml-2">+{character.hp.temp}</span>}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTempHPOpen(true)}
                  className="p-2 bg-sky-500/10 text-sky-500 rounded-lg hover:bg-sky-500/20 transition-colors"
                >
                  <Shield size={16} />
                </button>
             </div>

             {/* Bar progress */}
             <div className="relative h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(character.hp.current / Math.max(character.hp.max, character.hp.current + character.hp.temp)) * 100}%` }}
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-rose-600 to-rose-400"
                />
                {character.hp.temp > 0 && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(character.hp.temp / Math.max(character.hp.max, character.hp.current + character.hp.temp)) * 100}%` }}
                    style={{ left: `${(character.hp.current / Math.max(character.hp.max, character.hp.current + character.hp.temp)) * 100}%` }}
                    className="absolute top-0 h-full bg-gradient-to-r from-sky-400 to-sky-600"
                  />
                )}
             </div>

             <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateHP(-hpAdjustAmount)}
                  className="w-14 h-14 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 hover:border-rose-500 transition-all shadow-inner"
                >
                  <Minus size={24} />
                </button>
                
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                  <input 
                    type="number"
                    value={hpAdjustAmount}
                    onChange={(e) => setHpAdjustAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-14 bg-transparent text-center font-black text-2xl text-white outline-none"
                  />
                </div>
                
                <button 
                  onClick={() => updateHP(hpAdjustAmount)}
                  className="w-14 h-14 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 transition-all shadow-inner"
                >
                  <Plus size={24} />
                </button>
             </div>
          </div>

          {/* Attributes List */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <h2 className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 font-black">Atributos</h2>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(Object.entries(character.attributes) as [keyof CharacterState['attributes'], number][]).map(([attrKey, val]) => (
                    <div key={attrKey} className="flex items-center gap-2 group/row">
                      <div className="flex-1">
                        <AttributeCard 
                          value={val}
                          label={ATTR_LABELS[attrKey]}
                          advDisStatus={character.advDis[attrKey]}
                          onUpdate={(v) => updateAttribute(attrKey, v)}
                          onRoll={() => handleRoll(attrKey)}
                          onToggleAdvDis={(type) => toggleAdvDis(attrKey, type)}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleRoll(attrKey)}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-700 hover:text-amber-500 hover:border-amber-500/30 transition-all active:scale-95 shadow-inner shrink-0"
                        title={`Rolar ${ATTR_LABELS[attrKey]}`}
                      >
                        <D20Icon size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
        </div>

        {/* Center/Right Column: Tabs & Content */}
        <div className="lg:col-span-9 space-y-8">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {/* Nível */}
               {character.xp >= maxXP ? (
                 <button
                   onClick={async () => {
                     if (isLevelingUp) return;
                     setIsLevelingUp(true);
                     await levelUp();
                     setIsLevelingUp(false);
                   }}
                   disabled={isLevelingUp}
                   className="w-full text-left bg-gradient-to-br from-amber-500/20 to-zinc-900 border-2 border-amber-500 rounded-[32px] p-6 transition-all relative overflow-hidden cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:border-amber-400 active:scale-[0.98] group shrink-0"
                 >
                   <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors animate-pulse" />
                   
                   <div className="relative z-10 flex flex-col justify-between h-full">
                     <div className="flex justify-between items-start">
                       <h3 className="text-[10px] uppercase tracking-[0.3em] text-amber-500 font-extrabold mb-1">
                         Subir de Nível!
                       </h3>
                       <span className="bg-amber-500 text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-bounce">
                         Pronto
                       </span>
                     </div>
                     <div className="flex items-baseline gap-2 mt-2">
                       <div className="text-3xl font-black text-white italic leading-none">
                         Nível {character.level.toString().padStart(2, '0')}
                       </div>
                       <span className="text-amber-500 text-lg font-black italic">→</span>
                       <span className="text-amber-400 text-3xl font-black italic leading-none">
                         {(character.level + 1).toString().padStart(2, '0')}
                       </span>
                     </div>
                     <span className="text-[8px] text-zinc-400 font-black tracking-widest mt-3 uppercase">
                       Clique para Confirmar
                     </span>
                   </div>
                 </button>
               ) : (
                 <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 group hover:border-amber-500/30 transition-all relative overflow-hidden">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black mb-1">Nível</h3>
                    {isGM && isEditingLevel ? (
                      <div className="flex items-center gap-2">
                         <input 
                           type="number"
                           value={tempLevel}
                           onChange={(e) => setTempLevel(parseInt(e.target.value) || 0)}
                           className="w-20 bg-zinc-950 border border-amber-500/50 rounded-lg px-2 py-1 text-2xl font-black text-white outline-none"
                           autoFocus
                         />
                         <button 
                           onClick={() => {
                             updateCharacterInDB({ level: tempLevel });
                             setIsEditingLevel(false);
                           }}
                           className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"
                         >
                           <Check size={20} />
                         </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/lvl">
                         <div className="text-3xl font-black text-white italic leading-none">{character.level.toString().padStart(2, '0')}</div>
                         {isGM && (
                           <button 
                             onClick={() => {
                               setTempLevel(character.level);
                               setIsEditingLevel(true);
                             }}
                             className="opacity-0 group-hover/lvl:opacity-100 p-1 text-zinc-700 hover:text-amber-500 transition-all"
                           >
                             <EditIcon size={16} />
                           </button>
                         )}
                      </div>
                    )}
                 </div>
               )}
               
               {/* Defesa */}
               <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 group hover:border-sky-500/30 transition-all relative overflow-hidden">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black mb-1">Defesa</h3>
                  <div className="text-3xl font-black text-white italic leading-none">{calculateArmorClass()}</div>
               </div>

               {/* Experiência */}
               <div className="md:col-span-2 lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 group hover:border-emerald-500/30 transition-all relative overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black">Experiência</h3>
                    <div className="text-[10px] font-black text-emerald-500 italic uppercase flex items-center gap-1">
                       {isGM && isEditingXP ? (
                         <div className="flex items-center gap-1">
                           <input 
                             type="number"
                             value={tempXP}
                             onChange={(e) => setTempXP(parseInt(e.target.value) || 0)}
                             className="w-12 bg-zinc-950 border border-emerald-500/50 rounded px-1 text-[9px] font-black text-white outline-none"
                             autoFocus
                           />
                           <button 
                             onClick={() => {
                               updateCharacterInDB({ xp: tempXP });
                               setIsEditingXP(false);
                             }}
                             className="p-0.5 bg-emerald-500/10 text-emerald-500 rounded"
                           >
                             <Check size={8} />
                           </button>
                         </div>
                       ) : (
                         <div className="flex items-center gap-1 group/xp">
                           {character.xp} / {maxXP} XP
                           {isGM && (
                             <button 
                               onClick={() => {
                                 setTempXP(character.xp);
                                 setIsEditingXP(true);
                               }}
                               className="opacity-0 group-hover/xp:opacity-100 p-0.5 text-zinc-700 hover:text-emerald-500 transition-all"
                             >
                               <EditIcon size={8} />
                             </button>
                           )}
                         </div>
                       )}
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white italic leading-none">
                    {Math.max(0, Math.min(100, Math.round((character.xp / maxXP) * 100)))}%
                  </div>
                  
                  {/* Progress Bar "Bottom of the card" */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-zinc-950/50">
                    <div 
                      className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-500"
                      style={{ width: `${Math.min(100, (character.xp / maxXP) * 100)}%` }}
                    />
                  </div>
               </div>
            </div>

            {/* Content Tabs */}
            <div className="space-y-6">
              <nav className="flex items-center gap-2 p-1.5 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-x-auto no-scrollbar">
                {(['combat', 'equip', 'talents', 'spell', 'traits', 'extra'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === tab ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {tab === 'combat' ? 'Combate' : 
                     tab === 'equip' ? 'Inv.' : 
                     tab === 'talents' ? 'Talentos' : 
                     tab === 'spell' ? 'Magia' : 
                     tab === 'traits' ? 'Aflições' : 'Extras'}
                  </button>
                ))}
              </nav>

              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-[40px] h-[780px] flex flex-col overflow-hidden shadow-2xl relative">
                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="min-h-full"
                    >
                      {activeTab === 'combat' && (
                        <div className="space-y-8">

                           <div className="hidden">
                              <button
                                onClick={() => setAdvantageMode(advantageMode === 'advantage' ? 'none' : 'advantage')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                  advantageMode === 'advantage' ? 'bg-emerald-500 text-white' : 'bg-zinc-950 text-zinc-500 hover:text-emerald-500'
                                }`}
                              >
                                <ChevronsUp size={16} /> Vantagem
                              </button>
                              <button
                                onClick={() => setAdvantageMode('none')}
                                className={`p-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                  advantageMode === 'none' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-950 text-zinc-600 hover:text-zinc-300'
                                }`}
                              >
                                Normal
                              </button>
                              <button
                                onClick={() => setAdvantageMode(advantageMode === 'disadvantage' ? 'none' : 'disadvantage')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                  advantageMode === 'disadvantage' ? 'bg-rose-500 text-white' : 'bg-zinc-950 text-zinc-500 hover:text-rose-500'
                                }`}
                              >
                                <ChevronsDown size={16} /> Desvantagem
                              </button>
                           </div>

                           <div className="space-y-6">
                               {/* Weapon Attacks */}
                               <div className="flex items-center gap-3">
                                 <h3 className="text-sm font-black uppercase italic text-white leading-none">Ataques</h3>
                               </div>
                               <div className="space-y-4">
                                     {/* Inventory Weapons */}
                                     {character.inventory.filter(i => i.category === 'Arma').map(weapon => (
                                       <div key={weapon.id} className={`bg-zinc-950 border transition-all rounded-2xl overflow-hidden ${expandedItemId === weapon.id ? 'border-amber-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}>
                                          <div 
                                            onClick={() => setExpandedItemId(expandedItemId === weapon.id ? null : weapon.id)}
                                            className="p-4 cursor-pointer flex items-center justify-between group"
                                          >
                                             <div className="flex items-center gap-4">


                                                <div className="flex-1 min-w-0">
                                                   <div className="text-sm font-black text-white italic uppercase tracking-tight truncate">{weapon.name}</div>
                                                   <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{weapon.damage} • {weapon.range}</div>
                                                </div>
                                             </div>
                                             <div className="flex items-center gap-4">
                                               <div className="flex flex-wrap items-center gap-2">
															{/* Advantage / Disadvantage toggles */}
															<div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800/80 p-0.5 rounded-xl shrink-0 font-sans">
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		toggleWeaponAdvDis(weapon.id, 'advantage');
																	}}
																	className={`px-2 py-1 text-[9px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer border ${
																		weaponAdvDis[weapon.id] === 'advantage'
																			? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-black select-none'
																			: 'bg-transparent text-zinc-550 border-transparent hover:text-zinc-355'
																	}`}
																	title="Rolar este ataque com Vantagem"
																>
																	Van
																</button>
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		toggleWeaponAdvDis(weapon.id, 'disadvantage');
																	}}
																	className={`px-2 py-1 text-[9px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer border ${
																		weaponAdvDis[weapon.id] === 'disadvantage'
																			? 'bg-rose-500/15 text-rose-450 border-rose-500/35 shadow-[0_0_8px_rgba(244,63,94,0.15)] font-black select-none'
																			: 'bg-transparent text-zinc-550 border-transparent hover:text-zinc-355 select-none'
																	}`}
																	title="Rolar este ataque com Desvantagem"
																>
																	Des
																</button>
															</div>

															<button 
																onClick={(e) => { e.stopPropagation(); rollWeaponAttack(weapon); }}
                                                    className="w-10 h-10 bg-amber-600/10 text-amber-500 rounded-lg flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all shadow-inner"
                                                    title="Atacar"
                                                  >
                                                    <Target size={18} />
                                                  </button>
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); rollWeaponDamage(weapon); }}
                                                    className="w-10 h-10 bg-rose-600/10 text-rose-500 rounded-lg flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-inner"
                                                    title="Rolar Dano"
                                                  >
                                                    <D20Icon size={18} />
                                                  </button>
                                               </div>
                                               {expandedItemId === weapon.id ? <ChevronUp className="text-zinc-700" size={16} /> : <ChevronDown className="text-zinc-700" size={16} />}
                                             </div>
                                          </div>

                                          <AnimatePresence>
                                            {expandedItemId === weapon.id && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                              >
                                                <div className="px-4 pb-4 pt-0 space-y-4">
                                                  {weapon.description && (
                                                    <p className="text-[11px] text-zinc-500 leading-relaxed italic border-t border-zinc-900 pt-3">{weapon.description}</p>
                                                  )}
                                                  
                                                  {weapon.properties && weapon.properties.includes('Acuidade') && (
                                                    <div className="flex flex-col gap-2 pt-2 border-t border-zinc-900">
                                                       <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Atributo de Ataque (Acuidade)</p>
                                                       <div className="flex gap-2">
                                                          <button 
                                                            onClick={() => handleUpdateFinesse(weapon.id, 'STR')}
                                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                                              (weapon.finesseAttribute || 'STR') === 'STR' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500'
                                                            }`}
                                                          >Força</button>
                                                          <button 
                                                            onClick={() => handleUpdateFinesse(weapon.id, 'DEX')}
                                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                                              weapon.finesseAttribute === 'DEX' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500'
                                                            }`}
                                                          >Destreza</button>
                                                       </div>
                                                    </div>
                                                  )}

                                                  <div className="flex gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest pt-2">
                                                     {weapon.properties?.map(p => (
                                                       <span key={p} className="px-2 py-0.5 bg-zinc-900 rounded-md">{p}</span>
                                                     ))}
                                                  </div>
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                       </div>
                                     ))}
                                  {character.inventory.filter(i => i.category === 'Arma').length === 0 && (
                                    <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                                      <p className="text-[10px] uppercase font-black tracking-widest">Nenhuma arma equipada no momento</p>
                                    </div>
                                  )}
                               </div>
                           </div>
                        </div>
                      )}

                      {activeTab === 'equip' && (
                        <div className="space-y-6">
                          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
                            <div className="flex items-center justify-between">
                               <div className="space-y-1">
                                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Inventário</h3>
                                 <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Peso Atual: {calculateTotalSlots()} / {Math.max(character.attributes.STR, 10)}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                 <button 
                                  onClick={() => setIsCustomItemModalOpen(true)}
                                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black uppercase text-[10px] tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2 border border-zinc-700"
                                 >
                                  <Plus size={16} /> Novo Item
                                 </button>
                                 <button 
                                  onClick={() => setIsItemModalOpen(true)}
                                  className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2"
                                 >
                                  <Plus size={16} /> Adicionar Item
                                 </button>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                               {character.inventory.map(item => (
                                 <div 
                                  key={item.id} 
                                  className={`bg-zinc-950 border transition-all rounded-2xl overflow-hidden ${expandedItemId === item.id ? 'border-amber-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}
                                 >
                                    <div 
                                      onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                      className="p-4 cursor-pointer flex items-center justify-between group"
                                    >
                                       <div className="flex items-center gap-4">

                                            

                                             
                                          {item.category === 'Iluminação' && (
                                            <CircularProgress 
                                               value={localLightingState[item.id] ?? item.lightRemaining ?? 0} 
                                               max={item.lightDuration ?? 3600} 
                                               active={item.lightIsActive || false}
                                            />
                                          )}
                                          <div className="flex-1 min-w-0">
                                             <div className="text-sm font-black text-white italic uppercase tracking-tight truncate">{item.name}</div>
                                             <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                                               {item.category === 'Pacote' ? `${item.quantity} un.` : `${item.slots} slots`} • {item.category}
                                               {item.isEquipped && <span className="ml-2 text-amber-500 italic">Equipado</span>}
                                             </div>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          {item.category === 'Iluminação' && (
                                             <button
                                               onClick={(e) => { e.stopPropagation(); toggleLightingItem(item.id); }}
                                               className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                                 item.lightIsActive 
                                                 ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' 
                                                 : 'bg-zinc-800 text-zinc-500 hover:text-white'
                                               }`}
                                               title={item.lightIsActive ? 'Pausar' : 'Acender'}
                                             >
                                               {item.lightIsActive ? <Pause size={18} /> : <Play size={18} />}
                                             </button>
                                          )}
                                          {item.category === 'Pacote' && (
                                            <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 mr-2" onClick={(e) => e.stopPropagation()}>
                                               <button 
                                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                                className="p-1.5 text-zinc-500 hover:text-white"
                                               >
                                                <Minus size={14} />
                                               </button>
                                               <input 
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value) || 0;
                                                  handleUpdateQuantity(item.id, val - (item.quantity || 0));
                                                }}
                                                className="w-10 bg-transparent text-center text-[10px] font-black text-white outline-none"
                                               />
                                               <button 
                                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                                className="p-1.5 text-zinc-500 hover:text-white"
                                               >
                                                <Plus size={14} />
                                               </button>
                                            </div>
                                         )}
                                         {expandedItemId === item.id ? <ChevronUp className="text-zinc-700" size={16} /> : <ChevronDown className="text-zinc-700" size={16} />}
                                       </div>
                                    </div>

                                    <AnimatePresence>
                                      {expandedItemId === item.id && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                        >
                                          <div className="px-4 pb-4 pt-0 space-y-4">
                                            {item.description && (
                                              <p className="text-[11px] text-zinc-500 leading-relaxed italic border-t border-zinc-900 pt-3">{item.description}</p>
                                            )}

                                            {item.category === 'Arma' && (
                                              <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                                                   <p className="text-[8px] font-black text-zinc-600 uppercase mb-0.5">Dano</p>
                                                   <p className="text-xs font-bold text-white">{item.damage}</p>
                                                </div>
                                                <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                                                   <p className="text-[8px] font-black text-zinc-600 uppercase mb-0.5">Alcance</p>
                                                   <p className="text-xs font-bold text-white">{item.range}</p>
                                                </div>
                                              </div>
                                            )}

                                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-900">
																			  <div className="flex items-center gap-2">
																				<button
																					onClick={() => startEditingItem(item)}
																					className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all bg-zinc-900 text-zinc-400 hover:text-white"
																				>
																					<Edit size={12} /> Editar
																				</button>
																				{(item.category === 'Armadura' || item.category === 'Escudo') && (
                                                  <button
                                                    onClick={() => handleToggleEquip(item.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                                      item.isEquipped ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'
                                                    }`}
                                                  >
                                                    {item.isEquipped ? <Check size={12} /> : <Shield size={12} />}
                                                    {item.isEquipped ? 'Equipado' : 'Equipar'}
                                                  </button>
                                                )}
                                              </div>

                                              <button 
                                                onClick={() => removeItem(item.id)}
                                                className="p-2 text-zinc-800 hover:text-rose-500 transition-colors"
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                 </div>
                               ))}
                               {character.inventory.length === 0 && (
                                 <div className="col-span-full py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black tracking-widest">Seu inventário está vazio</p>
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'spell' && (
                        <div className="space-y-6">
                          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
                            <div className="flex items-center justify-between">
                               <div className="space-y-1">
                                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Grimório</h3>
                                 <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Sua coleção de magias e milagres</p>
                               </div>
                               <button 
                                onClick={() => setIsSpellModalOpen(true)}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-4 py-3 rounded-xl transition-all flex items-center gap-2"
                               >
                                <BookOpen size={16} /> Aprender
                               </button>
                            </div>

                            {/* Modificador de Conjuração Adicional */}
                            <div className="flex items-center justify-between p-3.5 bg-zinc-950/30 border border-zinc-900/80 rounded-xl mb-2">
                              <div className="flex flex-col">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Modificador de Conjuração Adicional</h4>
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest leading-none mt-0.5">Aplicado a rolagens de grimório</p>
                              </div>
                              
                              {isEditingSpellMod ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="number"
                                    value={tempSpellMod}
                                    onChange={(e) => setTempSpellMod(parseInt(e.target.value) || 0)}
                                    className="w-12 bg-zinc-950 border border-amber-500/50 rounded px-2 py-0.5 text-xs font-mono text-center font-black text-white outline-none"
                                    autoFocus
                                    onBlur={() => {
                                      updateCharacterInDB({ spellModifier: tempSpellMod });
                                      setIsEditingSpellMod(false);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateCharacterInDB({ spellModifier: tempSpellMod });
                                        setIsEditingSpellMod(false);
                                      }
                                    }}
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      updateCharacterInDB({ spellModifier: tempSpellMod });
                                      setIsEditingSpellMod(false);
                                    }}
                                    className="p-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 rounded"
                                  >
                                    <Check size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/mod">
                                  <span className="font-mono text-xs font-black text-zinc-300 bg-zinc-950 border border-zinc-900 px-2.5 py-1 rounded-lg">
                                    {(character.spellModifier ?? 0) >= 0 ? `+${character.spellModifier ?? 0}` : character.spellModifier}
                                  </span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setTempSpellMod(character.spellModifier ?? 0);
                                      setIsEditingSpellMod(true);
                                    }}
                                    className="opacity-60 hover:opacity-100 p-1 text-zinc-500 hover:text-amber-500 transition-all"
                                    title="Editar Modificador"
                                  >
                                    <EditIcon size={12} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                               {character.spells.map(spell => {
                                 const isExpanded = !!expandedSpells[spell.id];
                                 return (
                                   <div key={spell.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-750 transition-all p-5 relative group">
                                      <div className="flex flex-col gap-3">
                                         {/* Header Row */}
                                         <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                               <span className="text-[8px] font-black bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2 py-0.5 rounded uppercase font-mono">Grau {spell.tier}</span>
                                               <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest italic">{spell.range}</span>
                                               {spell.duration && (
                                                 <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest italic">• {spell.duration}</span>
                                               )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 z-10">
                                               {/* Advantage / Disadvantage toggles */}
                                               <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800/80 p-0.5 rounded-xl shrink-0 font-sans">
                                                 <button
                                                   type="button"
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     toggleSpellAdvDis(spell.id, 'advantage');
                                                   }}
                                                   className={`px-2 py-1 text-[9px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer border ${
                                                     spellAdvDis[spell.id] === 'advantage'
                                                       ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-black select-none'
                                                       : 'bg-transparent text-zinc-550 border-transparent hover:text-zinc-355'
                                                   }`}
                                                   title="Rolar esta magia com Vantagem"
                                                 >
                                                   Van
                                                 </button>
                                                 <button
                                                   type="button"
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     toggleSpellAdvDis(spell.id, 'disadvantage');
                                                   }}
                                                   className={`px-2 py-1 text-[9px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer border ${
                                                     spellAdvDis[spell.id] === 'disadvantage'
                                                       ? 'bg-rose-500/15 text-rose-405 border-rose-500/35 shadow-[0_0_8px_rgba(244,63,94,0.15)] font-black select-none'
                                                       : 'bg-transparent text-zinc-550 border-transparent hover:text-zinc-355 select-none'
                                                   }`}
                                                   title="Rolar esta magia com Desvantagem"
                                                 >
                                                   Des
                                                 </button>
                                               </div>

                                               {/* Spell Roll Button */}
                                               <button
                                                 type="button"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleSpellRoll(spell);
                                                 }}
                                                 className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/30 text-amber-500 hover:text-amber-400 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0 shadow-sm"
                                                 title="Rolar Teste de Conjuração"
                                               >
                                                 <D20Icon size={14} />
                                                 <span>Rolar</span>
                                               </button>

                                               {/* Delete Button */}
                                               <button 
                                                 type="button"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setSpellToRemove(spell.id);
                                                 }}
                                                 className="p-1 px-2 bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-rose-500 hover:border-rose-500/20 rounded-xl transition-colors"
                                                 title="Remover Magia"
                                               >
                                                 <Trash2 size={12} />
                                               </button>

                                               {/* Toggle Collapse Button */}
                                               <button
                                                 type="button"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   toggleSpellExpanded(spell.id);
                                                 }}
                                                 className="p-1 text-zinc-600 hover:text-white transition-colors"
                                               >
                                                 {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                               </button>
                                            </div>
                                         </div>

                                         {/* Body/Title area */}
                                         <div 
                                           onClick={() => toggleSpellExpanded(spell.id)}
                                           className="cursor-pointer space-y-2 select-none"
                                         >
                                            <h4 className="text-base font-black text-white italic uppercase tracking-tight hover:text-amber-500 transition-colors flex items-center gap-2">
                                               {spell.name}
                                               <span className="text-[10px] font-normal font-sans text-zinc-500 tracking-normal capitalize">
                                                 (CD {10 + spell.tier})
                                               </span>
                                            </h4>
                                            
                                            <AnimatePresence initial={false}>
                                               {isExpanded ? (
                                                 <motion.div
                                                   initial={{ height: 0, opacity: 0 }}
                                                   animate={{ height: "auto", opacity: 1 }}
                                                   exit={{ height: 0, opacity: 0 }}
                                                   transition={{ duration: 0.2 }}
                                                   className="overflow-hidden"
                                                 >
                                                    <p className="text-[11px] text-zinc-400 leading-relaxed italic pr-4 pb-2 pt-1">
                                                      {spell.description}
                                                    </p>
                                                    {(() => {
                                                      const spellTypes = Array.isArray(spell.type) ? spell.type : (spell.type ? [spell.type] : []);
                                                      if (spellTypes.length === 0) return null;
                                                      return (
                                                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-900">
                                                          {spellTypes.map((t, idx) => (
                                                            <span key={idx} className="text-[8px] font-black uppercase text-zinc-500 px-1.5 py-0.5 bg-zinc-900 border border-zinc-800/40 rounded">
                                                              {t}
                                                            </span>
                                                          ))}
                                                        </div>
                                                      );
                                                    })()}
                                                 </motion.div>
                                               ) : (
                                                 <p className="text-[11px] text-zinc-500 leading-relaxed italic truncate max-w-[90%]">
                                                    {spell.description}
                                                 </p>
                                               )}
                                            </AnimatePresence>
                                         </div>
                                      </div>
                                   </div>
                                 );
                               })}
                               {character.spells.length === 0 && (
                                 <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black tracking-widest">Nenhuma magia aprendida</p>
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'traits' && (
                        <div className="space-y-6">
                          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
                            <div className="flex items-center justify-between">
                               <div className="space-y-1">
                                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Aflições</h3>
                                 <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Condições mentais e físicas que afetam o seu desempenho</p>
                               </div>
                            </div>
                            <div className="space-y-4">
                               {character.afflictions.length === 0 ? (
                                 <div className="py-12 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl opacity-50">
                                    <p className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Nenhuma aflição ativa</p>
                                 </div>
                               ) : (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {character.afflictions.map(a => (
                                     <div key={a.id} className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl relative group">
                                        <div className="flex justify-between items-center mb-2">
                                          <h5 className="font-black italic text-white uppercase text-sm tracking-wide">{a.name}</h5>
                                          {isGM && (
                                            <button onClick={() => removeAffliction(a.id)} className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-400 transition-colors">
                                              Curar
                                            </button>
                                          )}
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-relaxed">{a.description}</p>
                                     </div>
                                   ))}
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'talents' && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
                            <div>
                              <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                                <Award className="text-amber-500" size={16} /> Meus Talentos
                              </h3>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                                Habilidades especiais e talentos de sua classe
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => setIsRollConfirmOpen(true)}
                                className="text-[9px] uppercase font-black text-rose-500 border border-rose-500/20 px-3 py-1.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 transition-all hover:border-rose-500/30 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles size={10} /> Adquirir Talento
                              </button>

                              {isGM && (
                                <button
                                  onClick={() => setIsGMAddTalentOpen(true)}
                                  className="text-[9px] uppercase font-black text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-xl bg-violet-500/5 hover:bg-violet-500/10 transition-all hover:border-violet-500/30 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus size={10} /> Mestre: Add Manual
                                </button>
                              )}

                              {getTalents().some(t => t.hasUses) && (
                                <button
                                  onClick={resetAllTalents}
                                  className="text-[9px] uppercase font-black text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 transition-all hover:border-amber-500/30 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Zap size={10} /> Restaurar Usos
                                </button>
                              )}
                            </div>
                          </div>

                          {getTalents().length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-zinc-750 py-24 space-y-4 border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/20">
                              <Award size={40} className="opacity-10" />
                              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500">Nenhum talento cadastrado</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {getTalents().map((talent) => {
                                const current = character?.talentUses?.[talent.name] || 0;
                                const max = talent.maxUses || 1;
                                return (
                                  <div 
                                    key={talent.name}
                                    className="bg-zinc-900 border border-zinc-850 p-5 rounded-[24px] flex flex-col justify-between gap-4 hover:border-zinc-800 transition-all relative group"
                                  >
                                    <div className="space-y-1.5 pr-6">
                                      <div className="flex flex-wrap gap-1.5 items-center mb-1">
                                        {talent.type === 'initial' && (
                                          <span className="text-[7px] tracking-wider font-extrabold uppercase px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">
                                            Talento Inicial
                                          </span>
                                        )}
                                        {talent.type === 'level' && (
                                          <span className="text-[7px] tracking-wider font-extrabold uppercase px-1.5 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded">
                                            Talento de Nível
                                          </span>
                                        )}
                                        {talent.type === 'ancestry' && (
                                          <span className="text-[7px] tracking-wider font-extrabold uppercase px-1.5 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded">
                                            Talento de Ancestralidade
                                          </span>
                                        )}
                                      </div>

                                      <h4 className="font-extrabold text-white text-sm uppercase italic tracking-wide">{talent.name}</h4>
                                      <p className="text-xs text-zinc-400 leading-relaxed">{talent.description}</p>
                                    </div>

                                    {talent.isCustom && isGM && (
                                      <button 
                                        onClick={() => handleDeleteTalent(talent.name)}
                                        className="absolute right-4 top-4 p-1 rounded-md text-rose-500 hover:text-rose-400 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition-all cursor-pointer"
                                        title="Mestre: Excluir Talento"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}

                                    {talent.hasUses && (
                                      <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-between">
                                        <div className="space-y-1">
                                          <span className="text-[8px] uppercase font-black text-zinc-500 block">Usos Restantes</span>
                                          <div className="flex items-center gap-1.5">
                                            {Array.from({ length: max }).map((_, i) => {
                                              const remaining = Math.max(0, max - current);
                                              const isFilled = i < remaining;
                                              return (
                                                <button
                                                  key={i}
                                                  onClick={() => {
                                                    if (isFilled) {
                                                      toggleTalentUse(talent.name, max, current, true);
                                                    } else {
                                                      toggleTalentUse(talent.name, max, current, false);
                                                    }
                                                  }}
                                                  className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                                                    isFilled 
                                                      ? 'bg-amber-500 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                                      : 'border-zinc-750 bg-zinc-950 hover:border-zinc-500'
                                                  }`}
                                                  title={isFilled ? "Gastar uso" : "Recuperar uso"}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => toggleTalentUse(talent.name, max, current, false)}
                                            disabled={current === 0}
                                            className="w-7 h-7 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center text-xs font-black disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                            title="Recuperar uso"
                                          >
                                            +
                                          </button>
                                          <span className="font-mono text-xs font-bold text-white w-9 text-center">
                                            {Math.max(0, max - current)}/{max}
                                          </span>
                                          <button
                                            onClick={() => toggleTalentUse(talent.name, max, current, true)}
                                            disabled={current >= max}
                                            className="w-7 h-7 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center justify-center text-xs font-black disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                            title="Gastar uso"
                                          >
                                            -
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'extra' && (() => {
                        const BUILT_IN_CLASSES: Record<string, {
                          hd: string;
                          weapons: string;
                          armors: string;
                          isSpellcaster: boolean;
                          spellsTable?: { level: number; tiers: number[] }[];
                        }> = {
                          guerreiro: {
                            hd: "1d8",
                            weapons: "Todas as armas comuns e marciais (adagas, espadas, machados, arcos, etc.)",
                            armors: "Todas as armaduras e escudos",
                            isSpellcaster: false,
                          },
                          sacerdote: {
                            hd: "1d6",
                            weapons: "Clava, maça, carrilhão/bastão, cajado, lança, funda",
                            armors: "Armaduras leves, armaduras médias e escudos",
                            isSpellcaster: true,
                            spellsTable: [
                              { level: 1, tiers: [2, 0, 0, 0, 0] },
                              { level: 2, tiers: [3, 0, 0, 0, 0] },
                              { level: 3, tiers: [3, 1, 0, 0, 0] },
                              { level: 4, tiers: [3, 2, 0, 0, 0] },
                              { level: 5, tiers: [3, 2, 1, 0, 0] },
                              { level: 6, tiers: [3, 2, 2, 0, 0] },
                              { level: 7, tiers: [3, 2, 2, 1, 0] },
                              { level: 8, tiers: [3, 2, 2, 2, 0] },
                              { level: 9, tiers: [3, 2, 2, 2, 1] },
                              { level: 10, tiers: [3, 2, 2, 2, 2] },
                            ]
                          },
                          mago: {
                            hd: "1d4",
                            weapons: "Adaga, cajado",
                            armors: "Nenhuma armadura ou escudo",
                            isSpellcaster: true,
                            spellsTable: [
                              { level: 1, tiers: [3, 0, 0, 0, 0] },
                              { level: 2, tiers: [4, 0, 0, 0, 0] },
                              { level: 3, tiers: [4, 1, 0, 0, 0] },
                              { level: 4, tiers: [4, 2, 0, 0, 0] },
                              { level: 5, tiers: [4, 2, 1, 0, 0] },
                              { level: 6, tiers: [4, 2, 2, 0, 0] },
                              { level: 7, tiers: [4, 2, 2, 1, 0] },
                              { level: 8, tiers: [4, 2, 2, 2, 0] },
                              { level: 9, tiers: [4, 2, 2, 2, 1] },
                              { level: 10, tiers: [4, 2, 2, 2, 2] },
                            ]
                          },
                          ladino: {
                            hd: "1d6",
                            weapons: "Clava, adaga, besta de mão, adaga de arremesso, espada curta, espada longa, arco curto, funda",
                            armors: "Armadura leve (couro)",
                            isSpellcaster: false,
                          },
                          profanador: {
                            hd: "1d8",
                            weapons: "Todas as armas comuns e de duas mãos",
                            armors: "Todas as armaduras e escudos",
                            isSpellcaster: false,
                          },
                          bruxa: {
                            hd: "1d4",
                            weapons: "Adaga, cajado, chicote, maça de mão",
                            armors: "Nenhuma armadura ou escudo",
                            isSpellcaster: true,
                            spellsTable: [
                              { level: 1, tiers: [2, 0, 0, 0, 0] },
                              { level: 2, tiers: [3, 0, 0, 0, 0] },
                              { level: 3, tiers: [3, 1, 0, 0, 0] },
                              { level: 4, tiers: [3, 2, 0, 0, 0] },
                              { level: 5, tiers: [3, 2, 1, 0, 0] },
                              { level: 6, tiers: [3, 2, 2, 0, 0] },
                              { level: 7, tiers: [3, 2, 2, 1, 0] },
                              { level: 8, tiers: [3, 2, 2, 2, 0] },
                              { level: 9, tiers: [3, 2, 2, 2, 1] },
                              { level: 10, tiers: [3, 2, 2, 2, 2] },
                            ]
                          },
                          "cavaleiro amaldiçoado": {
                            hd: "1d8",
                            weapons: "Todas as armas comuns e marciais",
                            armors: "Todas as armaduras e escudos",
                            isSpellcaster: true,
                            spellsTable: [
                              { level: 1, tiers: [1, 0, 0, 0, 0] },
                              { level: 2, tiers: [2, 0, 0, 0, 0] },
                              { level: 3, tiers: [2, 1, 0, 0, 0] },
                              { level: 4, tiers: [2, 2, 0, 0, 0] },
                              { level: 5, tiers: [2, 2, 1, 0, 0] },
                              { level: 6, tiers: [2, 2, 2, 0, 0] },
                              { level: 7, tiers: [2, 2, 2, 1, 0] },
                              { level: 8, tiers: [2, 2, 2, 2, 0] },
                              { level: 9, tiers: [2, 2, 2, 2, 1] },
                              { level: 10, tiers: [2, 2, 2, 2, 2] },
                            ]
                          },
                          duelista: {
                            hd: "1d8",
                            weapons: "Espada curta, florete, adaga, pistola, besta leve",
                            armors: "Armaduras leves e médias",
                            isSpellcaster: false,
                          },
                          bardo: {
                            hd: "1d6",
                            weapons: "Adaga, espada curta, florete, funda, arco curto",
                            armors: "Armadura de couro",
                            isSpellcaster: false,
                          }
                        };

                        const lowerClass = character ? character.class.trim().toLowerCase() : '';
                        const builtInClass = BUILT_IN_CLASSES[lowerClass];

                        const classHD = currentClassDef?.hd || builtInClass?.hd || "1d6";
                        const classWeapons = currentClassDef?.weapons || builtInClass?.weapons || currentClassDef?.weaponsArmor || "Adagas, espadas, cajados";
                        const classArmors = currentClassDef?.armors?.join(", ") || builtInClass?.armors || "Armadura leve";
                        const isCasterClass = currentClassDef?.isSpellcaster || builtInClass?.isSpellcaster || false;
                        const talentsTableRows = getClassRollTable(character.class, currentClassDef || undefined);

                        const spellsProgressionRows = [];
                        if (isCasterClass) {
                          if (currentClassDef?.spellsPerLevel) {
                            for (let lvl = 1; lvl <= 10; lvl++) {
                              const tiers = currentClassDef.spellsPerLevel[String(lvl)] || [0, 0, 0, 0, 0];
                              spellsProgressionRows.push({ level: lvl, tiers });
                            }
                          } else if (builtInClass?.spellsTable) {
                            spellsProgressionRows.push(...builtInClass.spellsTable);
                          } else {
                            spellsProgressionRows.push(
                              { level: 1, tiers: [2, 0, 0, 0, 0] },
                              { level: 2, tiers: [3, 0, 0, 0, 0] },
                              { level: 3, tiers: [3, 1, 0, 0, 0] },
                              { level: 4, tiers: [3, 2, 0, 0, 0] },
                              { level: 5, tiers: [3, 2, 1, 0, 0] },
                              { level: 6, tiers: [3, 2, 2, 0, 0] },
                              { level: 7, tiers: [3, 2, 2, 1, 0] },
                              { level: 8, tiers: [3, 2, 2, 2, 0] },
                              { level: 9, tiers: [3, 2, 2, 2, 1] },
                              { level: 10, tiers: [3, 2, 2, 2, 2] },
                            );
                          }
                        }

                        return (
                          <div className="space-y-6 text-zinc-100">
                            {/* Class identification card */}
                            <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
                              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-500">
                                <Zap size={24} />
                              </div>
                              <div>
                                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Classe: {character.class}</h2>
                                <p className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest mt-1">Informações básicas e progressão detalhada da classe</p>
                              </div>
                            </div>

                            {/* Basic stats row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
                                <div className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Dado de Vida (HD)</div>
                                <div className="text-2xl font-black italic text-zinc-100 tracking-tight">{classHD}</div>
                              </div>
                              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 space-y-2 col-span-1 md:col-span-2">
                                <div className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Armas Permitidas</div>
                                <div className="text-xs font-bold text-zinc-200 leading-relaxed">{classWeapons}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
                                <div className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Armaduras e Escudos</div>
                                <div className="text-xs font-bold text-zinc-200 leading-relaxed">{classArmors}</div>
                              </div>
                            </div>

                            {/* Tabela de Talentos de Classe (Rolagens de Nível) */}
                            <div className="space-y-3 pt-4">
                              <h3 className="text-[12px] uppercase font-black tracking-widest text-zinc-100 border-l-2 border-amber-500 pl-3">Tabela de Talentos de Classe</h3>
                              <div className="overflow-hidden border border-zinc-800 rounded-2xl bg-zinc-950/50">
                                <table className="w-full border-collapse text-left">
                                  <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                                      <th className="px-5 py-3 text-[9px] uppercase font-black text-zinc-400 tracking-wider w-24">Resultado (2d6)</th>
                                      <th className="px-5 py-3 text-[9px] uppercase font-black text-zinc-400 tracking-wider">Efeito do Talento obtido</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/80">
                                    {talentsTableRows.map((row, idx) => (
                                      <tr key={idx} className="hover:bg-zinc-900/50 transition-all">
                                        <td className="px-5 py-4 font-mono font-black text-amber-500 text-xs">
                                          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded font-bold">
                                            {row.range}
                                          </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs font-bold text-zinc-200 leading-relaxed">{row.effect}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Tabela de Magias Conhecidas por Nível */}
                            {isCasterClass && (
                              <div className="space-y-3 pt-6">
                                <h3 className="text-[12px] uppercase font-black tracking-widest text-zinc-100 border-l-2 border-violet-500 pl-3">Magias Conhecidas por Grau e Nível</h3>
                                <div className="overflow-x-auto border border-zinc-800 rounded-2xl bg-zinc-950/50 no-scrollbar">
                                  <table className="w-full border-collapse text-center min-w-[500px]">
                                    <thead>
                                      <tr className="border-b border-zinc-800 bg-zinc-900/80">
                                        <th className="px-4 py-3 text-[9px] uppercase font-black text-zinc-400 tracking-wider text-left w-20 pl-6">Nível</th>
                                        <th className="px-4 py-3 text-[9px] uppercase font-black text-violet-400 tracking-wider">M1 (Grau 1)</th>
                                        <th className="px-4 py-3 text-[9px] uppercase font-black text-violet-400 tracking-wider">M2 (Grau 2)</th>
                                        <th className="px-4 py-3 text-[9px] uppercase font-black text-violet-400 tracking-wider">M3 (Grau 3)</th>
                                        <th className="px-4 py-3 text-[9px] uppercase font-black text-violet-400 tracking-wider">M4 (Grau 4)</th>
                                        <th className="px-4 py-3 text-[9px] uppercase font-black text-violet-400 tracking-wider">M5 (Grau 5)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/80">
                                      {spellsProgressionRows.map((row) => (
                                        <tr 
                                          key={row.level} 
                                          className={`transition-all hover:bg-violet-950/10 ${
                                            character.level === row.level ? "bg-amber-500/10 border-y border-amber-500/20" : ""
                                          }`}
                                        >
                                          <td className="px-4 py-4 text-xs font-black text-zinc-300 text-left pl-6">
                                            {character.level === row.level ? (
                                              <span className="text-amber-500 flex items-center gap-1.5">
                                                Nível {row.level} <span className="text-[8px] bg-amber-500/20 px-1 py-0.5 rounded font-black uppercase text-amber-500">Atual</span>
                                              </span>
                                            ) : (
                                              `Nível ${row.level}`
                                            )}
                                          </td>
                                          <td className="px-4 py-4 text-xs font-mono text-zinc-200 font-extrabold">{row.tiers[0] > 0 ? `${row.tiers[0]}` : "-"}</td>
                                          <td className="px-4 py-4 text-xs font-mono text-zinc-200 font-extrabold">{row.tiers[1] > 0 ? `${row.tiers[1]}` : "-"}</td>
                                          <td className="px-4 py-4 text-xs font-mono text-zinc-200 font-extrabold">{row.tiers[2] > 0 ? `${row.tiers[2]}` : "-"}</td>
                                          <td className="px-4 py-4 text-xs font-mono text-zinc-200 font-extrabold">{row.tiers[3] > 0 ? `${row.tiers[3]}` : "-"}</td>
                                          <td className="px-4 py-4 text-xs font-mono text-zinc-200 font-extrabold">{row.tiers[4] > 0 ? `${row.tiers[4]}` : "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setIsItemModalOpen(false)} 
               className="absolute inset-0 bg-black/90 backdrop-blur-md" 
             />
             <motion.div 
               initial={{ y: '100%', opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }} 
               exit={{ y: '100%', opacity: 0 }} 
               className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col"
               style={{ maxHeight: '90vh' }}
             >
                <div className="p-8 border-b border-zinc-800 flex flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Adicionar Item</h2>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Selecione o equipamento</p>
                    </div>
                    <button onClick={() => setIsItemModalOpen(false)} className="p-2 bg-zinc-800 rounded-xl text-zinc-500 hover:text-white"><X size={20} /></button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input 
                      type="text"
                      placeholder="Procurar item..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(['Geral', 'Arma', 'Armadura', 'Escudo', 'Pacote', 'Iluminação'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setItemModalTab(tab)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                          itemModalTab === tab ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {tab === 'Geral' ? 'Itens' : tab === 'Arma' ? 'Armas' : tab === 'Armadura' ? 'Armaduras' : tab === 'Escudo' ? 'Escudos' : tab === 'Pacote' ? 'Pacotes' : 'Iluminação'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[400px]">
                   {masterItems
                    .filter(i => i.category === itemModalTab && i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                    .map(mItem => (
                      <button
                        key={mItem.id}
                        onClick={() => addMasterItemToInventory(mItem)}
                        className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between hover:border-amber-500/50 transition-all group text-left"
                      >
                        <div className="flex flex-col gap-1 min-w-0 pr-4">
                           <span className="text-sm font-black text-white italic uppercase tracking-tight group-hover:text-amber-500">{mItem.name}</span>
                           <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                             {mItem.slots} slot{mItem.slots !== 1 ? 's' : ''}
                             {mItem.category === 'Arma' && ` • ${mItem.damage}`}
                             {mItem.category === 'Armadura' && ` • CA ${mItem.ac}`}
                             {mItem.category === 'Escudo' && ` • +2 CA`}
                             {mItem.category === 'Iluminação' && ` • ${(mItem.lightDuration || 3600) / 3600}h`}
                           </span>
                        </div>
                        <div className="p-2 bg-zinc-900 rounded-xl text-amber-500 group-hover:bg-amber-500 group-hover:text-black transition-all">
                          <Plus size={16} />
                        </div>
                      </button>
                    ))
                   }
                   {masterItems.filter(i => i.category === itemModalTab && i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())).length === 0 && (
                     <div className="h-full flex items-center justify-center text-zinc-700 uppercase font-black text-[10px] tracking-widest py-20">Nenhum item encontrado</div>
                   )}
                </div>

                <div className="p-8 border-t border-zinc-800 bg-zinc-950/50">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Espaço Livre</span>
                       <span className="text-lg font-black text-white italic">{Math.max(character.attributes.STR, 10) - calculateTotalSlots()}</span>
                    </div>
                    <button onClick={() => setIsItemModalOpen(false)} className="px-8 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest rounded-xl hover:text-white transition-all">Fechar</button>
                  </div>
                </div>
             </motion.div>
          </div>
        )}

        {isCustomItemModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setIsCustomItemModalOpen(false)} 
               className="absolute inset-0 bg-black/90 backdrop-blur-md" 
             />
             <motion.div 
               initial={{ y: '100%', opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }} 
               exit={{ y: '100%', opacity: 0 }} 
               className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col"
             >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Novo Item</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Crie um item personalizado</p>
                  </div>
                  <button onClick={() => setIsCustomItemModalOpen(false)} className="p-2 bg-zinc-800 rounded-xl text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] no-scrollbar">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome do Item</label>
                    <input 
                      type="text"
                      maxLength={50}
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      placeholder="Ex: Medalhão Antigo"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-700"
                    />
                  </div>

                  {/* Slots Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Espaços Ocupados</label>
                    <div className="flex items-center gap-4">
                       <button 
                        onClick={() => setCustomItemSlots(Math.max(0, customItemSlots - 1))}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                       ><Minus size={18} /></button>
                       <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl h-12 flex items-center justify-center text-xl font-black text-white italic">
                         {customItemSlots}
                       </div>
                       <button 
                        onClick={() => setCustomItemSlots(customItemSlots + 1)}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                       ><Plus size={18} /></button>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Descrição</label>
                      <span className="text-[10px] font-black text-zinc-700">{customItemDescription.length}/200</span>
                    </div>
                    <textarea 
                      maxLength={200}
                      value={customItemDescription}
                      onChange={(e) => setCustomItemDescription(e.target.value)}
                      placeholder="Descreva as propriedades do item..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-medium outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-700 resize-none text-sm"
                    />
                  </div>
                </div>

                <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex gap-4">
                   <button 
                    onClick={() => setIsCustomItemModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:text-white transition-all"
                   >Cancelar</button>
                   <button 
                    disabled={!customItemName}
                    onClick={addCustomItemToInventory}
                    className="flex-[2] py-4 bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-amber-500 transition-all disabled:opacity-50 disabled:grayscale"
                   >Criar Item</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditItemModalOpen && editingItem && (
          <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => { setIsEditItemModalOpen(false); setEditingItem(null); }} 
               className="absolute inset-0 bg-black/90 backdrop-blur-md" 
             />
             <motion.div 
               initial={{ y: '100%', opacity: 0 }} 
               animate={{ y: 0, opacity: 1 }} 
               exit={{ y: '100%', opacity: 0 }} 
               className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col"
             >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Editar Item</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Modificando apenas este item na ficha</p>
                  </div>
                  <button onClick={() => { setIsEditItemModalOpen(false); setEditingItem(null); }} className="p-2 bg-zinc-800 rounded-xl text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] no-scrollbar">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 font-mono">Nome do Item</label>
                    <input 
                      type="text"
                      maxLength={50}
                      value={editingItem.name}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/55 transition-all text-sm"
                    />
                  </div>

                  {/* Slots Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 font-mono">Espaços Ocupados</label>
                    <div className="flex items-center gap-4">
                       <button 
                        type="button"
                        onClick={() => setEditingItem(prev => prev ? { ...prev, slots: Math.max(0, prev.slots - 1) } : null)}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white transition-all cursor-pointer"
                       ><Minus size={18} /></button>
                       <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl h-12 flex items-center justify-center text-xl font-black text-white italic">
                         {editingItem.slots}
                       </div>
                       <button 
                        type="button"
                        onClick={() => setEditingItem(prev => prev ? { ...prev, slots: prev.slots + 1 } : null)}
                        className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white transition-all cursor-pointer"
                       ><Plus size={18} /></button>
                    </div>
                  </div>

                  {/* Conditional properties based on category */}
                  {editingItem.category === 'Arma' && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Damage */}
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 font-mono">Dano (Ex: 1d8)</label>
                        <input 
                          type="text"
                          maxLength={20}
                          value={editingItem.damage || ''}
                          onChange={(e) => setEditingItem(prev => prev ? { ...prev, damage: e.target.value } : null)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/55 transition-all placeholder:text-zinc-700 text-sm"
                        />
                      </div>

                      {/* Range */}
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 font-mono">Alcance (Ex: Curto)</label>
                        <input 
                          type="text"
                          maxLength={30}
                          value={editingItem.range || ''}
                          onChange={(e) => setEditingItem(prev => prev ? { ...prev, range: e.target.value } : null)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/55 transition-all placeholder:text-zinc-700 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {(editingItem.category === 'Armadura' || editingItem.category === 'Escudo') && (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 font-mono">Classe de Armadura (CA)</label>
                      <input 
                        type="number"
                        min={0}
                        max={30}
                        value={editingItem.ac || 0}
                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, ac: parseInt(e.target.value) || 0 } : null)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/55 transition-all text-sm"
                      />
                    </div>
                  )}

                  {/* Modifiers */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1 font-mono">Modificadores / Propriedades</label>
                    <input 
                      type="text"
                      maxLength={100}
                      value={editingItem.modifiers || ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, modifiers: e.target.value } : null)}
                      placeholder="Ex: Ágil, Discreta"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/55 transition-all placeholder:text-zinc-700 text-sm"
                    />
                  </div>

                  {/* Description Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 font-mono">Descrição</label>
                      <span className="text-[10px] font-black text-zinc-700">{(editingItem.description || '').length}/200</span>
                    </div>
                    <textarea 
                      maxLength={200}
                      value={editingItem.description || ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                      placeholder="Descreva as propriedades do item..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-medium outline-none focus:border-amber-500/55 transition-all placeholder:text-zinc-700 resize-none text-sm"
                    />
                  </div>
                </div>

                <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex gap-4">
                   <button 
                    type="button"
                    onClick={() => { setIsEditItemModalOpen(false); setEditingItem(null); }}
                    className="flex-1 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:text-white transition-all cursor-pointer"
                   >Cancelar</button>
                   <button 
                    type="button"
                    disabled={!editingItem.name}
                    onClick={saveEditedItem}
                    className="flex-[2] py-4 bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-amber-500 transition-all disabled:opacity-50 disabled:grayscale cursor-pointer"
                   >Salvar Alterações</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-zinc-900 border-l border-zinc-800 z-[210] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                      <History size={18} className="text-amber-500" />
                      <h2 className="text-sm font-black uppercase tracking-widest text-white italic">Histórico</h2>
                   </div>
                   <button 
                     onClick={handleClearHistory}
                     className="text-[8px] uppercase font-black tracking-widest text-zinc-600 hover:text-rose-500 transition-colors"
                   >
                     Limpar
                   </button>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="text-zinc-600 hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-700 uppercase font-black text-[10px] tracking-widest">Sem registros</div>
                ) : (
                  history.map(entry => (
                    <div 
                      key={entry.id} 
                      className={`p-4 border rounded-2xl flex items-center justify-between transition-all ${
                        entry.type === 'virtue' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                        entry.type === 'crit-fail' && (entry.label || '').includes('Sanidade') ? 'bg-rose-500/10 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.1)]' :
                        'bg-zinc-950 border-zinc-900'
                      }`}
                    >
                      <div>
                        <div className="text-[8px] uppercase font-bold text-zinc-600">{entry.label}</div>
                        <div className="text-xl font-black text-white italic">
                          {entry.value + entry.modifier}
                          {entry.type === 'virtue' && <span className="ml-2 text-[10px] text-amber-500">(!)</span>}
                          {entry.type === 'crit-fail' && (entry.label || '').includes('Sanidade') && <span className="ml-2 text-[10px] text-rose-500">(!)</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-mono text-zinc-800">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                        {entry.advantageMode && entry.advantageMode !== 'none' && (
                          <div className={`text-[7px] font-black uppercase ${entry.advantageMode === 'advantage' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {entry.advantageMode === 'advantage' ? 'Vantagem' : 'Desvantagem'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomDiceOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCustomDiceOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 p-8 rounded-[40px] space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Rolar Dados</h2>
                  <button onClick={() => setIsCustomDiceOpen(false)} className="text-zinc-500"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[4, 6, 8, 10, 12, 20].map(d => (
                    <button key={d} onClick={() => setCustomDice(prev => ({ ...prev, [d]: (prev[d] || 0) + 1 }))} onContextMenu={(e) => { e.preventDefault(); setCustomDice(prev => ({ ...prev, [d]: Math.max(0, (prev[d] || 0) - 1) })); }} className="h-16 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative hover:border-amber-500 transition-all font-black text-white">
                       <span className="text-[8px] text-zinc-600 mb-1">d{d}</span>
                       <span className="text-xl italic">{customDice[d] || 0}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setCustomModifier(prev => prev - 1)} className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center text-zinc-400">-</button>
                    <div className="flex-1 h-10 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center font-mono font-bold text-white">{customModifier}</div>
                    <button onClick={() => setCustomModifier(prev => prev + 1)} className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center text-zinc-400">+</button>
                  </div>
                  <button disabled={Object.values(customDice).every(v => v === 0)} onClick={rollCustomDice} className="w-full h-16 bg-amber-500 text-black font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all">Rolar</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastCustomResult && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
             <div className="text-center space-y-12">
                <div>
                   <div className="text-[10px] uppercase font-black tracking-[0.5em] text-amber-500/50 mb-4">Resultado Total</div>
                   <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-9xl font-black text-white italic tracking-tighter drop-shadow-2xl">
                     {lastCustomResult.total}
                   </motion.div>
                </div>
                <button onClick={() => setLastCustomResult(null)} className="px-12 py-4 bg-zinc-900 border border-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-full">Fechar</button>
             </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTempHPOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTempHPOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 p-8 rounded-[40px] space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Vida Temporária</h2>
                  <button onClick={() => setIsTempHPOpen(false)} className="text-zinc-500"><X size={20} /></button>
                </div>
                <div className="space-y-6">
                   <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center leading-relaxed">
                     PVA não acumula. Se você receber PVA de múltiplas fontes, você escolhe qual manter (geralmente a maior).
                   </p>
                   
                   <div className="space-y-4">
                      <div className="relative">
                         <input 
                           type="number"
                           value={tempHPValue}
                           onChange={(e) => setTempHPValue(e.target.value)}
                           placeholder="0"
                           className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-3xl px-8 text-4xl font-black text-white italic outline-none focus:border-sky-500/50 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                           autoFocus
                         />
                         <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Pontos</span>
                         </div>
                      </div>

                      <button 
                        onClick={() => {
                          const val = parseInt(tempHPValue);
                          if (!isNaN(val) && val > 0) {
                            updateTempHP(val);
                            setTempHPValue("");
                            setIsTempHPOpen(false);
                          }
                        }}
                        disabled={!tempHPValue || parseInt(tempHPValue) <= 0}
                        className="w-full py-6 bg-sky-500 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] hover:bg-sky-600 transition-all shadow-xl shadow-sky-500/20 active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:scale-100"
                      >
                        Confirmar Pontos
                      </button>
                   </div>

                   <button 
                    onClick={() => { clearTempHP(); setTempHPValue(""); setIsTempHPOpen(false); }}
                    className="w-full py-4 bg-zinc-800/50 text-zinc-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-950/30 hover:text-rose-500 transition-all border border-transparent hover:border-rose-900/50"
                   >
                    Limpar Vida Temporária
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isSpellModalOpen && (
        <SpellSelectionModal 
          onClose={() => setIsSpellModalOpen(false)}
          onSelect={addSpell}
          id="spell-selection-modal"
          {...{ characterClass: character.class } as any}
        />
      )}

      <AnimatePresence>
        {spellToRemove && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full space-y-6 text-center">
                <h3 className="text-xl font-black italic text-white uppercase">Remover Magia?</h3>
                <div className="grid grid-cols-2 gap-4 pt-4">
                   <button onClick={() => setSpellToRemove(null)} className="py-4 bg-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest rounded-xl">Cancelar</button>
                   <button onClick={() => removeSpell(spellToRemove)} className="py-4 bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg">Remover</button>
                </div>
             </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {healingAfflictionId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-lg w-full space-y-6 shadow-2xl">
                <h3 className="text-2xl font-black italic text-white uppercase text-center">Escolha o Sacrifício</h3>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                   {character.virtues.map(v => (
                     <button key={v.id} onClick={() => completeHealing(v.id)} className="w-full text-left p-6 bg-zinc-950 border border-zinc-800 rounded-3xl hover:border-sky-500 group transition-all">
                        <div className="font-black italic text-white uppercase group-hover:text-sky-400 text-lg leading-tight">{v.name}</div>
                        <div className="text-[10px] italic text-zinc-500 mt-2">{v.description}</div>
                     </button>
                   ))}
                </div>
                <button onClick={() => setHealingAfflictionId(null)} className="w-full py-4 text-center text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
             </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRollConfirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px] max-w-sm w-full space-y-6 text-center shadow-2xl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Sparkles size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Adquirir Talento?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Confirme para rolar <strong className="text-white">2d6</strong> e selecionar automaticamente o talento correspondente da tabela para o seu personagem.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRollConfirmOpen(false)}
                  className="py-3.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAcquireTalentRoll}
                  className="py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg hover:shadow-rose-600/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Rolar 2D6
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRollResultOpen && rollResult && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px] max-w-md w-full text-center shadow-2xl space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-violet-500 to-rose-500" />
              
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Dados Rolados!</div>
              
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="w-14 h-14 bg-zinc-950 border-2 border-zinc-800 text-white flex items-center justify-center text-2xl font-black rounded-2xl shadow-inner font-mono">
                  {rollResult.d1}
                </div>
                <div className="text-zinc-500 text-lg font-black font-mono">+</div>
                <div className="w-14 h-14 bg-zinc-950 border-2 border-zinc-800 text-white flex items-center justify-center text-2xl font-black rounded-2xl shadow-inner font-mono">
                  {rollResult.d2}
                </div>
                <div className="text-zinc-500 text-lg font-black font-mono">=</div>
                <div className="w-16 h-16 bg-amber-500 text-black flex items-center justify-center text-3xl font-black rounded-2xl shadow-lg font-mono">
                  {rollResult.sum}
                </div>
              </div>

              <div className="space-y-3 bg-zinc-950 border border-zinc-850 p-6 rounded-2xl text-left">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[8px] font-extrabold uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded">
                    Talento Adquirido
                  </span>
                  <span className="text-[8px] font-mono font-bold text-zinc-550">Tabela de Nível</span>
                </div>
                <h4 className="text-lg font-black uppercase italic tracking-wide text-white">
                  Talento de Nível (Soma: {rollResult.sum})
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                  {rollResult.effect}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRollResultOpen(false)}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-amber-500/15 cursor-pointer"
              >
                Excelente!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGMAddTalentOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px] max-w-md w-full shadow-2xl relative space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Mestre: Adicionar Talento</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Escolha um talento da tabela ou crie um customizado</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-black text-zinc-500 ml-0.5">Tipo/Tag do Talento</label>
                  <select
                    value={gmCustomType}
                    onChange={(e) => setGmCustomType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-violet-500/50"
                  >
                    <option value="level">Talento de Nível (Padrão)</option>
                    <option value="initial">Talento Inicial</option>
                    <option value="ancestry">Talento de Ancestralidade</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-black text-zinc-500 ml-0.5">Opção da Tabela</label>
                  <select
                    value={gmSelectedTalentRow}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGmSelectedTalentRow(val === 'custom' ? 'custom' : parseInt(val));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-violet-500/50"
                  >
                    {getClassRollTable(character.class, currentClassDef || undefined).map((row, idx) => (
                      <option key={idx} value={idx}>
                        Soma {row.range}: {row.effect.length > 50 ? `${row.effect.substring(0, 50)}...` : row.effect}
                      </option>
                    ))}
                    <option value="custom">Escrever Talento Completamente Personalizado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-black text-zinc-500 ml-0.5">Nome do Talento</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Talento de Nível (Rolado: 7)"
                    value={gmCustomName}
                    onChange={(e) => setGmCustomName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-violet-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase font-black text-zinc-500 ml-0.5">Efeito/Descrição do Talento</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Escreva o efeito detalhado do talento."
                    value={gmCustomDescription}
                    onChange={(e) => setGmCustomDescription(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-805 rounded-lg px-3 py-2 text-xs font-semibold text-white outline-none focus:border-violet-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGMAddTalentOpen(false)}
                  className="py-3.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!gmCustomName.trim() || !gmCustomDescription.trim()}
                  onClick={handleGMAddTalent}
                  className="py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-35 disabled:cursor-not-allowed text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
