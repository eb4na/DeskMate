#!/usr/bin/env python3
"""Remove the soft grey background haze left around the chat emote artwork.

The emote PNGs were cut from a soft-edged source, and a faint semi-transparent
grey/warm wisp survives OUTSIDE the character's dark outline — most obvious just
left of the chef hat. It is nearly invisible on white but reads as a dirty white
smudge on the app's cream chat surface, which is where these are shown.

Why this needs its own pass (clean-skin-rings.py does not catch it):
  * That script floods through *near-white* pixels seeded from the transparent
    edge. These files store RGB 0,0,0 in fully transparent areas, so a dark
    fringe rings the haze and blocks the flood — it reports 0 px changed.
  * The haze is also mid-grey (min channel ~186), below that script's W_LEVEL.

The rule here instead:
  1. `solid` = alpha >= SOLID. Flood the outside from the image border through
     everything that is not solid.
  2. Kill a reached pixel only if it is further than KEEP_AA from ANY solid ink
     (so every element keeps its anti-aliased rim and edges stay soft) and is
     desaturated (so coloured art is never touched).
  3. Never touch anything within PROTECT of *floating* coloured art — the
     sparkles, the sleepy Z's and the relieved sigh puff carry their own pale
     glow that is intentional and is itself desaturated. "Floating" means
     further than FAR from the main figure, so colour ON the figure (the hat
     strawberries, the cheeks) does not shield the haze hugging the outline.

Verified: haze gone on all 12; Z's, sweat drop, anger lines, sigh puff and BOTH
excited sparkles unchanged.

Usage:
  python3 scripts/clean-emote-haze.py              # all assets/images/emotes
  python3 scripts/clean-emote-haze.py a.png ...    # specific files
"""
from __future__ import annotations

import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SOLID = 250      # alpha >= this counts as solid ink
KEEP_AA = 3      # px of anti-aliased rim to preserve around every element
MAX_SAT = 45     # max-min <= this => neutral (haze), not coloured art
COLOUR_SAT = 60  # max-min > this => coloured art worth protecting
FAR = 6          # px from the main figure before colour counts as "floating"
PROTECT = 34     # px of shelter around floating coloured art


def clean(path: str) -> None:
    arr = np.asarray(Image.open(path).convert('RGBA')).astype(np.int32)
    rgb, alpha = arr[..., :3], arr[..., 3]
    sat = rgb.max(2) - rgb.min(2)

    solid = alpha >= SOLID
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    if not n:
        print(f'SKIP (no solid ink): {os.path.basename(path)}')
        return
    main = lab == int(np.argmax(ndimage.sum(solid, lab, range(1, n + 1)))) + 1

    border = np.zeros_like(alpha, dtype=bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    outside = ndimage.binary_propagation(border & ~solid, mask=~solid)

    d_solid = ndimage.distance_transform_edt(~solid)
    d_main = ndimage.distance_transform_edt(~main)
    floating_colour = (sat > COLOUR_SAT) & (alpha > 40) & (d_main > FAR)
    protect = ndimage.binary_dilation(floating_colour, iterations=PROTECT)

    kill = outside & (alpha > 0) & (d_solid > KEEP_AA) & (sat <= MAX_SAT) & ~protect
    if not kill.any():
        print(f'clean already: {os.path.basename(path)}')
        return

    new_alpha = alpha.copy()
    new_alpha[kill] = 0
    Image.fromarray(np.dstack([rgb, new_alpha]).astype(np.uint8), 'RGBA').save(path)
    print(f'cleaned: {os.path.basename(path):26} haze {int(kill.sum()):6d} px')


def main() -> None:
    files = sys.argv[1:] or sorted(glob.glob('assets/images/emotes/*.png'))
    for p in files:
        clean(p)


if __name__ == '__main__':
    main()
