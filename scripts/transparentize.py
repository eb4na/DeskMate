#!/usr/bin/env python3
"""Edge-aware background removal for cozy illustration PNGs.

Removes the flat white/near-white background that is *connected to the image
border*, leaving interior whites (frosting, cream, highlights) intact — these
illustrations have dark outlines, so a border flood-fill never leaks inside.
Edges are anti-aliased and de-fringed (white halo removed) for clean overlays.

Usage: python3 scripts/transparentize.py <file.png> [<file.png> ...]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

# Near-white background detection.
WHITE_LEVEL = 232      # min channel must be at least this bright
SAT_MAX = 22           # and near-grey (max-min channel spread) to count as bg
# Anti-alias feather ramp (recovered alpha for greyish edge pixels).
FEATHER_LO = 198
FEATHER_HI = 242
# Enclosed "hole" removal: a neutral (un-warm) bright region like the donut
# centre, distinct from warm cream that belongs to the art (cream has R-B ~25+).
HOLE_LEVEL = 233       # min channel
HOLE_WARMTH = 14       # max R-B; cream is warmer than this, neutral white isn't
HOLE_MIN_FRAC = 0.002  # only clear sizeable holes, never tiny highlights/sprinkles


def transparentize(path: str) -> None:
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im).astype(np.float32)
    rgb = arr[..., :3]
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)

    # Candidate background: bright + low saturation.
    candidate = (mn >= WHITE_LEVEL) & ((mx - mn) <= SAT_MAX)

    # Seed from the border, flood-fill through candidate pixels only.
    border = np.zeros_like(candidate)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    seed = candidate & border
    bg = ndimage.binary_propagation(seed, mask=candidate)

    # Second pass: clear sizeable *enclosed* neutral-white regions (e.g. the
    # donut hole) that the border fill can't reach. Warm cream is excluded by
    # the warmth test, and the area floor protects highlights/white sprinkles.
    neutral = (mn >= HOLE_LEVEL) & ((mx - mn) <= HOLE_WARMTH) & ((rgb[..., 0] - rgb[..., 2]) <= HOLE_WARMTH)
    holes = neutral & ~bg
    labels, n = ndimage.label(holes)
    if n:
        min_area = HOLE_MIN_FRAC * holes.size
        sizes = ndimage.sum(np.ones_like(labels), labels, index=np.arange(1, n + 1))
        keep = {i + 1 for i, s in enumerate(sizes) if s >= min_area}
        big_holes = np.isin(labels, list(keep)) if keep else np.zeros_like(bg)
        bg = bg | big_holes

    # Hard alpha, then feather the 2px boundary band by whiteness so the edge
    # isn't a hard staircase.
    alpha = np.where(bg, 0.0, 255.0)
    bg_dil = ndimage.binary_dilation(bg, iterations=2)
    ring = bg_dil & ~bg  # subject pixels hugging the cut edge
    whiteness = np.clip((mn - FEATHER_LO) / (FEATHER_HI - FEATHER_LO), 0.0, 1.0)
    alpha = np.where(ring, 255.0 * (1.0 - whiteness), alpha)
    # Gentle 1px smooth to kill jaggies.
    alpha = ndimage.gaussian_filter(alpha, sigma=0.6)
    alpha = np.clip(alpha, 0, 255)

    # De-fringe: unmultiply partially-transparent edge pixels off the white
    # matte so no bright halo remains. observed = a*F + (1-a)*white.
    a = (alpha / 255.0)[..., None]
    edge = (alpha > 4) & (alpha < 251)
    with np.errstate(divide="ignore", invalid="ignore"):
        recovered = (rgb - (1.0 - a) * 255.0) / np.clip(a, 1e-3, 1.0)
    out_rgb = np.where(edge[..., None], np.clip(recovered, 0, 255), rgb)

    out = np.dstack([out_rgb, alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(path)

    total = alpha.size
    transp = int((alpha < 4).sum())
    print(f"{path}: removed {transp / total:.0%} as background")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        transparentize(p)
