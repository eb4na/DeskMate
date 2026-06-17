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
  // Locked until the player has collected all five recipe badges (baked every
  // companion's signature recipe). Used to gate Hanji.
  requiresAllRecipes?: boolean;
  // For recipes: the companion whose signature bake this is (canonical English
  // name; localize via localizeCompanionName at display time).
  owner?: string;
};

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  companion: 'Companions',
  outfits: 'Outfits',
  background: 'Backgrounds',
  desk: 'Desks',
  recipe: 'Recipes',
  sound: 'Study Sounds',
  game: 'Break Games',
  reminder: 'Reminders',
  decoration: 'Decorations',
  outfit: 'Starter Outfits',
  theme: 'Themes',
  pose: 'Poses',
};

// Categories shown as tabs in the shop, in order.
export const CATEGORIES: ShopCategory[] = [
  'companion',
  'outfits',
  'recipe',
  'background',
  'desk',
  'sound',
];

export const SHOP_ITEMS: ShopItem[] = [
  // ─── Companions (300–600 coins) ──────────────────────────────────────────
  // Bun is one of the five "starter" companions: a player picks one for free on
  // their first launch (see StarterChooser); the other four — Bun included — are
  // bought here. Bun's active id stays `starter:girl`, so this SKU exists only so
  // unchosen Bun can appear/be purchased in the shop. It is excluded from
  // SHOP_COMPANIONS (Bun is handled via its starter id everywhere else).
  {
    id: 'companion_bun',
    name: 'Bun',
    emoji: '',
    description: 'A cheery strawberry bunny in a frilly café apron.',
    price: 1200,
    category: 'companion',
    image: require('@/assets/images/bun/bun-home.png'),
  },
  {
    id: 'companion_cocoa',
    name: 'Cocoa',
    emoji: '',
    description: 'A cozy barista kitty in a cocoa-brown apron.',
    price: 1200,
    category: 'companion',
    image: require('@/assets/images/cocoa/cocoa.png'),
  },
  {
    id: 'companion_bunny',
    name: 'Bunny',
    emoji: '',
    description: 'A princess bunny in a frilly pink gown.',
    price: 1200,
    category: 'companion',
    image: require('@/assets/images/bunny/bunny.png'),
  },
  {
    id: 'companion_honey',
    name: 'Miel',
    emoji: '',
    description: 'A sweet honey-bear baker in a gingham chef coat.',
    price: 1200,
    category: 'companion',
    image: require('@/assets/images/honey/honey.png'),
  },
  {
    id: 'companion_tira',
    name: 'Tira',
    emoji: '',
    description: 'A tiramisu bunny with a cocoa-dusted apron.',
    price: 1200,
    category: 'companion',
    image: require('@/assets/images/tira/tira.png'),
  },
  {
    id: 'companion_hanji',
    name: 'Hanji',
    emoji: '',
    description: 'An elegant black cat in a lavender hanfu with wisteria charms.',
    price: 1200,
    category: 'companion',
    image: require('@/assets/images/hanji/hanji.png'),
    requiresAllRecipes: true,
  },

  // ─── Outfits / wardrobe skins (300–600 coins) ───────────────────────────
  {
    id: 'outfit_bun_angel',
    name: 'Angel Bun',
    emoji: '',
    description: "A frilly angel gown with wings & bonnet. Bun sends soft, watch-over-you reminders while wearing it — wear it from Bun's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-angel.png'),
  },
  {
    id: 'outfit_bun_snowrabbit',
    name: 'Snow Rabbit',
    emoji: '',
    description: "A fluffy hooded winter coat with a flower headdress & blue tassels. Wear it from Bun's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-snowrabbit.png'),
  },
  {
    id: 'outfit_bun_strawberry',
    name: 'Strawberry Plus',
    emoji: '',
    description: "A royal strawberry-lolita gown with a lace bonnet & crown. Yours free with Plus — wear it from Bun's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-strawberry.png'),
    plusOnly: true,
  },
  {
    id: 'outfit_bun_dreams',
    name: 'Strawberry Dreams',
    emoji: '',
    description: "A dreamy strawberry-print nightgown & matching sleep cap, with a little strawberry lantern. Wear it from Bun's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-dreams.png'),
  },
  {
    id: 'outfit_cocoa_relax',
    name: 'Relax Cocoa',
    emoji: '',
    description: "A cozy autumn kimono & hakama. Cocoa sends warm steep-some-tea reminders while wearing it — wear it from Cocoa's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/cocoa/cocoa-relax.png'),
  },
  {
    id: 'outfit_cocoa_demon',
    name: 'Demon Cocoa',
    emoji: '',
    description: "A gothic demon-lord coat with horns, bat wings & a spade tail. Wear it from Cocoa's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/cocoa/cocoa-demon.png'),
  },
  {
    id: 'outfit_tira_chocomint',
    name: 'Choco Mint Tira',
    emoji: '',
    description: "A mint-and-chocolate lolita dress with a bow. Tira gives sweet-but-strict mint-fresh reminders while wearing it — wear it from Tira's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-chocomint.png'),
  },
  {
    id: 'outfit_tira_sleepover',
    name: 'Sleepover Tira',
    emoji: '',
    description: "A cozy gingham pajama set & sleep bonnet. Tira nags you to study in soft pajama-party mode while wearing it — wear it from Tira's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-sleepover.png'),
  },
  {
    id: 'outfit_tira_afternoontrain',
    name: 'Afternoon Train Tira',
    emoji: '',
    description: "An elegant navy hakama with a floral kimono and a blossom hairpin. Tira gives graceful, composed study reminders while wearing it — wear it from Tira's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-afternoon-train.png'),
  },
  {
    id: 'outfit_honey_champion',
    name: 'Champion Miel',
    emoji: '',
    description: "A bold champion arena outfit. Miel gives pumped go-for-gold reminders while wearing it — wear it from Miel's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/honey/honey-champion.png'),
  },
  {
    id: 'outfit_honey_zzz',
    name: 'ZZZ Miel',
    emoji: '',
    description: "Cozy honey-pot pajamas & nightcap. Miel mumbles sleepy 'study-first, snuggle-after' reminders while wearing it — wear it from Miel's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/honey/honey-zzz.png'),
  },
  {
    id: 'outfit_bunny_jiraikei',
    name: 'Jirai Kei Bunny',
    emoji: '',
    description: "A pink-and-black jirai kei lolita outfit. Bunny turns cute-but-menacing in her reminders while wearing it — wear it from Bunny's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-jiraikei.png'),
  },
  {
    id: 'outfit_bunny_palace',
    name: 'Blue Peony Bunny',
    emoji: '',
    description: "An ornate blue peony palace robe & headdress. Bunny issues regal by-royal-decree reminders while wearing it — wear it from Bunny's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-palace.png'),
  },
  {
    id: 'outfit_hanji_ivoryrose',
    name: 'Ivory Rose Hanji',
    emoji: '',
    description: "An ivory lace bonnet & cream wisteria hanfu with a white rose. Wear it from Hanji's Wardrobe.",
    price: 600,
    category: 'outfits',
    image: require('@/assets/images/hanji/hanji-ivoryrose.png'),
  },

  // ─── Backgrounds / study rooms (500–650 coins) ───────────────────────────
  {
    id: 'bg_modern_kitchen',
    name: 'Modern Kitchen',
    emoji: '',
    description: 'A sleek modern kitchen backdrop — pairs with the Marble desk.',
    price: 500,
    category: 'background',
    image: require('@/assets/images/backgrounds/modern-kitchen.png'),
  },
  {
    id: 'bg_washitsu',
    name: 'Beach',
    emoji: '',
    description: 'A sunny seaside beach backdrop — pairs with the Wood desk.',
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/beach.png'),
  },
  {
    id: 'bg_tiras_room',
    name: "Tira's Room",
    emoji: '',
    description: "Tira's cozy blue bedroom — soft quilts, lace curtains, and morning light.",
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/tiras-room.png'),
  },
  {
    id: 'bg_buns_room',
    name: "Bun's Room",
    emoji: '',
    description: "Bun's pink strawberry bedroom — frills, bows, and cozy pastel sweetness. Pairs with the Pink desk.",
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/buns-room.png'),
  },
  {
    id: 'bg_afternoon_train',
    name: 'Afternoon Train',
    emoji: '',
    description: "A vintage train cabin — big windows over rolling countryside, blue floral seats. Pairs with the Afternoon Train desk and Tira's hakama.",
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/afternoon-train.png'),
  },
  {
    id: 'bg_tranquil',
    name: 'Tranquil',
    emoji: '',
    description: 'A serene Japanese kitchen — warm wood, pottery shelves, and a sunlit sakura window. Pairs with the Maplewood desk.',
    price: 500,
    category: 'background',
    image: require('@/assets/images/backgrounds/tranquil.png'),
  },
  {
    id: 'bg_landmine',
    name: 'Landmine',
    emoji: '',
    description: 'A pink-and-black jirai kei bedroom — bows, a lit vanity mirror, and a moonlit window.',
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/landmine.png'),
  },
  {
    id: 'bg_lavender_palace',
    name: 'Lavender Palace',
    emoji: '',
    description: 'A serene wisteria palace — moon gate, lavender blooms, and warm wood. Pairs with the Lavender desk.',
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/lavender-palace.png'),
  },
  {
    id: 'bg_frostbloom_shrine',
    name: 'Frostbloom Shrine',
    emoji: '',
    description: 'A snow-hushed shrine courtyard — white plum blossoms, frosted lanterns, and a clear winter sky.',
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/frostbloom-shrine.png'),
  },
  {
    id: 'bg_strawberry_palace',
    name: 'Golden Teahouse',
    emoji: '',
    description: 'A royal strawberry-pink palace — gilded throne, ribbon drapes, and a berry-sweet tea table. Yours free with Plus.',
    price: 650,
    category: 'background',
    image: require('@/assets/images/backgrounds/strawberry-palace.png'),
    plusOnly: true,
  },
  // ─── Desks / study surfaces (400–700 coins) ─────────────────────────────
  {
    id: 'desk_marble',
    name: 'Marble Desk',
    emoji: '',
    description: 'A clean white marble study surface.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/marble.png'),
  },
  {
    id: 'desk_wood',
    name: 'Wood Desk',
    emoji: '',
    description: 'A warm natural wood study surface — pairs with the Tatami Room.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/wood.png'),
  },
  {
    id: 'desk_pink',
    name: 'Pink Desk',
    emoji: '',
    description: "A soft pink study surface — pairs with Bun's Room.",
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/pink.png'),
  },
  {
    id: 'desk_pale_wood',
    name: 'Pale Wood Desk',
    emoji: '',
    description: "A soft cream-wood study surface — pairs with Tira's Room.",
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/pale-wood.png'),
  },
  {
    id: 'desk_afternoon_train',
    name: 'Afternoon Train Desk',
    emoji: '',
    description: 'A navy floral cabin floor with gold trim — pairs with the Afternoon Train background.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/afternoon-train.png'),
  },
  {
    id: 'desk_maple',
    name: 'Maplewood Desk',
    emoji: '',
    description: 'A bright maplewood study surface — pairs with the Tranquil room.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/maple.png'),
  },
  {
    id: 'desk_landmine',
    name: 'Noir Desk',
    emoji: '',
    description: 'A matte black study surface — pairs with the Landmine room.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/landmine.png'),
  },
  {
    id: 'desk_lavender',
    name: 'Lavender Desk',
    emoji: '',
    description: 'A soft pale-wood study surface — pairs with the Lavender Palace room.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/lavender.png'),
  },
  {
    id: 'desk_strawberry',
    name: 'Golden Teahouse Desk',
    emoji: '',
    description: 'A warm blush-and-gold gilded tabletop — pairs with the Golden Teahouse room. Yours free with Plus.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/strawberry.png'),
    plusOnly: true,
  },
  {
    id: 'desk_snow',
    name: 'Snow Desk',
    emoji: '',
    description: 'A soft bed of fresh snow — pairs with the Frostbloom Shrine room.',
    price: 300,
    category: 'desk',
    image: require('@/assets/images/desks/snow.png'),
  },

  // ─── Break games are all free to play — nothing to buy here. ──────────────

  // ─── Recipes (cake-game desserts, 400–600 coins) ─────────────────────────
  {
    id: 'recipe_pudding',
    name: 'Pudding',
    emoji: '',
    description: 'A silky caramel custard pudding. Pick it in the Bakery Menu to bake it in the kitchen!',
    price: 600,
    category: 'recipe',
    image: require('@/assets/images/cake/pudding.png'),
    owner: 'Miel',
  },
  {
    id: 'recipe_sakura',
    name: 'Sakura Mochi',
    emoji: '',
    description: 'A pink mochi wrapped in a salted sakura leaf. Pick it in the Bakery Menu to bake it in the kitchen!',
    price: 600,
    category: 'recipe',
    image: require('@/assets/images/cake/sakura-mochi.png'),
    owner: 'Bunny',
  },
  {
    id: 'recipe_matcha',
    name: 'Matcha Mille Crêpe',
    emoji: '',
    description: 'A thousand-layer matcha crepe cake. Pick it in the Bakery Menu to bake it in the kitchen!',
    price: 600,
    category: 'recipe',
    image: require('@/assets/images/cake/matcha-crepe.png'),
    owner: 'Tira',
  },
  {
    id: 'recipe_croissant',
    name: 'Berry Croissant',
    emoji: '',
    description: 'A flaky croissant piled with fresh berries and cream. Pick it in the Bakery Menu to bake it in the kitchen!',
    price: 600,
    category: 'recipe',
    image: require('@/assets/images/cake/croissant.png'),
    owner: 'Cocoa',
  },

  // ─── Reminder styles (150–300 coins) ─────────────────────────────────────
  // ─── Study Sounds (ambience tracks; 200 coins each) ──────────────────────
  // Each id is `sound_<ambienceId>` so owning one unlocks that sound in the
  // Ambience picker. Plus members get all of them; everyone else can buy
  // individual sounds here. Names/descriptions mirror ambience.name_*/desc_*.
  {
    id: 'sound_rain',
    name: 'Rainy Day',
    emoji: '',
    description: 'Soft rain outside the window.',
    price: 300,
    category: 'sound',
    image: require('@/assets/images/sounds/rain.png'),
  },
  {
    id: 'sound_ocean',
    name: 'Ocean',
    emoji: '',
    description: 'Waves rolling onto the shore.',
    price: 300,
    category: 'sound',
    image: require('@/assets/images/sounds/ocean.png'),
  },
  {
    id: 'sound_fireplace',
    name: 'Fireplace',
    emoji: '',
    description: 'Crackling warm fire.',
    price: 300,
    category: 'sound',
    image: require('@/assets/images/sounds/fireplace.png'),
  },
  {
    id: 'sound_night',
    name: 'Night Sounds',
    emoji: '',
    description: 'Crickets and cool evening air.',
    price: 300,
    category: 'sound',
    image: require('@/assets/images/sounds/night.png'),
  },
];
