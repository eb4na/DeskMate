#!/usr/bin/env python3
"""
Measure each solo character's face-center as a desk-book offset (dx), so the study
book can sit centered under each character's face instead of being eyeballed.

Run from the repo root:  python3 scripts/measure-book-offsets.py
Paste the printed block into SOLO_BOOK_OFFSET in src/components/study-room-view.tsx.
Re-run whenever a character's studying art changes or a new companion is added.

How it works
------------
The study book is laid out centered on the character's column, then shifted by
`dx` (a fraction of the 300px solo canvas). Two things set dx:

  dx = SYSTEMATIC + faceDelta

* faceDelta — the character art's face center, measured here as the alpha-weighted
  horizontal centroid of the FACE band (28%–58% of the opaque height: cheeks/eyes,
  below hats/ears), expressed as a signed fraction of the canvas after the
  `contentFit:"contain"` scale into the 300px box. The art is nearly face-centered,
  so this term is small (±0.01).
* SYSTEMATIC — a constant book-placement bias common to every character (the book's
  visual center sits a touch right of its layout center). Calibrated once from a
  known-good target: Bun reads centered at dx -0.035 and measures faceDelta -0.011,
  so SYSTEMATIC = -0.035 - (-0.011) = -0.024.
"""
from PIL import Image
import numpy as np

CANVAS = 300            # SOLO_BOOK_CANVAS in study-room-view.tsx
SYSTEMATIC = -0.024     # see module docstring

# companion key -> its solo "studying" art (classic skin). Hanji renders the
# HanjiFigure SVG whose base layer is hanji-body.png, so measure that.
CHARS = {
    'bun': 'assets/images/bun/bun-home.png',
    'companion_cocoa': 'assets/images/cocoa/cocoa.png',
    'companion_tira': 'assets/images/tira/tira.png',
    'companion_honey': 'assets/images/honey/honey.png',
    'companion_bunny': 'assets/images/bunny/bunny.png',
    'hanji': 'assets/images/hanji/hanji-body.png',
}


def face_delta(path: str) -> float:
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    w, h = im.size
    ys, xs = np.where(a[:, :, 3] > 30)          # opaque pixels
    y0, y1 = ys.min(), ys.max()
    band_h = y1 - y0
    face = (ys >= y0 + 0.28 * band_h) & (ys <= y0 + 0.58 * band_h)
    face_cx = xs[face].mean()                    # source-px face center
    scale = min(CANVAS / w, CANVAS / h)          # contentFit: contain
    left = (CANVAS - w * scale) / 2
    rendered = left + face_cx * scale
    return (rendered - CANVAS / 2) / CANVAS


if __name__ == '__main__':
    print('const SOLO_BOOK_OFFSET: Record<string, { dx: number; dy: number }> = {')
    for key, path in CHARS.items():
        dx = round(face_delta(path) + SYSTEMATIC, 3)
        print(f'  {key}: {{ dx: {dx}, dy: 0 }},')
    print('};')
