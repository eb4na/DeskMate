import type { ActiveCompanionId, CompanionSlot, DefaultCompanionId } from '@/context/app-context';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { HANJI_COMPANION_ID } from '@/constants/recipes';

export type CompanionImageSource = number | { uri: string };

/** True when the active-companion id points at Hanji (`shop:companion_hanji`).
 * Hanji renders as an animated layered figure (swinging tassels) instead of a
 * flat sprite — see HanjiFigure. */
export function isHanjiActiveId(id: string | null | undefined): boolean {
  return id === `shop:${HANJI_COMPANION_ID}`;
}

/** Hanji renders as the animated layered figure (HanjiFigure) only in her default
 * look; any other outfit is a flat sprite like every other companion skin. An
 * unset skin (player never opened the wardrobe) counts as the default. */
export function hanjiIsAnimated(
  companionId: string | null | undefined,
  skinId: string | null | undefined,
): boolean {
  return isHanjiActiveId(companionId) && (!skinId || skinId === 'classic');
}

// Built-in companions have localized display names (gallery.name_*). This maps
// their canonical English name to its i18n key. Any other name (user-created
// companions, outfit/background items) falls back to the original string, so this
// is safe to apply at every name-display site.
const COMPANION_NAME_KEYS: Record<string, string> = {
  Bun: 'gallery.name_Bun',
  Cocoa: 'gallery.name_Cocoa',
  Bunny: 'gallery.name_Bunny',
  Miel: 'gallery.name_Miel',
  Tira: 'gallery.name_Tira',
  Hanji: 'gallery.name_Hanji',
};

/** Localize a built-in companion's name; returns the input unchanged otherwise. */
export function localizeCompanionName(name: string, t: (key: string) => string): string {
  const key = COMPANION_NAME_KEYS[name];
  return key ? t(key) : name;
}

// Outfit / wardrobe-skin display names → i18n keys (outfitNames.*). Applied at
// every place an outfit/skin name is shown (wardrobe labels, shop outfit cards).
const OUTFIT_NAME_KEYS: Record<string, string> = {
  Classic: 'outfitNames.classic',
  Angel: 'outfitNames.angel',
  Relax: 'outfitNames.relax',
  Demon: 'outfitNames.demon',
  "Wolf's Meal": 'outfitNames.wolfsMeal',
  'Choco Mint': 'outfitNames.chocoMint',
  Sleepover: 'outfitNames.sleepover',
  Champion: 'outfitNames.champion',
  ZZZ: 'outfitNames.zzz',
  'Jirai Kei': 'outfitNames.jiraiKei',
  'Blue Peony': 'outfitNames.bluePeony',
  'Berry Princess': 'outfitNames.berryPrincess',
  'Ivory Rose': 'outfitNames.ivoryRose',
  'Strawberry Dreams': 'outfitNames.strawberryDreams',
  'Carefree Days': 'outfitNames.afternoonTrain',
};

/** Localize an outfit/skin name; returns the input unchanged if unmapped. */
export function localizeOutfitName(name: string, t: (key: string) => string): string {
  const key = OUTFIT_NAME_KEYS[name];
  return key ? t(key) : name;
}

export const STARTER_COMPANION_IMAGES: Record<DefaultCompanionId, number> = {
  girl: require('@/assets/images/bun/bun-home.png'),
  dude: require('@/assets/images/bun/bun-home.png'),
};

// Wardrobe — alternate outfits ("skins") for the starter companion Bun.
// `shopItemId: null` means free/owned by default; otherwise it must be purchased.
// `roomId` (optional) ties an outfit to a matched room (ROOM_PAIRS id); the
// wardrobe shows a chain/link icon that sets that background+desk to match.
export type BunSkin = { id: string; name: string; emoji: string; image: number; shopItemId: string | null; roomId?: string; lore?: string };
export const BUN_SKINS: BunSkin[] = [
  { id: 'classic', name: 'Strawberry', emoji: '', image: require('@/assets/images/bun/bun-home.png'), shopItemId: null, lore: "She showed up and never quite left. Warm and familiar, like something you didn't know you were missing." },
  { id: 'angel', name: 'Angel', emoji: '', image: require('@/assets/images/bun/bun-angel.png'), shopItemId: 'outfit_bun_angel', lore: "There is a kind of kindness that doesn't announce itself. It's just there — between one breath and the next, quiet and sure." },
  { id: 'strawberry', name: 'Berry Princess', emoji: '', image: require('@/assets/images/bun/bun-strawberry.png'), shopItemId: 'outfit_bun_strawberry', lore: "A crown worn like it was always there. Sweet at the edges, golden at the center — the kind of warmth that doesn't ask permission." },
  { id: 'snowrabbit', name: 'Snow Rabbit', emoji: '', image: require('@/assets/images/bun/bun-snowrabbit.png'), shopItemId: 'outfit_bun_snowrabbit', roomId: 'frostbloom-shrine', lore: "Cold air. A flower that blooms against the frost anyway. Winter as an invitation, not an ending." },
  { id: 'dreams', name: 'Strawberry Dreams', emoji: '', image: require('@/assets/images/bun/bun-dreams.png'), shopItemId: 'outfit_bun_dreams', roomId: 'buns-room', lore: "A lantern left on low. The night settling in like it belongs. Softness all the way down." },
];

export function getBunSkinImage(skinId: string | null | undefined): number {
  return BUN_SKINS.find((s) => s.id === skinId)?.image ?? BUN_SKINS[0].image;
}

export function isBunSkinUnlocked(skin: BunSkin, ownedShopItems: string[]): boolean {
  return !skin.shopItemId || ownedShopItems.includes(skin.shopItemId);
}

// Returns the equipped skin only if it is owned; otherwise falls back to 'classic'.
export function getEffectiveBunSkinId(
  skinId: string | null | undefined,
  ownedShopItems: string[],
): string {
  const skin = BUN_SKINS.find((s) => s.id === skinId);
  return skin && isBunSkinUnlocked(skin, ownedShopItems) ? skin.id : 'classic';
}

// Alternate outfits ("skins") for purchasable companions, keyed by active
// companion id (`shop:<itemId>`). The first entry is the default look.
export const COMPANION_SKINS: Record<string, BunSkin[]> = {
  'shop:companion_cocoa': [
    { id: 'classic', name: 'Top Tier', emoji: '', image: require('@/assets/images/cocoa/cocoa.png'), shopItemId: null, lore: "Warm without trying. Present without asking. The kind of thing that simply is — and that's the whole of it." },
    { id: 'relax', name: 'Relax', emoji: '', image: require('@/assets/images/cocoa/cocoa-relax.png'), shopItemId: 'outfit_cocoa_relax', lore: "Autumn without urgency. The afternoon that forgets to end. Something like breathing, but slower." },
    { id: 'demon', name: 'Demon', emoji: '', image: require('@/assets/images/cocoa/cocoa-demon.png'), shopItemId: 'outfit_cocoa_demon', lore: "All that sharpness — and still something steady beneath it. The kind of edge that knows exactly where it ends." },
  ],
  'shop:companion_tira': [
    { id: 'classic', name: 'Graceful Walk', emoji: '', image: require('@/assets/images/tira/tira.png'), shopItemId: null, lore: "Composed. Deliberate. Never in a hurry. The kind of stillness that already knows how this ends." },
    { id: 'chocomint', name: 'Choco Mint', emoji: '', image: require('@/assets/images/tira/tira-chocomint.png'), shopItemId: 'outfit_tira_chocomint', lore: "Sweet at the surface. Steady at the core. The kind of softness that holds its shape." },
    { id: 'sleepover', name: 'Sleepover', emoji: '', image: require('@/assets/images/tira/tira-sleepover.png'), shopItemId: 'outfit_tira_sleepover', roomId: 'tiras-room', lore: "The night turned down low. Long evenings. Unhurried mornings. Rest that means it." },
    { id: 'afternoontrain', name: 'Carefree Days', emoji: '', image: require('@/assets/images/tira/tira-afternoon-train.png'), shopItemId: 'outfit_tira_afternoontrain', roomId: 'afternoon-train', lore: "Sunflowers past the window. Something wrapped in cloth. The hours between nowhere and somewhere — the freest ones there are." },
  ],
  'shop:companion_honey': [
    { id: 'classic', name: 'Honey Bear', emoji: '', image: require('@/assets/images/honey/honey.png'), shopItemId: null, lore: "Something warm was already baking. The kind of welcome that doesn't wait to be asked." },
    { id: 'champion', name: 'Champion', emoji: '', image: require('@/assets/images/honey/honey-champion.png'), shopItemId: 'outfit_honey_champion', lore: "Focused. Decided. Already there before the bell. The kind of quiet that wins." },
    { id: 'zzz', name: 'ZZZ', emoji: '', image: require('@/assets/images/honey/honey-zzz.png'), shopItemId: 'outfit_honey_zzz', roomId: 'miels-room', lore: "Soft grids. Gentle timers. A note left somewhere warm. Even in sleep, something here cares." },
  ],
  'shop:companion_bunny': [
    { id: 'classic', name: 'Cutest Thing Ever', emoji: '', image: require('@/assets/images/bunny/bunny.png'), shopItemId: null, lore: "Don't be fooled. It's adorable and it knows exactly what it's doing." },
    { id: 'jiraikei', name: 'Jirai Kei', emoji: '', image: require('@/assets/images/bunny/bunny-jiraikei.png'), shopItemId: 'outfit_bunny_jiraikei', roomId: 'landmine', lore: "It doesn't explain itself. It doesn't need to. The look says enough — and the look says plenty." },
    { id: 'palace', name: 'Blue Peony', emoji: '', image: require('@/assets/images/bunny/bunny-palace.png'), shopItemId: 'outfit_bunny_palace', lore: "It speaks softly. It doesn't have to speak twice." },
  ],
  'shop:companion_hanji': [
    { id: 'classic', name: 'Quiet Lavender', emoji: '', image: require('@/assets/images/hanji/hanji.png'), shopItemId: null, roomId: 'lavender-palace', lore: "Arrived quietly. Stayed. Some presences don't announce themselves — they simply remain." },
    { id: 'ivoryrose', name: 'Ivory Rose', emoji: '', image: require('@/assets/images/hanji/hanji-ivoryrose.png'), shopItemId: 'outfit_hanji_ivoryrose', lore: "Dressed like the day mattered — before knowing what it would bring. That's a kind of faith." },
  ],
};

// Returns only the owned/wearable equipped skins; drops any skin the player no
// longer owns so a locked outfit can never be worn.
export function getEffectiveCompanionSkins(
  companionSkins: Record<string, string> | undefined,
  ownedShopItems: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [companionId, skinId] of Object.entries(companionSkins ?? {})) {
    const skin = COMPANION_SKINS[companionId]?.find((s) => s.id === skinId);
    if (skin && (!skin.shopItemId || ownedShopItems.includes(skin.shopItemId))) out[companionId] = skinId;
  }
  return out;
}

export function getCompanionSkins(companionId: string): BunSkin[] {
  return COMPANION_SKINS[companionId] ?? [];
}

export function getCompanionSkinImage(companionId: string, skinId: string | null | undefined): number | null {
  const skins = COMPANION_SKINS[companionId];
  if (!skins) return null;
  return (skins.find((s) => s.id === skinId) ?? skins[0]).image;
}

// Purchasable companions that have full-body art usable as the active character.
// `companion_bun` is excluded: Bun is the starter mascot whose active id is
// `starter:girl`, not `shop:companion_bun`; its SKU only exists so an unchosen
// Bun can be shown/bought in the shop grid.
export const SHOP_COMPANIONS = SHOP_ITEMS.filter(
  (i) => i.category === 'companion' && i.image && i.id !== 'companion_bun',
);

// ─── Starter companions ────────────────────────────────────────────────────
// The five characters a new player chooses one of (for free) on first launch;
// the other four are sold in the shop. Order is fixed (carousel order): Bun →
// Cocoa → Bunny → Miel → Tira, wrapping back to Bun. Hanji is excluded — it stays
// a recipe-badge reward.
export type StarterChoice = {
  activeId: ActiveCompanionId; // what activeCompanionId becomes when chosen
  shopItemId: string;          // the SKU granted/checked for ownership
  name: string;                // canonical English name (localize at display)
  image: number;
  bg: string;                  // solid background color for the "obtained" celebration
};
export const STARTER_CHOICES: StarterChoice[] = [
  { activeId: 'starter:girl', shopItemId: 'companion_bun', name: 'Bun', image: require('@/assets/images/bun/bun-home.png'), bg: '#ffc9d0' },
  { activeId: 'shop:companion_cocoa', shopItemId: 'companion_cocoa', name: 'Cocoa', image: require('@/assets/images/cocoa/cocoa.png'), bg: '#c99a73' },
  { activeId: 'shop:companion_bunny', shopItemId: 'companion_bunny', name: 'Bunny', image: require('@/assets/images/bunny/bunny.png'), bg: '#ffc2df' },
  { activeId: 'shop:companion_honey', shopItemId: 'companion_honey', name: 'Miel', image: require('@/assets/images/honey/honey.png'), bg: '#ffcd8c' },
  { activeId: 'shop:companion_tira', shopItemId: 'companion_tira', name: 'Tira', image: require('@/assets/images/tira/tira.png'), bg: '#a3d6ff' },
];

/** Look up a starter/companion by its shop SKU (for the "character obtained" screen). */
export function companionByShopItemId(shopItemId: string): StarterChoice | undefined {
  return STARTER_CHOICES.find((c) => c.shopItemId === shopItemId);
}

/** The active-companion id a companion SKU maps to (Bun is the starter id). */
export function starterActiveIdForItem(itemId: string): ActiveCompanionId {
  return itemId === 'companion_bun' ? 'starter:girl' : `shop:${itemId}`;
}

/**
 * Whether one of the five starter companions is owned: true if it's the chosen
 * free starter, or its SKU was purchased. Use this (not a bare ownedShopItems
 * check) anywhere a starter companion's lock/owned state is shown — it keeps a
 * grandfathered Bun (no `companion_bun` SKU, starter = `starter:girl`) owned.
 */
export function isCompanionOwned(
  itemId: string,
  starterCompanionId: string,
  ownedShopItems: string[],
): boolean {
  return ownedShopItems.includes(itemId) || starterActiveIdForItem(itemId) === starterCompanionId;
}

export type ResolvedCompanion =
  | {
      type: 'starter';
      id: DefaultCompanionId;
      name: string;
      imageSource: number;
    }
  | {
      type: 'slot';
      slot: CompanionSlot;
      name: string;
      imageSource: { uri: string };
    }
  | {
      type: 'shop';
      id: string;
      name: string;
      imageSource: number;
    };

export function getStarterActiveId(id: DefaultCompanionId): ActiveCompanionId {
  return `starter:${id}`;
}

export function resolveActiveCompanion(
  activeCompanionId: ActiveCompanionId | null | undefined,
  defaultCompanionId: DefaultCompanionId,
  companionSlots: CompanionSlot[],
  bunSkinId?: string | null,
  companionSkins?: Record<string, string>,
): ResolvedCompanion {
  // Purchased shop companion (id form `shop:<itemId>`).
  if (activeCompanionId && activeCompanionId.startsWith('shop:')) {
    const itemId = activeCompanionId.slice(5);
    const item = SHOP_COMPANIONS.find((i) => i.id === itemId);
    if (item?.image) {
      const skinId = companionSkins?.[activeCompanionId];
      const skinImg = skinId ? getCompanionSkinImage(activeCompanionId, skinId) : null;
      return { type: 'shop', id: item.id, name: item.name, imageSource: skinImg ?? item.image };
    }
  }

  const activeSlot =
    activeCompanionId && activeCompanionId !== 'starter:girl' && activeCompanionId !== 'starter:dude'
      ? companionSlots.find((slot) => slot.id === activeCompanionId && slot.imageUri)
      : null;

  if (activeSlot?.imageUri) {
    return {
      type: 'slot',
      slot: activeSlot,
      name: activeSlot.name,
      imageSource: { uri: activeSlot.imageUri },
    };
  }

  const starterId: DefaultCompanionId =
    activeCompanionId === 'starter:dude'
      ? 'dude'
      : activeCompanionId === 'starter:girl'
        ? 'girl'
        : defaultCompanionId;

  return {
    type: 'starter',
    id: starterId,
    name: 'Bun',
    imageSource: getBunSkinImage(bunSkinId),
  };
}

/** Resolve a character image straight from a companion id + skin id (e.g. a
 * friend's synced profile). `companionId` empty/starter -> Bun. */
export function getCompanionImage(
  companionId: string | null | undefined,
  skinId: string | null | undefined,
): number {
  if (companionId && companionId.startsWith('shop:')) {
    return getCompanionSkinImage(companionId, skinId ?? 'classic') ?? getBunSkinImage('classic');
  }
  return getBunSkinImage(skinId ?? 'classic');
}

/**
 * Each character's art sits at a different height, so a fixed crop clips some
 * faces in the tight circular avatars (game/friend lists). This nudges each
 * character vertically (px, +down/−up) so its FACE lands centred in the circle.
 * Values are measured from each art's face line (render the avatar crop and dial)
 * — re-check when art changes or a companion is added. Keyed on the companion id;
 * Bun (the default, id '' or non-'shop:') uses the fallback. Do NOT use this for
 * the big home/profile figures.
 */
const AVATAR_FACE_NUDGE: Record<string, number> = {};
const BUN_FACE_NUDGE = 0;

export function bunAvatarNudge(
  companionId: string | null | undefined,
): { transform: { translateY: number }[] } | undefined {
  const isBun = !companionId || !companionId.startsWith('shop:') || companionId === 'shop:companion_bun';
  const translateY = isBun ? BUN_FACE_NUDGE : (AVATAR_FACE_NUDGE[companionId] ?? 0);
  return translateY ? { transform: [{ translateY }] } : undefined;
}

/**
 * The figure shown on the profile card (and used as the avatar everywhere the
 * player represents themselves). Uses the explicitly chosen profile character +
 * outfit when set, otherwise falls back to the active companion.
 */
export function resolveProfileFigure(args: {
  profileCompanionId: string;
  profileSkinId: string;
  activeCompanionId: ActiveCompanionId | null | undefined;
  defaultCompanionId: DefaultCompanionId;
  companionSlots: CompanionSlot[];
  bunSkinId?: string | null;
  companionSkins?: Record<string, string>;
}): CompanionImageSource {
  const {
    profileCompanionId,
    profileSkinId,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  } = args;

  if (!profileCompanionId) {
    return resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins)
      .imageSource;
  }
  const skin = profileSkinId || 'classic';
  if (profileCompanionId.startsWith('shop:')) {
    return getCompanionSkinImage(profileCompanionId, skin) ?? getBunSkinImage('classic');
  }
  return getBunSkinImage(skin);
}
