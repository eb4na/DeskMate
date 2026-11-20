#!/usr/bin/env python3
"""Two one-off art repairs on the chat emotes. Run AFTER clean-emote-rim.py.

1. emote-relieved.png — the left ear had a grey smudge baked in: a grey
   shadow beside the pink inner ear, a muddy grey cast on the pink itself,
   and lowered alpha (216-245 instead of the body's solid 254) so dark
   surfaces showed through it. Repaint that ear region as clean face white +
   flat pink (pinkness measured by R-B, matched to the other emotes' ear
   colours) and restore solid alpha. Feathered at the box edge.

2. emote-excited.png — the lower sparkle was half erased by the original
   background removal (only a "<" plus a faint dark smear survived). Replace
   it with a 0.9x copy of the clean upper sparkle from the same emote.

Coordinates are for the 512x512 emote art as of 2026-11-19.

Usage: python3 scripts/fix-emote-details.py   (edits files in place)
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage

DIR = 'assets/images/emotes/'


def fix_relieved_ear(path: str) -> None:
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
    rgb = a[..., :3]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    ink = (a[..., 3] > 180) & (lum < 150)
    box = np.zeros(lum.shape, bool)
    box[195:312, 92:186] = True
    reg = box & (ndimage.distance_transform_edt(~ink) > 2.5) & (a[..., 3] > 200)

    white = np.array([252.0, 249.0, 246.0])  # face white (median of other emotes)
    pink = np.array([252.0, 220.0, 211.0])   # inner-ear pink (other emotes)
    t = np.clip(((rgb[..., 0] - rgb[..., 2]) / (pink[0] - pink[2]) - 0.22) / 0.78, 0, 1)
    new = white * (1 - t[..., None]) + pink * t[..., None]
    fe = np.clip(ndimage.distance_transform_edt(box) / 4.0, 0, 1)[..., None]

    out = a.copy()
    out[reg, :3] = (rgb * (1 - fe) + new * fe)[reg]
    solid = np.median(a[..., 3][(a[..., 3] > 250) & ~box & (lum > 230)])
    na = a[..., 3] * (1 - fe[..., 0]) + np.maximum(a[..., 3], solid) * fe[..., 0]
    out[reg, 3] = na[reg]
    Image.fromarray(out.round().astype(np.uint8), 'RGBA').save(path, optimize=True)
    print(f'relieved: repainted ear, {int(reg.sum())} px')


def fix_excited_sparkle(path: str) -> None:
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
    al = a[..., 3]
    # upper sparkle = largest opaque component in its box (excludes the dot)
    box = np.zeros(al.shape, bool)
    box[155:222, 32:90] = True
    lab, n = ndimage.label(ndimage.binary_dilation((al > 10) & box, iterations=1))
    i_star = max((int(((lab == i) & box).sum()), i) for i in range(1, n + 1))[1]
    mask = (lab == i_star) & box
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    patch = a[y0:y1, x0:x1].copy()
    patch[~mask[y0:y1, x0:x1]] = 0

    # premultiplied resize so no dark/white fringe appears
    scale = 0.9
    pm = patch.copy()
    pm[..., :3] *= pm[..., 3:4] / 255
    w, h = int(round((x1 - x0) * scale)), int(round((y1 - y0) * scale))
    p = np.asarray(Image.fromarray(pm.round().astype(np.uint8), 'RGBA')
                   .resize((w, h), Image.LANCZOS)).astype(np.float64)
    ok = p[..., 3] > 0
    p[ok, :3] = np.clip(p[ok, :3] * 255 / p[ok, 3:4], 0, 255)

    out = a.copy()
    out[232:318, 26:94] = 0  # the damaged lower sparkle + its smear
    cx, cy = 61, 283         # centre of the original lower sparkle
    base = Image.fromarray(out.round().astype(np.uint8), 'RGBA')
    base.alpha_composite(Image.fromarray(p.round().astype(np.uint8), 'RGBA'),
                         (int(round(cx - w / 2)), int(round(cy - h / 2))))
    base.save(path, optimize=True)
    print(f'excited: lower sparkle rebuilt from upper ({w}x{h})')


if __name__ == '__main__':
    fix_relieved_ear(DIR + 'emote-relieved.png')
    fix_excited_sparkle(DIR + 'emote-excited.png')
