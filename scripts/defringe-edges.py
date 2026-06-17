#!/usr/bin/env python3
"""Kill the white "fuzz"/halo left around cut-out art after background removal.

The fringe is caused by the original white background bleeding into the
anti-aliased silhouette: the partial-alpha edge pixels (and the transparent
pixels just outside them) keep a near-white RGB, so on a coloured surface the
edge glows white.

Fix = an *alpha-bleed*: recolour those fringe pixels with the nearest SOLID
(opaque) pixel's colour. Crucially this only rewrites RGB and **never touches
the alpha channel**, so no shape is eroded — white fur, white clothes, white
skin, plates, etc. are all preserved exactly. We also restrict the rewrite to a
thin band hugging the transparent edge, so any intentional interior translucency
(veils, glows, soft shadows) is left alone.

Usage:
  python3 scripts/defringe-edges.py                 # all costumes + recipes
  python3 scripts/defringe-edges.py a.png b.png ...  # specific files
"""
from __future__ import annotations

import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CHAR_DIRS = ['bun', 'cocoa', 'tira', 'honey', 'bunny', 'hanji']
RECIPE_FILES = [
    'strawberry-shortcake', 'pudding', 'sakura-mochi', 'matcha-crepe', 'croissant',
    'strawberry-badge', 'pudding-finished', 'sakura-badge', 'matcha-badge', 'croissant-badge',
]
OPAQUE = 128      # alpha >= this counts as a solid colour source
TRANSP = 16       # alpha < this counts as background (transparent)
BAND = 6          # px: only de-fringe within this distance of the transparent edge


def defringe(path: str) -> None:
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im).copy()
    rgb = arr[..., :3]
    alpha = arr[..., 3]

    opaque = alpha >= OPAQUE
    transp = alpha < TRANSP
    if not opaque.any() or not transp.any():
        print(f'skip (no edge): {os.path.basename(path)}')
        return

    # Fringe = non-opaque pixels hugging the transparent edge.
    near_edge = ndimage.distance_transform_edt(~transp) <= BAND
    fringe = (~opaque) & near_edge
    if not fringe.any():
        print(f'clean already:  {os.path.basename(path)}')
        return

    # Nearest opaque pixel's RGB for every pixel, then paint it onto the fringe.
    ind = ndimage.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    nearest = rgb[tuple(ind)]
    new_rgb = rgb.copy()
    new_rgb[fringe] = nearest[fringe]

    out = np.dstack([new_rgb, alpha]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(path)
    print(f'defringed:      {os.path.basename(path):28} {int(fringe.sum()):6d} px recoloured')


def main() -> None:
    files = sys.argv[1:]
    if not files:
        for d in CHAR_DIRS:
            files += sorted(glob.glob(f'assets/images/{d}/*.png'))
        files += [f'assets/images/cake/{n}.png' for n in RECIPE_FILES]
    for p in files:
        if os.path.exists(p):
            defringe(p)


if __name__ == '__main__':
    main()
