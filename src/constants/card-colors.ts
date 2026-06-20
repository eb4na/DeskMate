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

// Resolve a stored key or arbitrary hex from the colour wheel to a colour pair.
export function cardColors(key?: string | null): { outline: string; strip: string } {
  if (!key) return CARD_COLORS[DEFAULT_CARD_COLOR];
  if (key.startsWith('#') && key.length >= 7) {
    // Hex from wheel — outline is a 25% tint of the strip against white.
    const r = parseInt(key.slice(1, 3), 16);
    const g = parseInt(key.slice(3, 5), 16);
    const b = parseInt(key.slice(5, 7), 16);
    const blend = (c: number) => Math.round(c * 0.28 + 255 * 0.72).toString(16).padStart(2, '0');
    return { outline: `#${blend(r)}${blend(g)}${blend(b)}`, strip: key };
  }
  return CARD_COLORS[(key as CardColorKey)] ?? CARD_COLORS[DEFAULT_CARD_COLOR];
}
