/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ArmorType = 'none' | 'leather' | 'chainmail' | 'plate';

export type CharacterClass = 'Guerreiro' | 'Sacerdote' | 'Mago' | 'Ladino' | 'Profanador' | 'Bruxa' | 'Cavaleiro Amaldiçoado' | 'Duelista' | 'Bardo';

export type Ancestry = 'Anão' | 'Goblin' | 'Elfo' | 'Pequenino' | 'Humano' | 'Meio-Orc';

export type ItemType = 'Arma' | 'Item' | 'Proteção' | 'Pacote';

export interface InventoryItem {
  id: string;
  name: string;
  slots: number;
  description: string;
  type?: ItemType;
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

export const ATTR_LABELS: Record<keyof CharacterState['attributes'], string> = {
  STR: 'Força',
  DEX: 'Destreza',
  CON: 'Constituição',
  INT: 'Inteligência',
  WIS: 'Sabedoria',
  CHA: 'Carisma',
};

export function getModifier(value: number): number {
  if (value <= 3) return -4;
  if (value <= 5) return -3;
  if (value <= 7) return -2;
  if (value <= 9) return -1;
  if (value <= 11) return 0;
  if (value <= 13) return 1;
  if (value <= 15) return 2;
  if (value <= 17) return 3;
  return 4;
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
