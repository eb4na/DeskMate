export type ShopCategory = 'decoration' | 'outfit' | 'theme' | 'pose' | 'game' | 'reminder';

export type ShopItem = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  category: ShopCategory;
};

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  decoration: '🏡 Decorations',
  outfit: '👘 Starter Outfits',
  theme: '🎨 Themes',
  pose: '✨ Poses',
  game: '🎮 Break Games',
  reminder: '🔔 Reminders',
};

export const CATEGORIES: ShopCategory[] = ['decoration', 'outfit', 'theme', 'pose', 'game', 'reminder'];

export const SHOP_ITEMS: ShopItem[] = [
  // ─── Decorations (80–150 coins) ───────────────────────────────────────────
  {
    id: 'deco_lamp',
    name: 'Cozy Lamp',
    emoji: '🪔',
    description: 'A warm amber lamp for your study corner.',
    price: 80,
    category: 'decoration',
  },
  {
    id: 'deco_cactus',
    name: 'Potted Cactus',
    emoji: '🌵',
    description: 'A tiny cactus that never needs watering.',
    price: 100,
    category: 'decoration',
  },
  {
    id: 'deco_lights',
    name: 'Fairy Lights',
    emoji: '✨',
    description: 'String lights to brighten your room.',
    price: 120,
    category: 'decoration',
  },
  {
    id: 'deco_rug',
    name: 'Fluffy Rug',
    emoji: '🟫',
    description: 'A soft rug that makes your room cozy.',
    price: 150,
    category: 'decoration',
  },

  // ─── Outfits (250–500 coins) ──────────────────────────────────────────────
  {
    id: 'outfit_sweater',
    name: 'Cozy Sweater',
    emoji: '🧥',
    description: 'A comfy look for the free default girl and dude.',
    price: 250,
    category: 'outfit',
  },
  {
    id: 'outfit_cape',
    name: 'Silk Kimono',
    emoji: '👘',
    description: 'A dress-up kimono style for your two starter companions.',
    price: 400,
    category: 'outfit',
  },
  {
    id: 'outfit_robe',
    name: 'Scholar Robe',
    emoji: '📜',
    description: 'A study-ready robe for the default girl and dude.',
    price: 500,
    category: 'outfit',
  },

  // ─── Room themes (700–1200 coins) ─────────────────────────────────────────
  {
    id: 'theme_cabin',
    name: 'Rainy Cabin',
    emoji: '🌧️',
    description: 'Rain taps softly on the window. Perfect focus.',
    price: 700,
    category: 'theme',
  },
  {
    id: 'theme_blossom',
    name: 'Cherry Blossom',
    emoji: '🌸',
    description: 'Study under a canopy of pink petals.',
    price: 1200,
    category: 'theme',
  },

  // ─── Companion poses (200–400 coins) ─────────────────────────────────────
  {
    id: 'pose_victory',
    name: 'Victory Pose',
    emoji: '🏆',
    description: 'Your companion does a little victory dance.',
    price: 200,
    category: 'pose',
  },
  {
    id: 'pose_reading',
    name: 'Reading Nook',
    emoji: '📖',
    description: 'Your companion curls up with a good book.',
    price: 350,
    category: 'pose',
  },

  // ─── Break games (500–900 coins) ─────────────────────────────────────────
  {
    id: 'game_words',
    name: 'Word Puzzles',
    emoji: '🔤',
    description: 'Quick vocabulary puzzles for your break.',
    price: 500,
    category: 'game',
  },
  {
    id: 'game_memory',
    name: 'Memory Cards',
    emoji: '🃏',
    description: 'Match the pairs — a gentle brain reset.',
    price: 700,
    category: 'game',
  },

  // ─── Reminder styles (150–300 coins) ─────────────────────────────────────
  {
    id: 'reminder_chirp',
    name: 'Cute Chirp',
    emoji: '🐦',
    description: 'A cheerful little bird reminds you to study.',
    price: 150,
    category: 'reminder',
  },
  {
    id: 'reminder_bells',
    name: 'Gentle Bells',
    emoji: '🔔',
    description: 'Soft bell chimes for your daily reminder.',
    price: 250,
    category: 'reminder',
  },
];
