export type ShopCategory =
  | 'companion'
  | 'outfits'
  | 'recipe'
  | 'background'
  | 'desk'
  | 'sound'
  | 'game'
  | 'reminder'
  // Legacy categories kept for effect compatibility (not shown in the shop).
  | 'decoration'
  | 'outfit'
  | 'theme'
  | 'pose';

export type ShopItem = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  category: ShopCategory;
  image?: number;
};

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  companion: '🐾 Companions',
  outfits: '👗 Outfits',
  background: '🖼️ Backgrounds',
  desk: '🪵 Desks',
  recipe: '🍰 Recipes',
  sound: '🎧 Study Sounds',
  game: '🎮 Break Games',
  reminder: '🔔 Reminders',
  decoration: '🏡 Decorations',
  outfit: '👘 Starter Outfits',
  theme: '🎨 Themes',
  pose: '✨ Poses',
};

// Categories shown as tabs in the shop, in order.
export const CATEGORIES: ShopCategory[] = [
  'companion',
  'outfits',
  'recipe',
  'background',
  'desk',
  'sound',
  'game',
  'reminder',
];

export const SHOP_ITEMS: ShopItem[] = [
  // ─── Companions (300–600 coins) ──────────────────────────────────────────
  {
    id: 'companion_cocoa',
    name: 'Cocoa',
    emoji: '🐱',
    description: 'A cozy barista kitty in a cocoa-brown apron.',
    price: 500,
    category: 'companion',
    image: require('@/assets/images/cocoa/cocoa.png'),
  },
  {
    id: 'companion_bunny',
    name: 'Bunny',
    emoji: '🐰',
    description: 'A princess bunny in a frilly pink gown.',
    price: 550,
    category: 'companion',
    image: require('@/assets/images/bunny/bunny.png'),
  },
  {
    id: 'companion_honey',
    name: 'Miel',
    emoji: '🐻',
    description: 'A sweet honey-bear baker in a gingham chef coat.',
    price: 550,
    category: 'companion',
    image: require('@/assets/images/honey/honey.png'),
  },
  {
    id: 'companion_tira',
    name: 'Tira',
    emoji: '🐰',
    description: 'A tiramisu bunny with a cocoa-dusted apron.',
    price: 550,
    category: 'companion',
    image: require('@/assets/images/tira/tira.png'),
  },

  // ─── Outfits / wardrobe skins (300–600 coins) ───────────────────────────
  {
    id: 'outfit_bun_angel',
    name: 'Angel Bun',
    emoji: '👼',
    description: "A frilly angel gown with wings & bonnet — a new outfit for Bun. Wear it from Bun's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-angel.png'),
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
