#!/usr/bin/env python3
"""Clear leftover background "pockets" enclosed inside a companion skin cutout.

The skin PNGs were cut out with a border flood-fill, so the outside is clean
but any white background that is *enclosed* by the figure survived as opaque
white: the strip between two legs, the gap between an arm and a ponytail, the
sliver between a glove and the shorts. On the app's pink cards those pockets
show as white patches inside the silhouette.

Telling a pocket from white fur/dress/hair is a judgement call (they share the
same white), so pockets are listed by hand below as seed points, each with the
area it is expected to cover. For each seed this:

  1. floods the connected near-white region from the seed (stops at the dark
     outline), aborting if it is larger than expected (= the fill leaked
     through a gap in the outline into the figure);
  2. grows the cut up to GROW px through the white->outline anti-aliasing
     band, un-mixing white out of those pixels (colour-to-alpha against white)
     so the hole gets the same crisp edge as the outside of the figure, with no
     pale ring left behind. Growth stops at solid outline pixels;
  3. sweeps tiny pale islands (<= SPECK_MAX px) stranded where a pocket
     narrows to a 1-2 px channel at its tip.

Not idempotent by design: once a pocket is cleared its seed is no longer on
white and the script exits — restore the originals from git before re-running.

Animated skins (-anim.webp) were checked 2026-11-19 and have no pockets; only
the static stills (shop grid / wardrobe / gallery / pickers) did.

Edits files in place; originals are in git. Re-check visually over a dark and
a pink background afterwards.

Usage: python3 scripts/clear-skin-pockets.py [--dry-run]
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image
from scipy import ndimage

# file -> [(seed_x, seed_y, max_area_px, note)]
POCKETS: dict[str, list[tuple[int, int, int, str]]] = {
    'assets/images/bun/bun-starry.png': [
        (600, 1055, 1200, 'strip between the socks'),
        (850, 880, 4200, 'gap between right hand/dress and ponytail'),
    ],
    'assets/images/bun/bun-heartcore.png': [
        (655, 1050, 6000, 'strip between the legs'),
    ],
    'assets/images/honey/honey-champion.png': [
        (435, 892, 900, 'sliver between left glove and shorts'),
        (799, 893, 900, 'sliver between right glove and shorts'),
    ],
    'assets/images/tira/tira-sleepover.png': [
        (626, 1019, 1500, 'gap between the legs'),
    ],
}

WHITE_MIN = 225   # min channel >= this ...
WHITE_SAT = 40    # ... and max-min <= this  => background white
GROW = 4          # px of anti-aliasing band to un-mix around each pocket
SOLID = 0.9       # colour-to-alpha >= this = solid outline; growth stops
SPECK_REACH = 12  # px from the pocket to look for stranded pale specks
SPECK_MIN = 180   # min channel >= this = pale speck
SPECK_MAX = 40    # pale islands larger than this are real art, kept


def c2a_white(rgb: np.ndarray) -> np.ndarray:
    """Alpha needed to explain each pixel as colour composited over white."""
    return (255.0 - rgb.min(axis=-1)) / 255.0


def clear(path: str, seeds, dry: bool) -> None:
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im).astype(np.float64)
    rgb, a = arr[..., :3], arr[..., 3]
    mn, mx = rgb.min(-1), rgb.max(-1)
    white = (a > 200) & (mn >= WHITE_MIN) & ((mx - mn) <= WHITE_SAT)
    lab, _ = ndimage.label(white)
    ca = c2a_white(rgb)

    hole = np.zeros(a.shape, bool)
    for sx, sy, max_area, note in seeds:
        i = lab[sy, sx]
        if i == 0:
            sys.exit(f'{path}: seed ({sx},{sy}) [{note}] is not on background white')
        core = lab == i
        area = int(core.sum())
        if area > max_area:
            sys.exit(f'{path}: [{note}] fill is {area}px > {max_area}px — leaked, aborting')
        print(f'  {note}: {area}px')
        hole |= core

    # Grow through the AA band: pixels lighter than solid outline, adjacent to
    # the hole, at most GROW px out. Outline pixels (ca >= SOLID) stop it.
    band = np.zeros(a.shape, bool)
    reach = hole.copy()
    for _ in range(GROW):
        ring = ndimage.binary_dilation(reach) & ~reach & (a > 0) & (ca < SOLID)
        if not ring.any():
            break
        band |= ring
        reach |= ring

    # Specks: where a pocket narrows to a 1-2 px channel at its tip, a few
    # pale pixels are cut off from the white core and sit beyond GROW. Sweep
    # small pale islands reachable from the hole without crossing solid
    # outline (big pale regions = real fur/fabric, never touched).
    reach2 = hole | band
    for _ in range(SPECK_REACH):
        reach2 |= ndimage.binary_dilation(reach2) & (a > 0) & (ca < SOLID)
    pale = (a > 0) & (mn >= SPECK_MIN) & ~hole & ~band
    plab, pn = ndimage.label(pale)
    psize = ndimage.sum(pale, plab, index=np.arange(pn + 1))
    speck = pale & reach2 & (psize[plab] <= SPECK_MAX)
    if speck.any():
        print(f'  specks: {int(speck.sum())}px')
    band |= speck

    out = arr.copy()
    # Core pocket: fully transparent, matching the exterior's (0,0,0,0).
    out[hole] = 0
    # Band: un-mix white. new_alpha = ca * old_alpha; colour = (c - (1-ca)*255)/ca
    k = ca[band][:, None]
    keep = k > 1e-3
    col = np.where(keep, (rgb[band] - (1 - k) * 255.0) / np.maximum(k, 1e-3), 0)
    out[band, :3] = np.clip(col, 0, 255)
    out[band, 3] = np.clip(a[band] * ca[band], 0, 255)
    print(f'  band: {int(band.sum())}px un-mixed')

    if not dry:
        Image.fromarray(out.round().astype(np.uint8), 'RGBA').save(path, optimize=True)


def main() -> None:
    dry = '--dry-run' in sys.argv
    for path, seeds in POCKETS.items():
        print(path)
        clear(path, seeds, dry)


if __name__ == '__main__':
    main()
