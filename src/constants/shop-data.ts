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
  // Plus-exclusive: cannot be bought with coins. Granted automatically the first
  // time a player gets Plus.
  plusOnly?: boolean;
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
    description: 'A tiramisu bunny with a cocoa-dusted apron. Yours free with Plus!',
    price: 550,
    category: 'companion',
    image: require('@/assets/images/tira/tira.png'),
    plusOnly: true,
  },

  // ─── Outfits / wardrobe skins (300–600 coins) ───────────────────────────
  {
    id: 'outfit_bun_angel',
    name: 'Angel Bun',
    emoji: '👼',
    description: "A frilly angel gown with wings & bonnet. Bun sends soft, watch-over-you reminders while wearing it — wear it from Bun's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-angel.png'),
  },
  {
    id: 'outfit_bun_angelkei',
    name: 'Angel Kei Bun',
    emoji: '😇',
    description: "A dreamy white angel-kei gown with halo & wings. Bun drifts you gently into focus with dreamy reminders — wear it from Bun's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-angelkei.png'),
  },
  {
    id: 'outfit_cocoa_relax',
    name: 'Relax Cocoa',
    emoji: '🍁',
    description: "A cozy autumn kimono & hakama. Cocoa sends warm steep-some-tea reminders while wearing it — wear it from Cocoa's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/cocoa/cocoa-relax.png'),
  },
  {
    id: 'outfit_tira_wolfsmeal',
    name: "Wolf's Meal Tira",
    emoji: '🧺',
    description: "A Little Red Riding Hood cape & basket. Tira gives wry 'don't-be-the-wolf's-lunch' reminders while wearing it — wear it from Tira's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-wolfsmeal.png'),
  },
  {
    id: 'outfit_tira_chocomint',
    name: 'Choco Mint Tira',
    emoji: '🍫',
    description: "A mint-and-chocolate lolita dress with a bow. Tira gives sweet-but-strict mint-fresh reminders while wearing it — wear it from Tira's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-chocomint.png'),
  },
  {
    id: 'outfit_tira_sleepover',
    name: 'Sleepover Tira',
    emoji: '🌙',
    description: "A cozy gingham pajama set & sleep bonnet. Tira nags you to study in soft pajama-party mode while wearing it — wear it from Tira's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-sleepover.png'),
  },
  {
    id: 'outfit_honey_champion',
    name: 'Champion Miel',
    emoji: '🏆',
    description: "A bold champion arena outfit. Miel gives pumped go-for-gold reminders while wearing it — wear it from Miel's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/honey/honey-champion.png'),
  },
  {
    id: 'outfit_honey_zzz',
    name: 'ZZZ Miel',
    emoji: '😴',
    description: "Cozy honey-pot pajamas & nightcap. Miel mumbles sleepy 'study-first, snuggle-after' reminders while wearing it — wear it from Miel's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/honey/honey-zzz.png'),
  },
  {
    id: 'outfit_bunny_jiraikei',
    name: 'Jirai Kei Bunny',
    emoji: '🖤',
    description: "A pink-and-black jirai kei lolita outfit. Bunny turns cute-but-menacing in her reminders while wearing it — wear it from Bunny's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-jiraikei.png'),
  },
  {
    id: 'outfit_bunny_palace',
    name: 'Blue Peony Bunny',
    emoji: '🪷',
    description: "An ornate blue peony palace robe & headdress. Bunny issues regal by-royal-decree reminders while wearing it — wear it from Bunny's Wardrobe.",
    price: 450,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-palace.png'),
  },

  // ─── Backgrounds / study rooms (500–800 coins) ───────────────────────────
  {
    id: 'bg_modern_kitchen',
    name: 'Modern Kitchen',
    emoji: '🍳',
    description: 'A sleek modern kitchen backdrop — pairs with the Marble desk.',
    price: 600,
    category: 'background',
    image: require('@/assets/images/backgrounds/modern-kitchen.png'),
  },
  {
    id: 'bg_washitsu',
    name: 'Beach',
    emoji: '🏖️',
    description: 'A sunny seaside beach backdrop — pairs with the Wood desk.',
    price: 600,
    category: 'background',
    image: require('@/assets/images/backgrounds/beach.png'),
  },

  // ─── Desks / study surfaces (400–700 coins) ─────────────────────────────
  {
    id: 'desk_marble',
    name: 'Marble Desk',
    emoji: '🪨',
    description: 'A clean white marble study surface.',
    price: 500,
    category: 'desk',
    image: require('@/assets/images/desks/marble.png'),
  },
  {
    id: 'desk_wood',
    name: 'Wood Desk',
    emoji: '🪵',
    description: 'A warm natural wood study surface — pairs with the Tatami Room.',
    price: 500,
    category: 'desk',
    image: require('@/assets/images/desks/wood.png'),
  },

  // ─── Break games are all free to play — nothing to buy here. ──────────────

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
