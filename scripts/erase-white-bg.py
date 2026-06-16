#!/usr/bin/env python3
"""Erase a solid opaque near-white background from a character PNG.

Unlike clean-skin-rings.py (which shaves a thin ring around an already-cut
alpha), this handles art that ships with a *fully opaque* white background and
no transparency at all. It flood-fills from the image border through neutral
near-white pixels and stops at the character's dark/coloured outline, so the
white fur enclosed by that outline is never touched. A short feather pass then
fades the bright anti-aliased rim so no white halo is left on dark surfaces.

Usage: python3 scripts/erase-white-bg.py <png> [<png> ...]
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image
from scipy import ndimage

W_LEVEL = 196   # min channel >= this => bright (lower => cut hugs the outline)
SAT = 46        # max-min <= this => near-grey (white bg, not cream/colour)
FEATHER = 4     # px of bright rim to clear/fade around the cut


def erase(path: str) -> None:
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im).astype(np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    candidate = (mn >= W_LEVEL) & ((mx - mn) <= SAT)

    # Keep only candidate regions connected to the image border.
    labels, n = ndimage.label(candidate)
    border = np.concatenate([
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1],
    ])
    keep = set(int(v) for v in np.unique(border) if v != 0)
    bg = np.isin(labels, list(keep))

    out = arr.copy()
    out[..., 3] = np.where(bg, 0, a)

    # Feather: clear the bright anti-aliased rim just outside the cut so no white
    # halo reads on dark surfaces. The first rings are cut fully; outer rings
    # taper. Restricted to bright pixels (min>=185) so the dark outline and the
    # pink dress (low min) are spared.
    bright = (mn >= 185)
    frontier = (out[..., 3] == 0)
    for step in range(FEATHER):
        grown = ndimage.binary_dilation(frontier)
        rim = grown & ~frontier & bright & (out[..., 3] > 0)
        if step < 2:
            new_alpha = 0
        else:
            new_alpha = out[..., 3] * (step - 1) // (FEATHER - 1)
        out[..., 3] = np.where(rim, new_alpha, out[..., 3])
        frontier = grown

    Image.fromarray(out.astype(np.uint8), 'RGBA').save(path)
    cut = int(bg.sum())
    print(f'{path}: erased {cut} bg px ({cut * 100 // bg.size}%)')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        erase(p)
