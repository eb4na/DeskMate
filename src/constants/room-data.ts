// Room pairs — a background and a desk that belong together. Buying or equipping
// one half pulls in its partner so a "room" always looks complete.
//
// `shopItemId` of the pair is the background's shop item id (buying it grants
// both halves). The default room has no shop items (always owned).

export type RoomPair = {
  id: string;
  name: string;
  backgroundId: string | null; // shop item id for the background, or null (default)
  deskId: string | null; // shop item id for the desk, or null (default)
  backgroundImage: number;
  deskImage: number | null; // null = a deskless room (background only, no desk surface)
  // Desk surface render tuning. `deskFit: 'contain'` zooms the desk out (shows the
  // whole image instead of cropping), and `deskTint` fills the revealed edges with
  // a colour that blends into the surface (e.g. a tiled floor's base tone).
  deskFit?: 'cover' | 'contain';
  deskTint?: string;
  // Default room only: it has no shop item to carry a description, so it stores
  // its own here (shown via the info badge). Localize with roomDescs.<id>.
  description?: string;
};

export const DEFAULT_ROOM_BG = require('@/assets/images/home/home-room-bg.png');

export const ROOM_PAIRS: RoomPair[] = [
  {
    id: 'cozy',
    name: 'Cozy Bakery',
    backgroundId: null,
    deskId: null,
    backgroundImage: require('@/assets/images/home/home-room-bg.png'),
    deskImage: require('@/assets/images/home/desk-new.png'),
    description: 'The snug pastel room you start in — a sunlit window, flower-dotted shelves, and a warm wooden baking desk.',
  },
  {
    id: 'modern',
    name: 'Modern Kitchen',
    backgroundId: 'bg_modern_kitchen',
    deskId: 'desk_marble',
    backgroundImage: require('@/assets/images/backgrounds/modern-kitchen.png'),
    deskImage: require('@/assets/images/desks/marble.png'),
  },
  {
    id: 'washitsu',
    name: 'Beach',
    backgroundId: 'bg_washitsu',
    deskId: 'desk_wood',
    backgroundImage: require('@/assets/images/backgrounds/beach.png'),
    deskImage: require('@/assets/images/desks/wood.png'),
  },
  {
    id: 'tiras-room',
    name: "Tira's Room",
    backgroundId: 'bg_tiras_room',
    deskId: 'desk_pale_wood',
    backgroundImage: require('@/assets/images/backgrounds/tiras-room.png'),
    deskImage: require('@/assets/images/desks/pale-wood.png'),
  },
  {
    id: 'buns-room',
    name: "Bun's Room",
    backgroundId: 'bg_buns_room',
    deskId: 'desk_pink',
    backgroundImage: require('@/assets/images/backgrounds/buns-room.png'),
    deskImage: require('@/assets/images/desks/pink.png'),
  },
  {
    // Miel's cozy honey bedroom — paired with the ZZZ pajama skin.
    id: 'miels-room',
    name: "Miel's Room",
    backgroundId: 'bg_miels_room',
    deskId: 'desk_miels',
    backgroundImage: require('@/assets/images/backgrounds/miels-room.png'),
    deskImage: require('@/assets/images/desks/miels.png'),
    // The honey-wood surface is a uniform texture; this matching tint fills any
    // edge sliver the cover-crop reveals so the desk never "cuts out" at the sides.
    deskTint: '#FEC04F',
  },
  {
    // Matched set — Tranquil kitchen background + Maplewood desk.
    id: 'tranquil',
    name: 'Tranquil',
    backgroundId: 'bg_tranquil',
    deskId: 'desk_maple',
    backgroundImage: require('@/assets/images/backgrounds/tranquil.png'),
    deskImage: require('@/assets/images/desks/maple.png'),
  },
  {
    // Matched set — Landmine jirai kei bedroom + Noir (black) desk.
    id: 'landmine',
    name: 'Landmine',
    backgroundId: 'bg_landmine',
    deskId: 'desk_landmine',
    backgroundImage: require('@/assets/images/backgrounds/landmine.png'),
    deskImage: require('@/assets/images/desks/landmine.png'),
  },
  {
    // Matched set — Lavender Palace background + its own pale-wood floor as the desk.
    id: 'lavender-palace',
    name: 'Lavender Palace',
    backgroundId: 'bg_lavender_palace',
    deskId: 'desk_lavender',
    backgroundImage: require('@/assets/images/backgrounds/lavender-palace.png'),
    deskImage: require('@/assets/images/desks/lavender.png'),
  },
  {
    // Matched set — snowy shrine courtyard + an all-snow desk surface that ties
    // into the background's fresh-snow palette (built by scripts/generate-snow-desk.py).
    id: 'frostbloom-shrine',
    name: 'Frostbloom Shrine',
    backgroundId: 'bg_frostbloom_shrine',
    deskId: 'desk_snow',
    backgroundImage: require('@/assets/images/backgrounds/frostbloom-shrine.png'),
    deskImage: require('@/assets/images/desks/snow.png'),
  },
  {
    // Plus-exclusive matched set — background + crimson cloth desk, both granted with Plus.
    id: 'strawberry-palace',
    name: 'Golden Teahouse',
    backgroundId: 'bg_strawberry_palace',
    deskId: 'desk_strawberry',
    backgroundImage: require('@/assets/images/backgrounds/strawberry-palace.png'),
    // Desk built from the palace's own cream-pink marble + gold-filigree floor so
    // it ties into the background. Cover-cropped like the other desks; deskTint is
    // the floor base color as a safety net if the image is slow/stale to load.
    deskImage: require('@/assets/images/desks/strawberry.png'),
    deskTint: '#F3D7CA',
  },
  {
    // Matched set for Tira's Afternoon Train outfit — a vintage train cabin
    // background + navy floral floor. deskTint is the navy base color as a safety
    // net if the desk image is slow/stale to load.
    id: 'afternoon-train',
    name: 'Afternoon Train',
    backgroundId: 'bg_afternoon_train',
    deskId: 'desk_afternoon_train',
    backgroundImage: require('@/assets/images/backgrounds/afternoon-train.png'),
    deskImage: require('@/assets/images/desks/afternoon-train.png'),
    // Plain cover desk (centered): a solid navy surface. deskTint matches the
    // surface as a load-time safety net.
    deskTint: '#384F64',
  },
];

/** The pair that contains the given shop item id (background or desk), if any. */
export function pairForItem(itemId: string): RoomPair | undefined {
  return ROOM_PAIRS.find((p) => p.backgroundId === itemId || p.deskId === itemId);
}

/** The room pair with the given pair id (e.g. an outfit's `roomId`), if any. */
export function roomById(roomId: string | null | undefined): RoomPair | undefined {
  return roomId ? ROOM_PAIRS.find((p) => p.id === roomId) : undefined;
}

/** The partner item id (desk for a background, background for a desk). */
export function partnerItemId(itemId: string): string | undefined {
  const p = pairForItem(itemId);
  if (!p) return undefined;
  return p.backgroundId === itemId ? p.deskId ?? undefined : p.backgroundId ?? undefined;
}

/** A room "has a pair" if it's a complete matched background+desk set. The
 * default Cozy room counts (its free background + desk go together); a room
 * that only defines a background (e.g. Tatami) does not. */
export function roomHasPair(room: RoomPair): boolean {
  return room.id === 'cozy' || (!!room.backgroundId && !!room.deskId);
}

export function backgroundOwned(room: RoomPair, ownedShopItems: string[]): boolean {
  return !room.backgroundId || ownedShopItems.includes(room.backgroundId);
}

export function deskOwned(room: RoomPair, ownedShopItems: string[]): boolean {
  return !room.deskId || ownedShopItems.includes(room.deskId);
}

/** A pair is owned when both halves are owned (null halves are free/owned). */
export function isPairOwned(pair: RoomPair, ownedShopItems: string[]): boolean {
  return backgroundOwned(pair, ownedShopItems) && deskOwned(pair, ownedShopItems);
}
