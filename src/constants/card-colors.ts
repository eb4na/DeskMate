// Pastel colour options for the profile card's outline + friend-code strip.
// Free users get the default pink; Plus members can pick any of these. The key
// persists on `profileCardColor` and is meant to sync to friends later (needs a
// `card_color` column on the profiles table before the upload can include it).
export type CardColorKey = 'pink' | 'lavender' | 'mint' | 'peach' | 'sky' | 'butter';

export const DEFAULT_CARD_COLOR: CardColorKey = 'pink';

// Each option pairs a soft `outline` (card border) with a stronger `strip`
// (the friend-code bar / share button), so the card stays balanced.
export const CARD_COLORS: Record<CardColorKey, { outline: string; strip: string }> = {
  pink: { outline: '#FBD9E0', strip: '#F7A7B8' },
  lavender: { outline: '#E6DBF7', strip: '#BBA3E6' },
  mint: { outline: '#CFEBDA', strip: '#8FD3A8' },
  peach: { outline: '#FBE0CB', strip: '#F4B183' },
  sky: { outline: '#D6E7F7', strip: '#9CC2E8' },
  butter: { outline: '#3A3A3A', strip: '#222222' },
};

export const CARD_COLOR_ORDER: CardColorKey[] = ['pink', 'lavender', 'mint', 'peach', 'sky', 'butter'];

// Resolve a stored key (or anything unknown/legacy) to a colour pair.
export function cardColors(key?: string | null): { outline: string; strip: string } {
  return CARD_COLORS[(key as CardColorKey)] ?? CARD_COLORS[DEFAULT_CARD_COLOR];
}
