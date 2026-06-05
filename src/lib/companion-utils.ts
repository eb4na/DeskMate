import type { ActiveCompanionId, CompanionSlot, DefaultCompanionId } from '@/context/app-context';
import { SHOP_ITEMS } from '@/constants/shop-data';

export type CompanionImageSource = number | { uri: string };

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
): ResolvedCompanion {
  // Purchased shop companion (id form `shop:<itemId>`).
  if (activeCompanionId && activeCompanionId.startsWith('shop:')) {
    const itemId = activeCompanionId.slice(5);
    const item = SHOP_COMPANIONS.find((i) => i.id === itemId);
    if (item?.image) {
      return { type: 'shop', id: item.id, name: item.name, imageSource: item.image };
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
