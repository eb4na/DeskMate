// Derive the disco-scene palette from the player's chosen VINYL colour: take its hue and
// build an ANALOGOUS spread (neighbours on the colour wheel) so the whole scene is themed
// around that colour — varied, not one flat tone. `dark` = the black/white study-background
// choice (deep night vs light scene). Returns CSS `hsl()` strings (RN + react-native-svg
// both accept them).

function hexToHue(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return 280; // default to a purple if we can't parse
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 280; // greyscale vinyl → fall back to purple so the scene isn't grey
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;

export type DiscoPalette = {
  bg: [string, string, string]; // radial gradient stops: centre, mid, edge
  spot: string; // spotlight glow under the character
  beam: string; // disco-ball light beams
  floor: [string, string, string, string]; // analogous floor lights (spread around the wheel)
  note: string; // music notes
  star: string; // dot stars
  sparkle: string; // accent glints (paired with white) on the ball/sparkles
  charTint: string; // light wash over the character
  fg: string; // timer + button text: white in dark mode, a DARK vinyl-hue shade in light mode
};

export function discoPalette(vinylHex: string, dark: boolean): DiscoPalette {
  const h = hexToHue(vinylHex);
  if (dark) {
    return {
      bg: [hsl(h, 45, 18), hsl(h + 12, 55, 9), hsl(h + 24, 60, 4)],
      spot: hsl(h, 60, 58),
      beam: hsl(h + 30, 75, 78),
      floor: [hsl(h - 35, 75, 66), hsl(h, 72, 64), hsl(h + 35, 75, 66), hsl(h + 70, 70, 64)],
      note: hsl(h + 18, 70, 75),
      star: hsl(h, 28, 96),
      sparkle: hsl(h + 20, 80, 72),
      charTint: hsl(h + 10, 62, 68),
      fg: '#FFFFFF',
    };
  }
  return {
    bg: [hsl(h, 70, 97), hsl(h + 12, 55, 91), hsl(h + 24, 48, 85)],
    spot: hsl(h, 60, 80),
    beam: hsl(h + 30, 60, 78),
    floor: [hsl(h - 35, 65, 70), hsl(h, 62, 68), hsl(h + 35, 65, 70), hsl(h + 70, 60, 68)],
    note: hsl(h + 18, 55, 58),
    star: hsl(h, 45, 60),
    sparkle: hsl(h + 20, 65, 62),
    charTint: hsl(h + 10, 58, 72),
    fg: hsl(h, 52, 26),
  };
}
