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
  // Temporarily hidden: not sold in the shop or offered as a starter. Players
  // who already own it keep it (gallery, wardrobe, rendering are unaffected).
  hidden?: boolean;
  // Plus-exclusive: cannot be bought with coins. Granted automatically the first
  // time a player gets Plus.
  plusOnly?: boolean;
  // Locked until the player has collected all five recipe badges (baked every
  // companion's signature recipe). Used to gate Hanji.
  requiresAllRecipes?: boolean;
  // Free for everyone: not shown in the shop grid and treated as always-owned by
  // the ambience/sound pickers (no purchase required). Used for Rainy Day.
  free?: boolean;
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
  // ─── Companions (10000 coins) ─────────────────────────────────────────────
  // Bun is one of the five "starter" companions: a player picks one for free on
  // their first launch (see StarterChooser); the other four — Bun included — are
  // bought here. Bun's active id stays `starter:girl`, so this SKU exists only so
  // unchosen Bun can appear/be purchased in the shop. It is excluded from
  // SHOP_COMPANIONS (Bun is handled via its starter id everywhere else).
  {
    id: 'companion_bun',
    name: 'Bun',
    emoji: '',
    description: "A dreamy strawberry bunny who talks soft and slow, like she's half inside a lovely dream.",
    price: 10000,
    category: 'companion',
    image: require('@/assets/images/bun/bun-home.png'),
  },
  {
    id: 'companion_cocoa',
    name: 'Cocoa',
    emoji: '',
    description: "A laid-back red panda in a cozy autumn kimono. Never in a hurry, but the work still comes first.",
    price: 10000,
    category: 'companion',
    image: require('@/assets/images/cocoa/cocoa.png'),
    hidden: true, // Aki hidden for now
  },
  {
    id: 'companion_bunny',
    name: 'Bunny',
    emoji: '',
    description: "A princess bunny in a frilly pink gown. Far too cute to care, and she knows it.",
    price: 10000,
    category: 'companion',
    // Animated (blink/bounce/scratch) on expo-image surfaces; RN <Image> surfaces
    // (shop grid) use the static first frame via staticImageFor().
    image: require('@/assets/images/bunny/bunny-classic-anim.webp'),
  },
  {
    id: 'companion_honey',
    name: 'Miel',
    emoji: '',
    description: "A warm honey-bear baker in a gingham chef coat, always ready with tea and an extra cookie.",
    price: 10000,
    category: 'companion',
    // Animated (sleepy blinks) on expo-image surfaces; RN <Image> surfaces use the
    // static art via staticImageFor().
    image: require('@/assets/images/honey/honey-classic-anim.webp'),
  },
  {
    // TEST character — free (price 0) so it can be tried without coins.
    // Displays as Gray (was Pretzel, then Soda); id stays companion_pretzel and the
    // canonical name 'Soda' (its i18n keys: gallery.name_Soda / tagline_Soda).
    id: 'companion_pretzel',
    name: 'Soda',
    emoji: '',
    description: "A silver-grey fox baker in a navy chef coat. Cool, quiet, and not big on words.",
    price: 0,
    category: 'companion',
    // Animated (bubbles); RN <Image> surfaces use pretzel.png via staticImageFor().
    image: require('@/assets/images/pretzel/pretzel-classic-anim.webp'),
  },
  {
    id: 'companion_tira',
    name: 'Tira',
    emoji: '',
    description: "A graceful tiramisu bunny with a cocoa-dusted apron, gentle but quietly strict.",
    price: 10000,
    category: 'companion',
    image: require('@/assets/images/tira/tira-classic-anim.webp'),
  },
  {
    id: 'companion_hanji',
    name: 'Hanji',
    emoji: '',
    description: "An elegant black cat in a lavender hanfu with wisteria charms. Speaks little, means every word.",
    price: 10000,
    category: 'companion',
    // Animated (wisteria petals); RN <Image> surfaces use hanji.png via staticImageFor().
    image: require('@/assets/images/hanji/hanji-classic-anim.webp'),
    requiresAllRecipes: true,
  },

  // ─── Outfits / wardrobe skins (10000 base; 15000 Champion/Jirai Kei/Heartcore; 7000 Carefree Days, Blue Peony + the 3 pajama sets) ──
  {
    id: 'outfit_bun_heartcore',
    name: 'Heartcore',
    emoji: '',
    description: "Pink-and-black twintails, ribbon bows and a buckled pinafore. Meruru is just as dreamy and sweet, only in boots now. Wear it from Meruru's Wardrobe.",
    price: 15000,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-heartcore.png'),
  },
  {
    id: 'outfit_bun_starry',
    name: 'Starry Night',
    emoji: '',
    description: "A star-print nightgown, sleep cap and little star wand. Meruru drifts into her softest, sleepiest mood. Wear it from Meruru's Wardrobe.",
    price: 7000,
    category: 'outfits',
    image: require('@/assets/images/bun/bun-starry.png'),
  },
  {
    id: 'outfit_cocoa_demon',
    name: 'Demon',
    emoji: '',
    description: "A gothic demon-lord coat with horns, bat wings and a spade tail. Looks scary, mostly sleepy. Wear it from Aki's Wardrobe.",
    price: 10000,
    category: 'outfits',
    image: require('@/assets/images/cocoa/cocoa-demon.png'),
  },
  {
    id: 'outfit_cocoa_relax',
    name: 'Relax',
    emoji: '',
    description: "A warm brown haori for slow autumn strolls, with a stray maple leaf resting on his head. Wear it from Aki's Wardrobe.",
    price: 10000,
    category: 'outfits',
    image: require('@/assets/images/cocoa/cocoa-relax.png'),
  },
  {
    id: 'outfit_tira_chocomint',
    name: 'Choco Mint Tira',
    emoji: '',
    description: "A mint-and-chocolate lolita dress with a bow. Tira stays sweet, but never soft on slacking. Wear it from Tira's Wardrobe.",
    price: 10000,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-chocomint.png'),
  },
  {
    id: 'outfit_tira_sleepover',
    name: 'Sleepover Tira',
    emoji: '',
    description: "A cozy gingham pajama set and sleep bonnet. Tira keeps the sleepover tidy: homework first, pillows after. Wear it from Tira's Wardrobe.",
    price: 7000,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-sleepover.png'),
  },
  {
    id: 'outfit_tira_afternoontrain',
    name: 'Carefree Days Tira',
    emoji: '',
    description: "An elegant navy hakama with a floral kimono and blossom hairpin, made for calm, steady journeys. Wear it from Tira's Wardrobe.",
    price: 7000,
    category: 'outfits',
    image: require('@/assets/images/tira/tira-afternoon-train.png'),
  },
  {
    id: 'outfit_honey_champion',
    name: 'Champion Miel',
    emoji: '',
    description: "A bold red-and-gold boxing outfit with a fluttering headband. Miel cheers you on like it's the final round. Wear it from Miel's Wardrobe.",
    price: 15000,
    category: 'outfits',
    image: require('@/assets/images/honey/honey-champion.png'),
  },
  {
    id: 'outfit_honey_zzz',
    name: 'ZZZ Miel',
    emoji: '',
    description: "A starry hooded pajama set with moon slippers. Miel mumbles sleepy 'study first, snuggle after' reminders. Wear it from Miel's Wardrobe.",
    price: 7000,
    category: 'outfits',
    image: require('@/assets/images/honey/honey-zzz.png'),
  },
  {
    id: 'outfit_bunny_jiraikei',
    name: 'Jirai Kei Bunny',
    emoji: '',
    description: "A pink-and-black jirai kei outfit. Bunny turns cute-but-menacing while wearing it. Wear it from Bunny's Wardrobe.",
    price: 15000,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-jiraikei.png'),
  },
  {
    id: 'outfit_bunny_palace',
    name: 'Blue Peony Bunny',
    emoji: '',
    description: "An ornate blue peony robe and headdress. Bunny rules by royal decree. Wear it from Bunny's Wardrobe.",
    price: 7000,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-palace.png'),
  },
  {
    id: 'outfit_bunny_royal',
    name: 'Berry Princess Bunny',
    emoji: '',
    description: "A crimson-and-gold strawberry princess gown with a lace bonnet and gold crown. Yours free with Plus. Wear it from Bunny's Wardrobe.",
    price: 10000,
    category: 'outfits',
    image: require('@/assets/images/bunny/bunny-royal.png'),
    plusOnly: true,
  },
  {
    id: 'outfit_hanji_ivoryrose',
    name: 'Ivory Rose Hanji',
    emoji: '',
    description: "An ivory lace bonnet and cream wisteria hanfu with a white rose. Hanji at her calmest. Wear it from Hanji's Wardrobe.",
    price: 10000,
    category: 'outfits',
    image: require('@/assets/images/hanji/hanji-ivoryrose.png'),
  },

  // ─── Backgrounds / study rooms (6000–8000 coins) ─────────────────────────
  {
    id: 'bg_modern_kitchen',
    name: 'Modern Kitchen',
    emoji: '',
    description: 'A sleek modern kitchen backdrop — pairs with the Marble desk.',
    price: 6000,
    category: 'background',
    image: require('@/assets/images/backgrounds/modern-kitchen.png'),
  },
  {
    id: 'bg_washitsu',
    name: 'Beach',
    emoji: '',
    description: 'A sunny seaside beach backdrop — pairs with the Wood desk.',
    price: 6000,
    category: 'background',
    image: require('@/assets/images/backgrounds/beach.png'),
  },
  {
    id: 'bg_tiras_room',
    name: "Tira's Room",
    emoji: '',
    description: "Tira's cozy blue bedroom — soft quilts, lace curtains, and morning light.",
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/tiras-room.png'),
  },
  {
    id: 'bg_miels_room',
    name: "Miel's Room",
    emoji: '',
    description: "Miel's cozy honey bedroom — gingham quilts, warm sunlight, and a sleepy bear nook. Pairs with Miel's ZZZ pajamas.",
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/miels-room.png'),
  },
  {
    id: 'bg_afternoon_train',
    name: 'Afternoon Train',
    emoji: '',
    description: "A vintage train cabin — big windows over rolling countryside, blue floral seats. Pairs with the Afternoon Train desk and Tira's hakama.",
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/afternoon-train.png'),
  },
  {
    id: 'bg_tranquil',
    name: 'Tranquil',
    emoji: '',
    description: 'A serene Japanese kitchen — warm wood, pottery shelves, and a sunlit sakura window. Pairs with the Maplewood desk.',
    price: 6000,
    category: 'background',
    image: require('@/assets/images/backgrounds/tranquil.png'),
  },
  {
    id: 'bg_landmine',
    name: 'Landmine',
    emoji: '',
    description: 'A pink-and-black jirai kei bedroom — bows, a lit vanity mirror, and a moonlit window.',
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/landmine.png'),
  },
  {
    id: 'bg_lavender_palace',
    name: 'Lavender Palace',
    emoji: '',
    description: 'A serene wisteria palace — moon gate, lavender blooms, and warm wood. Pairs with the Lavender desk.',
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/lavender-palace.png'),
  },
  {
    id: 'bg_frostbloom_shrine',
    name: 'Frostbloom Shrine',
    emoji: '',
    description: 'A snow-hushed shrine courtyard — white plum blossoms, frosted lanterns, and a clear winter sky.',
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/frostbloom-shrine.png'),
  },
  {
    id: 'bg_moonlit_balcony',
    name: 'Moonlit Balcony',
    emoji: '',
    description: 'A cozy rooftop balcony under a crescent moon — lantern light, lavender blooms, and a starry town skyline. Pairs with the Rosewood desk.',
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/moonlit-balcony.png'),
  },
  {
    id: 'bg_strawberry_palace',
    name: 'Golden Teahouse',
    emoji: '',
    description: 'A royal strawberry-pink palace — gilded throne, ribbon drapes, and a berry-sweet tea table. Yours free with Plus.',
    price: 8000,
    category: 'background',
    image: require('@/assets/images/backgrounds/strawberry-palace.png'),
    plusOnly: true,
  },
  // ─── Desks / study surfaces (5000 coins) ────────────────────────────────
  {
    id: 'desk_marble',
    name: 'Marble Desk',
    emoji: '',
    description: 'A clean white marble study surface.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/marble.png'),
  },
  {
    id: 'desk_wood',
    name: 'Wood Desk',
    emoji: '',
    description: 'A warm natural wood study surface — pairs with the Beach room.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/wood.png'),
  },
  {
    id: 'desk_pale_wood',
    name: 'Pale Wood Desk',
    emoji: '',
    description: "A soft cream-wood study surface — pairs with Tira's Room.",
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/pale-wood.png'),
  },
  {
    id: 'desk_miels',
    name: "Miel's Desk",
    emoji: '',
    description: "A cozy honey-wood study surface — pairs with Miel's Room.",
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/miels.png'),
  },
  {
    id: 'desk_afternoon_train',
    name: 'Afternoon Train Desk',
    emoji: '',
    description: 'A navy floral cabin floor with gold trim — pairs with the Afternoon Train background.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/afternoon-train.png'),
  },
  {
    id: 'desk_maple',
    name: 'Maplewood Desk',
    emoji: '',
    description: 'A bright maplewood study surface — pairs with the Tranquil room.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/maple.png'),
  },
  {
    id: 'desk_landmine',
    name: 'Noir Desk',
    emoji: '',
    description: 'A matte black study surface — pairs with the Landmine room.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/landmine.png'),
  },
  {
    id: 'desk_lavender',
    name: 'Lavender Desk',
    emoji: '',
    description: 'A soft pale-wood study surface — pairs with the Lavender Palace room.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/lavender.png'),
  },
  {
    id: 'desk_strawberry',
    name: 'Golden Teahouse Desk',
    emoji: '',
    description: 'A warm blush-and-gold gilded tabletop — pairs with the Golden Teahouse room. Yours free with Plus.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/strawberry.png'),
    plusOnly: true,
  },
  {
    id: 'desk_snow',
    name: 'Snow Desk',
    emoji: '',
    description: 'A soft bed of fresh snow — pairs with the Frostbloom Shrine room.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/snow.png'),
  },
  {
    id: 'desk_rosewood',
    name: 'Rosewood Desk',
    emoji: '',
    description: 'A rich reddish-brown rosewood study surface — pairs with the Moonlit Balcony room.',
    price: 5000,
    category: 'desk',
    image: require('@/assets/images/desks/rosewood.png'),
  },

  // ─── Break games are all free to play — nothing to buy here. ──────────────

  // ─── Recipes (cake-game desserts, 10000 coins) ───────────────────────────
  // Bunny's roll cake is free for every player (no unlock SKU — see RECIPE_BADGES
  // recipeItem: null). price 0 makes the shop card always show as Owned.
  {
    id: 'recipe_rollcake',
    name: 'Strawberry Roll Cake',
    emoji: '',
    description: 'A fluffy sponge rolled up with fresh strawberries and cream.',
    price: 0,
    category: 'recipe',
    image: require('@/assets/images/cake/strawberry-shortcake.png'),
    owner: 'Bunny',
  },
  {
    id: 'recipe_pudding',
    name: 'Pudding',
    emoji: '',
    description: 'A soft caramel pudding with a silky custard heart and a golden sweetness that melts gently with every spoonful.',
    price: 10000,
    category: 'recipe',
    image: require('@/assets/images/cake/pudding.png'),
    owner: 'Miel',
  },
  {
    id: 'recipe_sakura',
    name: 'Sakura Mochi',
    emoji: '',
    description: 'A pink spring mochi wrapped in a fragrant cherry leaf, soft and chewy with a gentle red bean sweetness inside.',
    price: 10000,
    category: 'recipe',
    image: require('@/assets/images/cake/sakura-mochi.png'),
    owner: 'Soda',
  },
  {
    id: 'recipe_matcha',
    name: 'Matcha Mille Crêpe',
    emoji: '',
    description: 'Layers of delicate green tea crêpes stacked with soft cream, creating a calm matcha sweetness in every slice.',
    price: 10000,
    category: 'recipe',
    image: require('@/assets/images/cake/matcha-crepe.png'),
    owner: 'Tira',
  },
  {
    id: 'recipe_croissant',
    name: 'Berry Croissant',
    emoji: '',
    description: 'A buttery golden croissant topped with bright berries and soft cream, crisp on the outside and dreamy within.',
    price: 10000,
    category: 'recipe',
    image: require('@/assets/images/cake/croissant.png'),
    owner: 'Bun',
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
    price: 0,
    category: 'sound',
    image: require('@/assets/images/sounds/rain.png'),
    // Free for all users — hidden from the shop, unlocked everywhere.
    free: true,
  },
  {
    id: 'sound_ocean',
    name: 'Ocean',
    emoji: '',
    description: 'Waves rolling onto the shore.',
    price: 3000,
    category: 'sound',
    image: require('@/assets/images/sounds/ocean.png'),
  },
  {
    id: 'sound_fireplace',
    name: 'Fireplace',
    emoji: '',
    description: 'Crackling warm fire.',
    price: 3000,
    category: 'sound',
    image: require('@/assets/images/sounds/fireplace.png'),
  },
  {
    id: 'sound_night',
    name: 'Night Sounds',
    emoji: '',
    description: 'Crickets and cool evening air.',
    price: 3000,
    category: 'sound',
    image: require('@/assets/images/sounds/night.png'),
  },
];
