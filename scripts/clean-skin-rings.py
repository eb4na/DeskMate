#!/usr/bin/env python3
"""Remove the opaque white "sticker" halo ring around companion skin cutouts.

The skins were cut with a crisp alpha, but a thin ring of *opaque* near-white
pixels sits outside the character's dark outline — visible as a white blur/halo
on any non-white surface. This cuts that ring with a bounded flood-fill seeded
from the transparent boundary, propagating only through near-white pixels and
**stopping at the character's dark outline** — so interior white fur is never
touched. A depth cap is a hard safety net against any edge where fur meets the
ring without an outline.

Fur-safety: only near-white pixels reachable from the transparent edge are
cleared; the dark outline halts the fill, and MAXDEPTH bounds the worst case.
Colour/cream pixels and everything behind the outline are left untouched.

Skips full-scene illustrations (a real background) automatically.

Usage:
  python3 scripts/clean-skin-rings.py            # all skins under the char dirs
  python3 scripts/clean-skin-rings.py a.png ...  # specific files
"""
from __future__ import annotations

import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CHAR_DIRS = ['bun', 'cocoa', 'tira', 'honey', 'bunny', 'hanji']
W_LEVEL = 222       # min channel >= this => bright
SAT = 34            # max-min <= this => near-grey (white halo, not cream/colour)
MAXDEPTH = 28       # px: safety cap so the fill can't run deep into white fur
BORDER_BG_FRAC = 0.003  # opaque-connected-to-border above this => a scene; skip
# Second pass: shave the warm cream/white anti-aliased rim that sits just outside
# the dark outline (the flood can't catch it — it's warm, not neutral). Peels
# only *bright* boundary pixels, so the dark outline stops it and light clothing
# (blue/pink) below the threshold is spared. Bounded to a couple of px.
PEEL_ITERS = 2
PEEL_MIN_BRIGHT = 185


def has_real_background(alpha: np.ndarray) -> bool:
    opaque = alpha > 200
    border = np.zeros_like(opaque)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    blob = ndimage.binary_propagation(opaque & border, mask=opaque)
    return int(blob.sum()) > BORDER_BG_FRAC * alpha.size


def clean(path: str) -> None:
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im).astype(np.int32)
    rgb = arr[..., :3]
    alpha = arr[..., 3]

    if has_real_background(alpha):
        print(f'SKIP (has background): {os.path.relpath(path)}')
        return

    mn = rgb.min(2)
    mx = rgb.max(2)
    whiteish = (mn >= W_LEVEL) & ((mx - mn) <= SAT)
    bg = alpha < 16

    seed = whiteish & ndimage.binary_dilation(bg, iterations=1)
    ring = ndimage.binary_propagation(seed, mask=whiteish)
    ring &= ndimage.distance_transform_edt(~bg) <= MAXDEPTH

    new_alpha = alpha.copy()
    new_alpha[ring] = 0
    ring_changed = int((ring & (alpha >= 16)).sum())

    # Rim peel: shave remaining bright (cream/white) boundary pixels; the dark
    # outline isn't bright, so it halts the peel and becomes the clean edge.
    peeled = 0
    for _ in range(PEEL_ITERS):
        opaque = new_alpha >= 16
        boundary = opaque & ndimage.binary_dilation(~opaque, iterations=1)
        take = boundary & (mn >= PEEL_MIN_BRIGHT)
        peeled += int(take.sum())
        new_alpha[take] = 0

    out = np.dstack([rgb, new_alpha]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(path)
    print(f'cleaned: {os.path.basename(path):28} ring {ring_changed:5d} + rim {peeled:5d} px')


def main() -> None:
    files = sys.argv[1:]
    if not files:
        for d in CHAR_DIRS:
            files += sorted(glob.glob(f'assets/images/{d}/*.png'))
    for p in files:
        clean(p)


if __name__ == '__main__':
    main()
