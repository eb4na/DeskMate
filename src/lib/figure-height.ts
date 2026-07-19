import type { ViewStyle } from 'react-native';
import type { ActiveCompanionId, CompanionSlot, DefaultCompanionId } from '@/context/app-context';
import { FIGURE_METRICS } from '@/constants/figure-calibration';
import { isHanjiActiveId, resolveActiveCompanion } from '@/lib/companion-utils';

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

// Per-companion baseline lift — a small UPWARD nudge (fraction of the render box)
// on top of the shared baseline, for art whose visual mass sits low even with its
// feet landed correctly (Aki's chef art hides too much behind the desk otherwise).
export const BASELINE_LIFT: Record<string, number> = {
  companion_cocoa: 0.03, // Aki — ~10px in the solo 350 box
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
  const lift = BASELINE_LIFT[figureKey] ?? 0;
  const translateY = (scale * m.pad - REF.pad - lift) * boxSize;
  if (Math.abs(scale - 1) < 0.001 && Math.abs(translateY) < 0.5) return undefined;
  return { transform: [{ translateY }, { scale }], transformOrigin: 'center bottom' };
}

/** Height of the figure's head (content top) above the box bottom, as a fraction
 * of the box — exact by construction once figureStyle is applied. Anchors the MP
 * host crown to the actual head instead of the (shared) box top. */
export function figureHeadFrac(figureKey: string): number {
  return REF.pad + (HEIGHT_LADDER[figureKey] ?? 1) * REF.fill + (BASELINE_LIFT[figureKey] ?? 0);
}

// ─── Face-crop centring (tight circular avatars) ───────────────────────────────
// The minigame player cards crop the upper body of a companion into a circle. Each
// character's head sits at a DIFFERENT height in its square PNG, so a single fixed
// vertical offset lands some heads too high and others too low. We centre on the
// head CROWN — the content top — which in the raw art is `1 - fill - pad` of the
// box measured from the top (NOT figureHeadFrac, which bakes in the study-room
// height ladder and would re-introduce the height variance we're cancelling).

export type FigureMetricsId = { figureKey: string; skinId: string };

/** Fraction of the square PNG (from the top) where the head crown sits, or
 * `undefined` when the art isn't measured (custom-slot / AI-only / unknown). */
export function figureCrownFrac(figureKey: string, skinId: string | null | undefined): number | undefined {
  const m = FIGURE_METRICS[`${figureKey}/${skinId || 'classic'}`];
  return m ? 1 - m.fill - m.pad : undefined;
}

/** Metrics identity for a synced/friend companion id + skin (`shop:x`/Hanji/Bun).
 * Custom-slot art isn't synced as a shared image, so this always yields a key. */
export function companionMetricsId(companionId: string | null | undefined, skinId: string | null | undefined): FigureMetricsId {
  return { figureKey: companionFigureKey(companionId), skinId: skinId || 'classic' };
}

/** Metrics identity for the resolved ACTIVE companion (also the vs-AI opponent).
 * `undefined` for a custom-slot companion (unmeasured art). */
export function activeCompanionMetricsId(
  activeCompanionId: ActiveCompanionId | null | undefined,
  defaultCompanionId: DefaultCompanionId,
  companionSlots: CompanionSlot[],
  bunSkinId?: string | null,
  companionSkins?: Record<string, string>,
): FigureMetricsId | undefined {
  const c = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  if (c.type === 'slot') return undefined; // custom art, no metrics
  if (c.type === 'shop') return { figureKey: companionFigureKey(activeCompanionId), skinId: companionSkins?.[activeCompanionId ?? ''] || 'classic' };
  return { figureKey: 'bun', skinId: bunSkinId || 'classic' }; // starter (Bun)
}

/** Metrics identity for the player's OWN profile figure — mirrors
 * `resolveProfileFigure`. `undefined` for custom-slot companions (unmeasured). */
export function profileFigureMetricsId(args: {
  profileCompanionId: string;
  profileSkinId: string;
  activeCompanionId: ActiveCompanionId | null | undefined;
  defaultCompanionId: DefaultCompanionId;
  companionSlots: CompanionSlot[];
  bunSkinId?: string | null;
  companionSkins?: Record<string, string>;
}): FigureMetricsId | undefined {
  const { profileCompanionId, profileSkinId, activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins } = args;
  if (profileCompanionId) {
    if (profileCompanionId.startsWith('shop:')) return companionMetricsId(profileCompanionId, profileSkinId);
    return { figureKey: 'bun', skinId: profileSkinId || 'classic' }; // non-shop profile is a Bun skin
  }
  return activeCompanionMetricsId(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
}

/** Vertical shift (as a fraction of the crop box) that lands the head crown at
 * `target` (0 = top of the circle, 1 = bottom) for either avatar transform model:
 *   • 'top'    — image pinned by `top`, height = box×zoom (Connect 4).
 *   • 'center' — image filled then scaled about centre + translateY (Tic-Tac-Toe).
 * `undefined` when the art is unmeasured → the caller keeps its fixed fallback. */
export function faceCropShiftFrac(
  id: FigureMetricsId | undefined,
  opts: { zoom: number; model: 'top' | 'center'; target: number },
): number | undefined {
  if (!id) return undefined;
  const crown = figureCrownFrac(id.figureKey, id.skinId);
  if (crown === undefined) return undefined;
  const { zoom, model, target } = opts;
  return model === 'top' ? target - crown * zoom : target + (zoom - 1) / 2 - crown * zoom;
}
