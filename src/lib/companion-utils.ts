import type { ActiveCompanionId, CompanionSlot, DefaultCompanionId } from '@/context/app-context';
import { SHOP_ITEMS } from '@/constants/shop-data';

export type CompanionImageSource = number | { uri: string };

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
  'Angel Kei': 'outfitNames.angelKei',
  Relax: 'outfitNames.relax',
  Demon: 'outfitNames.demon',
  "Wolf's Meal": 'outfitNames.wolfsMeal',
  'Choco Mint': 'outfitNames.chocoMint',
  Sleepover: 'outfitNames.sleepover',
  Champion: 'outfitNames.champion',
  ZZZ: 'outfitNames.zzz',
  'Jirai Kei': 'outfitNames.jiraiKei',
  'Blue Peony': 'outfitNames.bluePeony',
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
export type BunSkin = { id: string; name: string; emoji: string; image: number; shopItemId: string | null };
export const BUN_SKINS: BunSkin[] = [
  { id: 'classic', name: 'Classic', emoji: '🍓', image: require('@/assets/images/bun/bun-home.png'), shopItemId: null },
  { id: 'angel', name: 'Angel', emoji: '👼', image: require('@/assets/images/bun/bun-angel.png'), shopItemId: 'outfit_bun_angel' },
  { id: 'angelkei', name: 'Angel Kei', emoji: '😇', image: require('@/assets/images/bun/bun-angelkei.png'), shopItemId: 'outfit_bun_angelkei' },];

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
    { id: 'classic', name: 'Classic', emoji: '☕', image: require('@/assets/images/cocoa/cocoa.png'), shopItemId: null },
    { id: 'relax', name: 'Relax', emoji: '🍁', image: require('@/assets/images/cocoa/cocoa-relax.png'), shopItemId: 'outfit_cocoa_relax' },
    { id: 'demon', name: 'Demon', emoji: '😈', image: require('@/assets/images/cocoa/cocoa-demon.png'), shopItemId: 'outfit_cocoa_demon' },
  ],
  'shop:companion_tira': [
    { id: 'classic', name: 'Classic', emoji: '🍰', image: require('@/assets/images/tira/tira.png'), shopItemId: null },
    { id: 'wolfsmeal', name: "Wolf's Meal", emoji: '🧺', image: require('@/assets/images/tira/tira-wolfsmeal.png'), shopItemId: 'outfit_tira_wolfsmeal' },
    { id: 'chocomint', name: 'Choco Mint', emoji: '🍫', image: require('@/assets/images/tira/tira-chocomint.png'), shopItemId: 'outfit_tira_chocomint' },
    { id: 'sleepover', name: 'Sleepover', emoji: '🌙', image: require('@/assets/images/tira/tira-sleepover.png'), shopItemId: 'outfit_tira_sleepover' },
  ],
  'shop:companion_honey': [
    { id: 'classic', name: 'Classic', emoji: '🍯', image: require('@/assets/images/honey/honey.png'), shopItemId: null },
    { id: 'champion', name: 'Champion', emoji: '🏆', image: require('@/assets/images/honey/honey-champion.png'), shopItemId: 'outfit_honey_champion' },
    { id: 'zzz', name: 'ZZZ', emoji: '😴', image: require('@/assets/images/honey/honey-zzz.png'), shopItemId: 'outfit_honey_zzz' },
  ],
  'shop:companion_bunny': [
    { id: 'classic', name: 'Classic', emoji: '👑', image: require('@/assets/images/bunny/bunny.png'), shopItemId: null },
    { id: 'jiraikei', name: 'Jirai Kei', emoji: '🖤', image: require('@/assets/images/bunny/bunny-jiraikei.png'), shopItemId: 'outfit_bunny_jiraikei' },
    { id: 'palace', name: 'Blue Peony', emoji: '🪷', image: require('@/assets/images/bunny/bunny-palace.png'), shopItemId: 'outfit_bunny_palace' },
  ],
  'shop:companion_hanji': [
    { id: 'classic', name: 'Classic', emoji: '🐈‍⬛', image: require('@/assets/images/hanji/hanji.png'), shopItemId: null },
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
export const SHOP_COMPANIONS = SHOP_ITEMS.filter((i) => i.category === 'companion' && i.image);

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
