// Per-room accent colours for the study screen: each room background gets one theme
// hue, and from it we derive a VERY DARK shade (timer text — dark but not pure black)
// and a LIGHTER shade (Break + friend buttons), so the in-session UI suits whatever
// room you're studying in. Keyed by ROOM_PAIRS id (see src/constants/room-data.ts).

const ACCENTS: Record<string, string> = {
  cozy: '#C98A5A',              // Cozy Bakery — warm caramel
  modern: '#7E94A6',           // Modern Kitchen — cool slate
  washitsu: '#3FA3C4',         // Beach — ocean teal
  'tiras-room': '#7EA2E8',     // Tira's Room — lavender blue, leaning blue (cornflower)
  'buns-room': '#E58AA0',      // Bun's Room — strawberry
  'miels-room': '#F0A828',     // Miel's Room — honey gold
  tranquil: '#7AA88C',         // Tranquil — sage green
  landmine: '#CE5A7E',         // Landmine — jirai rose
  'lavender-palace': '#9E80D6',// Lavender Palace — lavender
  'frostbloom-shrine': '#7DB4D8', // Frostbloom Shrine — icy blue
  'strawberry-palace': '#E8896B', // Golden Teahouse — pastel orange-red (coral)
  'afternoon-train': '#D84B4B',// Afternoon Train — red
  'bluebell-lagoon': '#5AA0CC', // Bluebell Lagoon — bluebell blue
};
const DEFAULT_ACCENT = '#C98A5A';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return { h: 30, s: 45, l: 50 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h * 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

// HSL → #rrggbb (RN parses hex everywhere; avoids any hsl() string edge cases).
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export type RoomAccent = {
  button: string;   // Break + Plus button fill — a lighter room-themed colour
  onButton: string; // readable dark text/icon on the light button
  timer: string;    // countdown text fill — a lighter colour from the background
};

// Rooms whose accent should render DEEP — a darker, fully-saturated colour with white
// button text (instead of the default soft pastel), e.g. Afternoon Train's red.
const DEEP_ACCENT = new Set(['afternoon-train']);

export function roomAccent(roomId: string | null | undefined): RoomAccent {
  const { h, s } = hexToHsl(ACCENTS[roomId ?? ''] ?? DEFAULT_ACCENT);
  const baseSat = Math.min(Math.max(s, 38), 80);
  // Desaturated (×0.74) so most rooms' timer + buttons read softer/more muted.
  const sat = Math.round(baseSat * 0.74);
  if (DEEP_ACCENT.has(roomId ?? '')) {
    // Deep: a darker, MUTED (lower-saturation) colour with white text on the button —
    // a dusty brick red rather than a bright one.
    return {
      button: hslToHex(h, Math.round(baseSat * 0.62), 50),
      onButton: '#FFFFFF',
      timer: hslToHex(h, Math.round(baseSat * 0.68), 42),
    };
  }
  return {
    button: hslToHex(h, sat, 70),
    onButton: hslToHex(h, Math.min(sat + 12, 80), 28),
    // A LIGHTER themed fill — it sits inside a thick white outline drawn by the timer
    // component, so a lighter, softer fill still reads on any background.
    timer: hslToHex(h, Math.min(sat + 4, 72), 60),
  };
}
