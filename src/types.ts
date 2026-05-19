/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ArmorType = 'none' | 'leather' | 'chainmail' | 'plate';

export type CharacterClass = 'Guerreiro' | 'Sacerdote' | 'Mago' | 'Ladino' | 'Profanador' | 'Bruxa' | 'Cavaleiro Amaldiçoado' | 'Duelista' | 'Bardo';

export type Ancestry = 'Anão' | 'Goblin' | 'Elfo' | 'Pequenino' | 'Humano' | 'Meio-Orc';

export type ItemCategory = 'Arma' | 'Armadura' | 'Pacote' | 'Geral' | 'Escudo' | 'Iluminação';

export interface MasterItem {
  id: string;
  name: string;
  category: ItemCategory;
  slots: number;
  description: string;
  createdAt: number;
  // Weapon specific
  properties?: string[];
  range?: 'A' | 'P' | 'L' | '';
  damage?: string;
  modifiers?: string;
  // Armor specific
  ac?: number;
  sumDex?: boolean;
  disadvantages?: string[];
  // Bundle specific
  itemsPerSlot?: number;
  // Shield specific or general
  hands?: number;
  // Lighting specific
  lightDuration?: number; // Total duration in seconds
  lightRemaining?: number; // Initial remaining for the template
  lightHasFuel?: boolean;
  lightFuelItemId?: string;
}

export type ItemType = 'Arma' | 'Item' | 'Proteção' | 'Pacote';

export interface InventoryItem {
  id: string;
  masterId?: string;
  name: string;
  category: ItemCategory;
  slots: number;
  description: string;
  // State
  isEquipped?: boolean;
  quantity?: number;
  // Master Item Data Copy
  properties?: string[];
  range?: string;
  damage?: string;
  modifiers?: string;
  ac?: number;
  sumDex?: boolean;
  disadvantages?: string[];
  itemsPerSlot?: number;
  hands?: number;
  finesseAttribute?: 'STR' | 'DEX';
  // Lighting specific state
  lightDuration?: number; // Total duration in seconds
  lightRemaining?: number; // Remaining duration in seconds
  lightStartedAt?: number | null; // Timestamp when started
  lightIsActive?: boolean;
  lightHasFuel?: boolean;
  lightFuelItemId?: string;
}

export interface CharacterState {
  id: string;
  userId: string;
  campaignId?: string | null;
  name: string;
  level: number;
  xp: number;
  class: CharacterClass;
  ancestry: Ancestry;
  attributes: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  advDis: {
    [key in keyof CharacterState['attributes']]?: 'advantage' | 'disadvantage' | null;
  };
  armor: {
    type: ArmorType;
    magicBonus: number;
  };
  shield: {
    active: boolean;
    magicBonus: number;
  };
  hp: {
    current: number;
    max: number;
    temp: number;
  };
  inventory: InventoryItem[];
  spells: Spell[];
  currency: {
    po: number;
    pp: number;
    pc: number;
  };
  afflictions: Trait[];
  virtues: Trait[];
  stress: number;
  virtueMargin?: number;
  spellModifier?: number;
}

export interface Trait {
  id: string;
  name: string;
  description: string;
  roll: number;
  isAggravated?: boolean;
  healProgress?: number;
}

export interface Campaign {
  id: string;
  name: string;
  gmId: string;
  playerIds: string[];
  characterIds: string[];
  createdAt: string;
  accessCode?: string;
}

export interface CampaignNote {
  id: string;
  campaignId: string;
  title: string;
  content: string;
  folderId: string | null;
  category: string;
  authorId: string;
  authorName: string;
  authorRole: 'Mestre' | 'Jogador';
  createdAt: number;
  updatedAt: number;
}

export interface CampaignFolder {
  id: string;
  campaignId: string;
  name: string;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  nickname?: string;
  createdAt: string;
  role?: 'Mestre' | 'Jogador';
}

export type SpellType = 'Magia' | 'Milagre' | 'Magia Negra' | 'Arcano';

export interface Spell {
  id: string;
  name: string;
  tier: number;
  range: string;
  duration: string;
  type: SpellType[];
  description: string;
  createdAt: number;
}

export interface RollLog {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  type: 'normal' | 'crit-success' | 'crit-fail' | 'virtue' | 'sanity-success' | 'sanity-fail';
  value: number;
  modifier: number;
  label: string;
  timestamp: number;
  advantageMode?: 'advantage' | 'disadvantage' | 'none';
}

export interface RollNotification {
  id: string;
  type: 'normal' | 'crit-success' | 'crit-fail' | 'virtue' | 'sanity-success' | 'sanity-fail';
  value: number;
  modifier: number;
  attributeLabel: string;
  r1?: number;
  r2?: number;
  advDis?: 'advantage' | 'disadvantage' | null;
  timestamp: number;
}

export const ATTR_LABELS: Record<keyof CharacterState['attributes'], string> = {
  STR: 'Força',
  DEX: 'Destreza',
  CON: 'Constituição',
  INT: 'Inteligência',
  WIS: 'Sabedoria',
  CHA: 'Carisma',
};
