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
  deskImage: number;
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
];

/** The pair that contains the given shop item id (background or desk), if any. */
export function pairForItem(itemId: string): RoomPair | undefined {
  return ROOM_PAIRS.find((p) => p.backgroundId === itemId || p.deskId === itemId);
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
