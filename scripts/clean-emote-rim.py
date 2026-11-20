#!/usr/bin/env python3
"""Remove the opaque white "sticker" rim and grey fringe outside the chat emotes.

clean-emote-haze.py only clears *semi-transparent* haze, so it reports these
files clean — but each emote still carries an OPAQUE near-white rim a few px
wide outside its brown outline (plus a larger white wedge in the notch between
the left ear and the hat, and a grey 1-2 px fringe along the face). On the DM
chat's tan background (#F7E7D3) that reads as a white sticker border.

Rule:
  1. `ink` = the dark brown outline (alpha >= INK_ALPHA, luminance < INK_LUM)
     PLUS coloured strokes (sat > COLOUR_SAT): the Z's, sparkles, sigh puff
     and sweat drop. Floods stop at ink, so the puff's white inside is kept.
  2. Two floods mark the outside:
       A. from border-connected transparent pixels through any non-ink
          pixel, RIM_DEPTH deep: the opaque rim, incl. the ~48 px ear/hat
          wedge;
       B. from every alpha < SEED_ALPHA pixel through semi-transparent
          non-ink only, MAXDEPTH deep: haze pockets enclosed by a sparkle
          that touches the outline. B cannot enter the solid face.
  3. Guards: solid pixels (>= KEEP_ALPHA) inside the outline-with-small-gaps-
     bridged body, or inside a hand-placed RIM_WALLS box, are never touched.
     Flood A cannot cross a wall (Proud's outline has real gaps).
  4. In the outside region:
       - pixels touching ink (<= AA px) are its anti-aliasing: recolour to the
         nearest ink colour, alpha scaled by darkness (brown ink) or
         saturation (coloured ink), so edges stay soft without a white/grey
         fringe;
       - every other neutral (unsaturated) pixel is haze -> alpha 0.

Run on the git ORIGINALS (not already-cleaned files), then run
scripts/fix-emote-details.py. Verify on tan AND dark at chat size.

Usage:
  python3 scripts/clean-emote-rim.py [--preview OUT_DIR] [files...]
  (default: all assets/images/emotes/*.png, edited in place)
"""
from __future__ import annotations

import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

INK_ALPHA = 180
INK_LUM = 150
MAXDEPTH = 18      # flood B (semi-transparent haze) depth
RIM_DEPTH = 64     # flood A depth: the ear/hat white wedge is ~48 px deep
KEEP_ALPHA = 200   # inside guards, pixels at least this opaque are kept
AA = 1.5
MAX_SAT = 45
COLOUR_SAT = 60      # saturation that marks coloured art (Z's, sparkles, puff)
COL_INK_ALPHA = 120  # min alpha for a coloured pixel to count as a stroke
SEED_ALPHA = 64      # alpha below this = definitely outside the figure
SOLID_ALPHA = 250    # the figure's body is ~254; flood B never enters it
BRIDGE = 3           # px; outline gaps up to 2*BRIDGE are bridged for the body guard
# file -> [(x0, y0, x1, y1)] walls across spots where the art's outline has a
# real gap (Proud: the outline breaks at y 330-338 and 350-366 where the
# sparkle and spark lines overlap it). The deep rim flood cannot cross a wall,
# and solid pixels inside it are kept; semi-transparent haze there is still
# cleaned by flood B.
RIM_WALLS = {
    'emote-proud.png': [(108, 324, 138, 372)],
}


def clean(path: str, preview: str | None) -> None:
    arr = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
    rgb, a = arr[..., :3], arr[..., 3]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    sat = rgb.max(-1) - rgb.min(-1)

    dark_ink = (a >= INK_ALPHA) & (lum < INK_LUM)
    # Floating art (Z's, sparkles, sigh puff, sweat drop) is drawn in colour,
    # not dark brown, so coloured strokes count as ink too: the flood stops at
    # them (the puff's white inside stays) and their grey halo is cleaned the
    # same way as the cat's.
    col_ink = (a >= COL_INK_ALPHA) & (sat > COLOUR_SAT)
    ink = dark_ink | col_ink

    # Outside region, two floods:
    #  A. from border-connected transparent pixels through any non-ink pixel
    #     -> catches the OPAQUE white rim outside the outline;
    #  B. from every low-alpha pixel through SEMI-transparent non-ink only
    #     -> catches haze pockets fully enclosed by a sparkle touching the
    #     outline, yet cannot leak through an outline gap into the solid face.
    #     (Verified 2026-11-19: no emote has a<SEED_ALPHA inside the cat.)
    free = ~ink
    border = np.zeros(a.shape, bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True

    def flood(seed: np.ndarray, mask: np.ndarray, depth: int) -> np.ndarray:
        r = seed.copy()
        for _ in range(depth):
            nxt = r | (ndimage.binary_dilation(r) & mask)
            if (nxt == r).all():
                break
            r = nxt
        return r

    wall = np.zeros(a.shape, bool)
    for x0, y0, x1, y1 in RIM_WALLS.get(os.path.basename(path), []):
        wall[y0:y1, x0:x1] = True
    reach_a = flood(ndimage.binary_propagation(border & (a == 0), mask=(a == 0)), free & ~wall, RIM_DEPTH)
    reach_b = flood(a < SEED_ALPHA, free & (a < SOLID_ALPHA), MAXDEPTH)
    # Guards against the deep rim flood leaking into the face:
    #  - body: inked shapes with small outline gaps (<= 2*BRIDGE px) bridged;
    #    the ear/hat wedge opening is far wider, so it stays outside the body.
    #  - RIM_WALLS: hand-listed spots where the art has a real, wide gap in
    #    the outline (see above).
    # Pixels at least KEEP_ALPHA opaque inside either guard are never touched.
    keep = ndimage.binary_fill_holes(ndimage.binary_closing(ink, iterations=BRIDGE)) | wall
    region = (reach_a | reach_b) & (a > 0) & ~(keep & (a >= KEEP_ALPHA))

    d_ink, (iy, ix) = ndimage.distance_transform_edt(~ink, return_indices=True)
    near = region & (d_ink <= AA)
    haze = region & ~near & (sat <= MAX_SAT)

    out = arr.copy()
    out[haze, 3] = 0
    # Edge AA: take the nearest ink pixel's colour; scale alpha by how much of
    # that ink the pixel actually holds (white/grey -> 0, ink -> unchanged).
    # Dark ink is measured by darkness, coloured ink by saturation.
    niy, nix = iy[near], ix[near]
    ink_rgb = rgb[niy, nix]
    by_dark = np.clip((255.0 - lum[near]) / np.maximum(255.0 - lum[niy, nix], 1.0), 0, 1)
    by_sat = np.clip(sat[near] / np.maximum(sat[niy, nix], 1.0), 0, 1)
    share = np.where(dark_ink[niy, nix], by_dark, by_sat)
    out[near, :3] = ink_rgb
    out[near, 3] = a[near] * share

    changed = int(((np.abs(out - arr)).sum(-1) > 0).sum())
    name = os.path.basename(path)
    print(f'{name:26} haze {int(haze.sum()):6d} px   rim-AA {int(near.sum()):5d} px   changed {changed}')

    if preview:
        os.makedirs(preview, exist_ok=True)
        vis = np.asarray(Image.new('RGB', a.shape[::-1], (40, 40, 90))).astype(np.float64)
        f = arr[..., 3:4] / 255.0
        vis = vis * (1 - f) + arr[..., :3] * f
        vis[haze] = (255, 0, 0)
        vis[near] = (0, 255, 0)
        Image.fromarray(vis.astype(np.uint8)).save(os.path.join(preview, 'mask_' + name))
        res = Image.fromarray(out.round().astype(np.uint8), 'RGBA')
        bg = Image.new('RGBA', res.size, (247, 231, 211, 255)); bg.alpha_composite(res)
        bg.convert('RGB').save(os.path.join(preview, 'tan_' + name))
        bg = Image.new('RGBA', res.size, (40, 40, 90, 255)); bg.alpha_composite(res)
        bg.convert('RGB').save(os.path.join(preview, 'dark_' + name))
    else:
        Image.fromarray(out.round().astype(np.uint8), 'RGBA').save(path, optimize=True)


def main() -> None:
    args = sys.argv[1:]
    preview = None
    if '--preview' in args:
        i = args.index('--preview'); preview = args[i + 1]; del args[i:i + 2]
    for p in args or sorted(glob.glob('assets/images/emotes/*.png')):
        clean(p, preview)


if __name__ == '__main__':
    main()
