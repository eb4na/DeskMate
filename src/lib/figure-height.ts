import type { ViewStyle } from 'react-native';
import { FIGURE_METRICS } from '@/constants/figure-calibration';
import { isHanjiActiveId } from '@/lib/companion-utils';

// ─── Companion height ladder — THE tuning knob ─────────────────────────────
// Each companion's standing height in the study room, relative to Bunny (= 1.0,
// the approved reference size). Dial a number, then preview the whole cast with
//   python3 scripts/render-height-chart.py   →  scripts/height-chart.png
// The app reads this table live — no other change needed. Per-image padding
// differences (including every wardrobe skin) are normalized away via the
// generated FIGURE_METRICS, so a skin swap can never change a character's height.
export const HEIGHT_LADDER: Record<string, number> = {
  companion_bunny: 1.0, // reference — renders exactly as before
  bun: 0.84, // the shortest of the cast
  companion_cocoa: 1.0,
  companion_tira: 0.98,
  companion_honey: 0.95,
  hanji: 1.0,
};

// Bunny's classic art defines the baseline: every figure is scaled so its content
// height = ladder × Bunny's content height, and its feet land on Bunny's baseline.
const REF = FIGURE_METRICS['companion_bunny/classic'];

/** Ladder/metrics key for a synced companion id (`shop:<itemId>` → itemId, Hanji
 * → 'hanji', anything else — absent/starter — → 'bun'). For YOUR OWN companion
 * use the already-resolved soloBookKey instead: it also handles custom slot
 * companions ('custom' → no calibration). */
export function companionFigureKey(companionId: string | null | undefined): string {
  if (isHanjiActiveId(companionId)) return 'hanji';
  if (companionId?.startsWith('shop:')) return companionId.slice(5);
  return 'bun';
}

/** Height-calibration transform for one figure rendered in a `boxSize`² box with
 * contentFit:"contain" — scales about the feet and re-lands the content bottom on
 * Bunny's baseline. `undefined` when no correction applies (Bunny herself,
 * custom companions, art not yet measured — run scripts/measure-figure-heights.py). */
export function figureStyle(
  figureKey: string,
  skinId: string | null | undefined,
  boxSize: number,
): ViewStyle | undefined {
  const ladder = HEIGHT_LADDER[figureKey];
  const m = FIGURE_METRICS[`${figureKey}/${skinId || 'classic'}`];
  if (!ladder || !m) return undefined;
  const scale = (REF.fill * ladder) / m.fill;
  const translateY = (scale * m.pad - REF.pad) * boxSize;
  if (Math.abs(scale - 1) < 0.001 && Math.abs(translateY) < 0.5) return undefined;
  return { transform: [{ translateY }, { scale }], transformOrigin: 'center bottom' };
}

/** Height of the figure's head (content top) above the box bottom, as a fraction
 * of the box — exact by construction once figureStyle is applied. Anchors the MP
 * host crown to the actual head instead of the (shared) box top. */
export function figureHeadFrac(figureKey: string): number {
  return REF.pad + (HEIGHT_LADDER[figureKey] ?? 1) * REF.fill;
}
