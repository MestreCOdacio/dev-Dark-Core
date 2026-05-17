import { CharacterState } from '../types';
import { INITIAL_CHARACTER } from '../constants';

export const sanitizeCharacter = (data: any, id: string): CharacterState => {
  const sanitizeNum = (val: any, fallback = 0) => {
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  return {
    ...INITIAL_CHARACTER,
    ...data,
    id,
    level: sanitizeNum(data.level, 1),
    xp: sanitizeNum(data.xp, 0),
    stress: sanitizeNum(data.stress, 0),
    attributes: {
      STR: sanitizeNum(data.attributes?.STR, 10),
      DEX: sanitizeNum(data.attributes?.DEX, 10),
      CON: sanitizeNum(data.attributes?.CON, 10),
      INT: sanitizeNum(data.attributes?.INT, 10),
      WIS: sanitizeNum(data.attributes?.WIS, 10),
      CHA: sanitizeNum(data.attributes?.CHA, 10),
    },
    hp: {
      current: sanitizeNum(data.hp?.current, 1),
      max: sanitizeNum(data.hp?.max, 1),
      temp: sanitizeNum(data.hp?.temp, 0),
    },
    inventory: data.inventory || [],
    spells: data.spells || [],
    currency: data.currency || { po: 0, pp: 0, pc: 0 },
    afflictions: data.afflictions || [],
    virtues: data.virtues || [],
    armor: {
      type: data.armor?.type || 'none',
      magicBonus: sanitizeNum(data.armor?.magicBonus, 0)
    },
    shield: {
      active: !!data.shield?.active,
      magicBonus: sanitizeNum(data.shield?.magicBonus, 0)
    },
    advDis: data.advDis || { ...INITIAL_CHARACTER.advDis }
  };
};

export const generateAccessCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const getStressColor = (val: number) => {
  if (val < 4) return 'bg-amber-300';
  if (val < 8) return 'bg-amber-500';
  if (val < 12) return 'bg-amber-600';
  if (val < 16) return 'bg-orange-600';
  return 'bg-orange-800';
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

export const playDiceSound = () => {
  const audio = new Audio('/sounds/som-dado.mp3');
  audio.volume = 0.3;
  audio.play().catch(e => console.log('Audio play failed:', e));
};
