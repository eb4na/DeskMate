#!/usr/bin/env python3
"""Normalize chat-emote PNGs so Bun's HEAD is the same size in every one.

The 12 emotes came out of the old mood picker, where each drawing was exported on
its own tight canvas (353-428 x 387-460, ~20% spread). That was fine behind a
bordered tile, but chat stickers render raw with `contentFit:"contain"`, so a
letterboxed canvas makes the face itself change size from emote to emote.

Sizing by the whole alpha bbox is the wrong fix (AGENTS.md: "Size by the HEAD, not
the silhouette") — the decorations are exactly what differ. sleepy's zZz, proud and
excited's sparkles, relieved's sigh cloud and stressed's tears all push the bbox
out, so bbox-fitting would shrink precisely the emotes that already look small.

Instead: the head is the largest connected alpha component and every decoration is
a detached blob, so we measure the head, scale on it, and paste onto one shared
square canvas with the head anchored identically. Decorations keep their offset
relative to the head and land where they land.

Idempotent: re-running on already-normalized files is a no-op within rounding.

    python3 scripts/normalize-emotes.py [--check]
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMOTE_DIR = os.path.join(ROOT, 'assets', 'images', 'emotes')

CANVAS = 512      # output is square so `contentFit:"contain"` never letterboxes
MARGIN = 0.02     # fraction of the canvas kept clear around the widest artwork
ALPHA_MIN = 24    # ignore near-transparent halo pixels when finding components


def head_and_full_bbox(im: Image.Image) -> tuple[tuple[int, int, int, int], tuple[int, int, int, int]]:
    """(head bbox, full-artwork bbox) as (x0, y0, x1, y1), exclusive on x1/y1."""
    alpha = np.array(im.getchannel('A'))
    mask = alpha > ALPHA_MIN
    labels, count = ndimage.label(mask)
    if count == 0:
        raise ValueError('image is fully transparent')
    # Largest component by pixel count = the head. Decorations are detached blobs.
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    head_label = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(labels == head_label)
    head = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    ys, xs = np.nonzero(mask)
    full = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return head, full


def main() -> int:
    check_only = '--check' in sys.argv
    names = sorted(f for f in os.listdir(EMOTE_DIR) if f.endswith('.png'))
    if not names:
        print(f'no PNGs in {EMOTE_DIR}')
        return 1

    # Pass 1: measure. Everything is expressed in head-heights, relative to the
    # head's centre, so the extents can be compared across differently-sized files.
    measured = []
    for name in names:
        im = Image.open(os.path.join(EMOTE_DIR, name)).convert('RGBA')
        head, full = head_and_full_bbox(im)
        hh = head[3] - head[1]
        cx, cy = (head[0] + head[2]) / 2, (head[1] + head[3]) / 2
        measured.append({
            'name': name, 'im': im, 'head_h': hh, 'cx': cx, 'cy': cy,
            'left': (cx - full[0]) / hh, 'right': (full[2] - cx) / hh,
            'top': (cy - full[1]) / hh, 'bottom': (full[3] - cy) / hh,
        })

    spread = max(m['head_h'] for m in measured) / min(m['head_h'] for m in measured)
    print(f'head heights: {min(m["head_h"] for m in measured)}-'
          f'{max(m["head_h"] for m in measured)} px (spread {spread:.2f}x)')
    if check_only:
        for m in measured:
            print(f'  {m["name"]:<28} head {m["head_h"]:>4}px')
        return 0

    # Pass 2: pick one layout that fits every emote's decorations, then paste.
    L = max(m['left'] for m in measured)
    R = max(m['right'] for m in measured)
    T = max(m['top'] for m in measured)
    B = max(m['bottom'] for m in measured)
    box_w, box_h = L + R, T + B
    usable = CANVAS * (1 - 2 * MARGIN)
    head_px = usable / max(box_w, box_h)          # head height in output pixels
    # Centre the content box in the square, then locate the head centre in it.
    anchor_x = (CANVAS - box_w * head_px) / 2 + L * head_px
    anchor_y = (CANVAS - box_h * head_px) / 2 + T * head_px
    print(f'target head height {head_px:.1f}px on a {CANVAS}px canvas')

    for m in measured:
        s = head_px / m['head_h']
        im = m['im']
        w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
        scaled = im.resize((w, h), Image.LANCZOS)
        out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        out.paste(scaled, (round(anchor_x - m['cx'] * s), round(anchor_y - m['cy'] * s)))
        out.save(os.path.join(EMOTE_DIR, m['name']))
        print(f'  {m["name"]:<28} {im.width}x{im.height} -> {CANVAS}x{CANVAS} (x{s:.3f})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
