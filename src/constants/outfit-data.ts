// Placeholder costume data per character. Real costume art can be dropped in
// later by adding an `image` field and rendering it in the shop.
export type Outfit = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  characterId: string;
  image?: number;
};

// Keyed by character id:
//   'starter:girl'           → Bun (free starter)
//   'shop:companion_cocoa'   → Cocoa
//   'shop:companion_bunny'   → Bunny
// AI companion slots fall back to the generic set.
// No costume art yet — categories stay empty until real outfits are added here.
export const CHARACTER_OUTFITS: Record<string, Outfit[]> = {
  // Each outfit's `id` matches its shop item id so buying it unlocks the matching
  // wardrobe skin. Wearable from the Companion Bakery → that companion's Wardrobe.
  'starter:girl': [
    { id: 'outfit_bun_angel', name: 'Angel', emoji: '', price: 600, characterId: 'starter:girl', image: require('@/assets/images/bun/bun-angel.png') },
    { id: 'outfit_bun_snowrabbit', name: 'Snow Rabbit', emoji: '', price: 600, characterId: 'starter:girl', image: require('@/assets/images/bun/bun-snowrabbit.png') },
    { id: 'outfit_bun_dreams', name: 'Strawberry Dreams', emoji: '', price: 600, characterId: 'starter:girl', image: require('@/assets/images/bun/bun-dreams.png') },
  ],
  'shop:companion_cocoa': [
    { id: 'outfit_cocoa_relax', name: 'Relax', emoji: '', price: 600, characterId: 'shop:companion_cocoa', image: require('@/assets/images/cocoa/cocoa-relax.png') },
    { id: 'outfit_cocoa_demon', name: 'Demon', emoji: '', price: 600, characterId: 'shop:companion_cocoa', image: require('@/assets/images/cocoa/cocoa-demon.png') },
  ],
  'shop:companion_tira': [
    { id: 'outfit_tira_chocomint', name: 'Choco Mint', emoji: '', price: 600, characterId: 'shop:companion_tira', image: require('@/assets/images/tira/tira-chocomint.png') },
    { id: 'outfit_tira_sleepover', name: 'Sleepover', emoji: '', price: 600, characterId: 'shop:companion_tira', image: require('@/assets/images/tira/tira-sleepover.png') },
    { id: 'outfit_tira_afternoontrain', name: 'Carefree Days', emoji: '', price: 600, characterId: 'shop:companion_tira', image: require('@/assets/images/tira/tira-afternoon-train.png') },
  ],
  'shop:companion_honey': [
    { id: 'outfit_honey_champion', name: 'Champion', emoji: '', price: 600, characterId: 'shop:companion_honey', image: require('@/assets/images/honey/honey-champion.png') },
    { id: 'outfit_honey_zzz', name: 'ZZZ', emoji: '', price: 600, characterId: 'shop:companion_honey', image: require('@/assets/images/honey/honey-zzz.png') },
  ],
  'shop:companion_bunny': [
    { id: 'outfit_bunny_jiraikei', name: 'Jirai Kei', emoji: '', price: 600, characterId: 'shop:companion_bunny', image: require('@/assets/images/bunny/bunny-jiraikei.png') },
    { id: 'outfit_bunny_palace', name: 'Blue Peony', emoji: '', price: 600, characterId: 'shop:companion_bunny', image: require('@/assets/images/bunny/bunny-palace.png') },
  ],
  'shop:companion_hanji': [
    { id: 'outfit_hanji_ivoryrose', name: 'Ivory Rose', emoji: '', price: 600, characterId: 'shop:companion_hanji', image: require('@/assets/images/hanji/hanji-ivoryrose.png') },
  ],
};

export function outfitsForCharacter(characterId: string): Outfit[] {
  return CHARACTER_OUTFITS[characterId] ?? [];
}
