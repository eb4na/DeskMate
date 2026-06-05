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
  // Bun (free starter) — wearable from the Companion Bakery → Bun's Wardrobe.
  'starter:girl': [
    {
      id: 'outfit_bun_angel',
      name: 'Angel',
      emoji: '👼',
      price: 450,
      characterId: 'starter:girl',
      image: require('@/assets/images/bun/bun-angel.png'),
    },
  ],
};

export function outfitsForCharacter(characterId: string): Outfit[] {
  return CHARACTER_OUTFITS[characterId] ?? [];
}
