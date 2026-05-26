import type { EquippedShopItems } from '@/context/app-context';

type ThemeEffect = {
  accent: string;
  label: string;
  lightRoom: string;
  darkRoom: string;
  overlay: string;
};

type OutfitEffect = {
  accent: string;
  badge: string;
  label: string;
};

type PoseEffect = {
  accent: string;
  emoji: string;
  label: string;
  rotateDeg?: number;
  scale?: number;
  translateY?: number;
};

type DecorationEffect = {
  accents: string[];
  label: string;
};

type ReminderStyleEffect = {
  emoji: string;
  line: string;
  preview: string;
};

const THEME_EFFECTS: Record<string, ThemeEffect> = {
  theme_cabin: {
    accent: '#5E7A9A',
    label: 'Rainy Cabin',
    lightRoom: '#DCE7F2',
    darkRoom: '#283547',
    overlay: '🌧️',
  },
  theme_blossom: {
    accent: '#D784A5',
    label: 'Cherry Blossom',
    lightRoom: '#F6E1EC',
    darkRoom: '#4B3041',
    overlay: '🌸',
  },
};

const OUTFIT_EFFECTS: Record<string, OutfitEffect> = {
  outfit_sweater: {
    accent: '#B8794F',
    badge: '🧥 Cozy Sweater',
    label: 'Sweater look equipped',
  },
  outfit_cape: {
    accent: '#A05AA8',
    badge: '👘 Silk Kimono',
    label: 'Kimono look equipped',
  },
  outfit_robe: {
    accent: '#6A7FB8',
    badge: '📜 Scholar Robe',
    label: 'Scholar robe equipped',
  },
};

const POSE_EFFECTS: Record<string, PoseEffect> = {
  pose_victory: {
    accent: '#F5A623',
    emoji: '🏆',
    label: 'Victory pose equipped',
    rotateDeg: -3,
    scale: 1.03,
    translateY: -4,
  },
  pose_reading: {
    accent: '#4F8F7A',
    emoji: '📖',
    label: 'Reading nook pose equipped',
    rotateDeg: 2,
    scale: 0.99,
    translateY: 2,
  },
};

const DECORATION_EFFECTS: Record<string, DecorationEffect> = {
  deco_lamp: {
    accents: ['🪔', '✨'],
    label: 'Cozy lamp glowing',
  },
  deco_cactus: {
    accents: ['🌵', '🪴'],
    label: 'Tiny cactus corner',
  },
  deco_lights: {
    accents: ['✨', '💫', '✨'],
    label: 'Fairy lights twinkling',
  },
  deco_rug: {
    accents: ['🟫', '☁️'],
    label: 'Fluffy rug rolled out',
  },
};

const REMINDER_STYLE_EFFECTS: Record<string, ReminderStyleEffect> = {
  reminder_chirp: {
    emoji: '🐦',
    line: '"Chirp chirp. Tiny study buddy check-in!"',
    preview: 'Cute Chirp active',
  },
  reminder_bells: {
    emoji: '🔔',
    line: '"Soft bells for your next study block."',
    preview: 'Gentle Bells active',
  },
};

export function getThemeEffect(equipped: EquippedShopItems) {
  return equipped.theme ? THEME_EFFECTS[equipped.theme] ?? null : null;
}

export function getOutfitEffect(equipped: EquippedShopItems) {
  return equipped.outfit ? OUTFIT_EFFECTS[equipped.outfit] ?? null : null;
}

export function getPoseEffect(equipped: EquippedShopItems) {
  return equipped.pose ? POSE_EFFECTS[equipped.pose] ?? null : null;
}

export function getDecorationEffect(equipped: EquippedShopItems) {
  return equipped.decoration ? DECORATION_EFFECTS[equipped.decoration] ?? null : null;
}

export function getReminderStyleEffect(equipped: EquippedShopItems) {
  return equipped.reminder ? REMINDER_STYLE_EFFECTS[equipped.reminder] ?? null : null;
}

export function isEquipableCategory(category: string) {
  return category !== 'game';
}
