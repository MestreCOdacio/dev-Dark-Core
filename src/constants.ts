import { CharacterClass, Ancestry, CharacterState } from './types';

export const CLASSES: CharacterClass[] = [
  'Guerreiro', 'Sacerdote', 'Mago', 'Ladino', 'Profanador', 'Bruxa', 'Cavaleiro Amaldiçoado', 'Duelista', 'Bardo'
];

export const ANCESTRIES: Ancestry[] = [
  'Anão', 'Goblin', 'Elfo', 'Pequenino', 'Humano', 'Meio-Orc'
];

export const ARMOR_VALUES = {
  none: 10,
  leather: 11,
  chainmail: 13,
  plate: 15
};

export const ARMOR_LABELS = {
  none: 'Sem Armadura',
  leather: 'Couro',
  chainmail: 'Cota de Malha',
  plate: 'Placas'
};

export const INITIAL_CHARACTER: Omit<CharacterState, 'id' | 'userId'> = {
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
