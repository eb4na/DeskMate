#!/usr/bin/env python3
"""Background removal for the ChatGPT studying art.

Robust two-stage approach (works even when the character's body is near-white,
where an outline flood-fill leaks and eats the body):

1. rembg (U^2-Net matting) segments the FULL character by content — a complete
   mask with no holes. But it leaves a soft near-white "sticker" halo just
   outside the dark outline.
2. Erode that mask inward a few pixels so the edge lands ON the dark outline,
   shaving the halo off. The outline is thick, so a small erosion costs nothing.

Then keep the largest component and lightly smooth the alpha.

Usage: python3 bg_clean.py <input.png> <output.png> [erode_px]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from rembg import remove

inp, out = sys.argv[1], sys.argv[2]
ERODE = int(sys.argv[3]) if len(sys.argv) > 3 else 6  # px to shave the halo ring

src = Image.open(inp).convert("RGBA")
cut = remove(src)                     # complete matte, RGBA
a = np.array(cut)
mask = a[:, :, 3] > 60                # solid foreground

# Shave the halo: erode inward so the edge sits on the dark outline.
if ERODE > 0:
    mask = ndimage.binary_erosion(mask, iterations=ERODE)

# Keep only the largest component (drops any detached bits).
lbl, n = ndimage.label(mask)
if n > 1:
    sizes = np.bincount(lbl.ravel()); sizes[0] = 0
    mask = lbl == sizes.argmax()

alpha = np.where(mask, 255, 0).astype(np.uint8)
res = np.dstack([a[:, :, :3], alpha])
img = Image.fromarray(res, "RGBA")
img.putalpha(img.split()[3].filter(ImageFilter.GaussianBlur(0.7)))  # soften edge

opaque = int(mask.sum())
print(f"components={n} kept={opaque}px ({100*opaque/mask.size:.1f}%) erode={ERODE} bbox={img.getbbox()}")
img.save(out)
print("saved", out)
