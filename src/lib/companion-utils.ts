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
export type BunSkin = { id: string; name: string; emoji: string; image: number; shopItemId: string | null; roomId?: string };
export const BUN_SKINS: BunSkin[] = [
  { id: 'classic', name: 'Strawberry', emoji: '', image: require('@/assets/images/bun/bun-home.png'), shopItemId: null },
  { id: 'angel', name: 'Angel', emoji: '', image: require('@/assets/images/bun/bun-angel.png'), shopItemId: 'outfit_bun_angel' },
  { id: 'strawberry', name: 'Berry Princess', emoji: '', image: require('@/assets/images/bun/bun-strawberry.png'), shopItemId: 'outfit_bun_strawberry' },
  { id: 'snowrabbit', name: 'Snow Rabbit', emoji: '', image: require('@/assets/images/bun/bun-snowrabbit.png'), shopItemId: 'outfit_bun_snowrabbit', roomId: 'frostbloom-shrine' },
  { id: 'dreams', name: 'Strawberry Dreams', emoji: '', image: require('@/assets/images/bun/bun-dreams.png'), shopItemId: 'outfit_bun_dreams', roomId: 'buns-room' },
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
    { id: 'classic', name: 'Top Tier', emoji: '', image: require('@/assets/images/cocoa/cocoa.png'), shopItemId: null },
    { id: 'relax', name: 'Relax', emoji: '', image: require('@/assets/images/cocoa/cocoa-relax.png'), shopItemId: 'outfit_cocoa_relax' },
    { id: 'demon', name: 'Demon', emoji: '', image: require('@/assets/images/cocoa/cocoa-demon.png'), shopItemId: 'outfit_cocoa_demon' },
  ],
  'shop:companion_tira': [
    { id: 'classic', name: 'Graceful Walk', emoji: '', image: require('@/assets/images/tira/tira.png'), shopItemId: null },
    { id: 'chocomint', name: 'Choco Mint', emoji: '', image: require('@/assets/images/tira/tira-chocomint.png'), shopItemId: 'outfit_tira_chocomint' },
    { id: 'sleepover', name: 'Sleepover', emoji: '', image: require('@/assets/images/tira/tira-sleepover.png'), shopItemId: 'outfit_tira_sleepover', roomId: 'tiras-room' },
  ],
  'shop:companion_honey': [
    { id: 'classic', name: 'Honey Bear', emoji: '', image: require('@/assets/images/honey/honey.png'), shopItemId: null },
    { id: 'champion', name: 'Champion', emoji: '', image: require('@/assets/images/honey/honey-champion.png'), shopItemId: 'outfit_honey_champion' },
    { id: 'zzz', name: 'ZZZ', emoji: '', image: require('@/assets/images/honey/honey-zzz.png'), shopItemId: 'outfit_honey_zzz' },
  ],
  'shop:companion_bunny': [
    { id: 'classic', name: 'Cutest Thing Ever', emoji: '', image: require('@/assets/images/bunny/bunny.png'), shopItemId: null },
    { id: 'jiraikei', name: 'Jirai Kei', emoji: '', image: require('@/assets/images/bunny/bunny-jiraikei.png'), shopItemId: 'outfit_bunny_jiraikei', roomId: 'landmine' },
    { id: 'palace', name: 'Blue Peony', emoji: '', image: require('@/assets/images/bunny/bunny-palace.png'), shopItemId: 'outfit_bunny_palace' },
  ],
  'shop:companion_hanji': [
    { id: 'classic', name: 'Quiet Lavender', emoji: '', image: require('@/assets/images/hanji/hanji.png'), shopItemId: null, roomId: 'lavender-palace' },
    { id: 'ivoryrose', name: 'Ivory Rose', emoji: '', image: require('@/assets/images/hanji/hanji-ivoryrose.png'), shopItemId: 'outfit_hanji_ivoryrose' },
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
};
export const STARTER_CHOICES: StarterChoice[] = [
  { activeId: 'starter:girl', shopItemId: 'companion_bun', name: 'Bun', image: require('@/assets/images/bun/bun-home.png') },
  { activeId: 'shop:companion_cocoa', shopItemId: 'companion_cocoa', name: 'Cocoa', image: require('@/assets/images/cocoa/cocoa.png') },
  { activeId: 'shop:companion_bunny', shopItemId: 'companion_bunny', name: 'Bunny', image: require('@/assets/images/bunny/bunny.png') },
  { activeId: 'shop:companion_honey', shopItemId: 'companion_honey', name: 'Miel', image: require('@/assets/images/honey/honey.png') },
  { activeId: 'shop:companion_tira', shopItemId: 'companion_tira', name: 'Tira', image: require('@/assets/images/tira/tira.png') },
];

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
const AVATAR_FACE_NUDGE: Record<string, number> = {
  'shop:companion_cocoa': -3,
  'shop:companion_bunny': -1,
  'shop:companion_honey': 7,
  'shop:companion_tira': -8,
  'shop:companion_hanji': 9,
};
const BUN_FACE_NUDGE = -8;

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
